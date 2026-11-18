import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';

const app = express();
const port = Number(process.env.PORT || 3001);
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));

const lessonSchema = z.object({
  topic: z.string().min(2).max(180),
  summary: z.string().min(5).max(320),
  duration: z.number().min(75).max(180),
  segments: z.array(z.object({
    id: z.string().min(1).max(40), start: z.number().min(0), end: z.number().positive(),
    narration: z.string().min(20).max(1200), title: z.string().min(1).max(70),
    board: z.array(z.discriminatedUnion('type', [
      z.object({ id: z.string(), type: z.literal('text'), x: z.number(), y: z.number(), text: z.string(), color: z.string().optional(), size: z.number().optional(), align: z.enum(['left','center','right']).optional() }),
      z.object({ id: z.string(), type: z.literal('circle'), x: z.number(), y: z.number(), radius: z.number().positive(), color: z.string().optional(), fill: z.string().optional(), label: z.string().optional() }),
      z.object({ id: z.string(), type: z.literal('rect'), x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive(), color: z.string().optional(), fill: z.string().optional(), label: z.string().optional() }),
      z.object({ id: z.string(), type: z.enum(['line','arrow']), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(), color: z.string().optional(), width: z.number().optional() }),
      z.object({ id: z.string(), type: z.literal('formula'), x: z.number(), y: z.number(), text: z.string(), color: z.string().optional(), size: z.number().optional() }),
    ])).max(24),
  })).min(4).max(10),
});

const lessonPrompt = (topic: string) => `You are an exceptional visual teacher. Create a clear, accurate, engaging teaching lesson about: "${topic}". Output ONLY valid JSON matching this schema: {"topic":string,"summary":string,"duration":120,"segments":[{"id":"s1","start":0,"end":18,"title":"...","narration":"...","board":[...]}]}. Create 6 to 8 chronological segments covering about 120 seconds. Narration must be natural spoken language, about 220-280 words total; do not use markdown. Every segment has a visual board action sequence that adds to (never erases) previous elements. Board coordinates use a 1000 x 620 canvas. Supported board items: {"id":"unique","type":"text","x":100,"y":100,"text":"Label","color":"#344054","size":24}, {"id":"unique","type":"formula","x":100,"y":100,"text":"E = mc²","color":"#5256d8","size":30}, {"id":"unique","type":"circle","x":300,"y":300,"radius":55,"color":"#5256d8","fill":"#efeeff","label":"Core"}, {"id":"unique","type":"rect","x":100,"y":100,"width":180,"height":90,"color":"#5256d8","fill":"#efeeff","label":"Input"}, {"id":"unique","type":"arrow","x1":100,"y1":100,"x2":200,"y2":200,"color":"#5256d8","width":3}, {"id":"unique","type":"line","x1":100,"y1":100,"x2":200,"y2":200,"color":"#5256d8","width":3}. Only use these types. Keep all x between 20-950 and y between 30-570, with shapes within canvas. Use concise text labels. Use distinct meaningful color accents (#5256d8 purple, #16a085 teal, #e58a43 orange, #344054 slate). Ensure each segment starts at previous end, first start=0, final end=duration. Teach intuitively with a hook, foundational model, visual breakdown, a concrete example, recap. Make the board visually explanatory, not text-heavy.`;

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('AI is not configured yet. Add GEMINI_API_KEY to the server environment.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.65, responseMimeType: 'application/json' },
  }) });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok) {
    const message = payload?.error?.message || `AI provider returned ${response.status}`;
    throw new Error(message);
  }
  const text = payload?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  if (!text) throw new Error('The AI returned an empty response. Please try again.');
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'LearnBoard AI API' }));
app.post('/api/lesson', async (req, res) => {
  const input = z.object({ topic: z.string().trim().min(2).max(180) }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: 'Enter a topic between 2 and 180 characters.' });
  try {
    const raw = await callGemini(lessonPrompt(input.data.topic));
    const lesson = lessonSchema.parse(JSON.parse(raw));
    const ordered = [...lesson.segments].sort((a, b) => a.start - b.start);
    if (ordered[0].start !== 0) throw new Error('AI lesson timeline is not valid. Please retry.');
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].end <= ordered[i].start || (i > 0 && ordered[i].start < ordered[i - 1].end - 0.1)) throw new Error('AI lesson timeline overlaps. Please retry.');
    }
    if (ordered.at(-1)!.end > 180) throw new Error('AI lesson is too long. Please retry.');
    res.json({ ...lesson, duration: ordered.at(-1)!.end, segments: ordered });
  } catch (error) {
    console.error('Lesson generation failed:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not generate lesson.' });
  }
});

app.post('/api/ask', async (req, res) => {
  const input = z.object({ topic: z.string().min(2).max(180), question: z.string().trim().min(2).max(600), lesson: z.object({ summary: z.string().max(320), segments: z.array(z.object({ title: z.string(), narration: z.string().max(1200) })).max(10) }) }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: 'Please enter a question under 600 characters.' });
  const context = input.data.lesson.segments.map((s) => `${s.title}: ${s.narration}`).join('\n');
  const prompt = `You are a warm, precise personal tutor. The learner just studied "${input.data.topic}". Lesson summary: ${input.data.lesson.summary}. Lesson notes:\n${context}\nAnswer the learner's follow-up question accurately and in a friendly teaching style: "${input.data.question}". Keep the answer concise (roughly 60-120 words), explain jargon, and use an example if useful. If the question is outside the topic, answer briefly and connect back to the lesson. Do not claim facts not supported by your knowledge.`;
  try {
    const answer = await callGemini(prompt);
    res.json({ answer: answer.replace(/^\s*"|"\s*$/g, '') });
  } catch (error) {
    console.error('Follow-up failed:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not answer the question.' });
  }
});

if (!process.env.VERCEL) app.listen(port, () => console.log(`LearnBoard AI API listening on ${port}`));

export default app;
