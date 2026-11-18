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
      z.object({ id: z.string(), type: z.literal('text'), x: z.number().min(20).max(950), y: z.number().min(30).max(570), text: z.string().min(1).max(90), color: z.string().optional(), size: z.number().min(12).max(42).optional(), align: z.enum(['left','center','right']).optional() }),
      z.object({ id: z.string(), type: z.literal('circle'), x: z.number().min(80).max(920), y: z.number().min(80).max(540), radius: z.number().min(12).max(58), color: z.string().optional(), fill: z.string().optional(), label: z.string().optional() }),
      z.object({ id: z.string(), type: z.literal('rect'), x: z.number().min(20).max(760), y: z.number().min(30).max(500), width: z.number().min(1).max(1000), height: z.number().min(1).max(620), color: z.string().optional(), fill: z.string().optional(), label: z.string().optional() }),
      z.object({ id: z.string(), type: z.enum(['line','arrow']), x1: z.number().min(20).max(950), y1: z.number().min(30).max(570), x2: z.number().min(20).max(950), y2: z.number().min(30).max(570), color: z.string().optional(), width: z.number().optional() }),
      z.object({ id: z.string(), type: z.literal('formula'), x: z.number().min(20).max(950), y: z.number().min(30).max(570), text: z.string().min(1).max(90), color: z.string().optional(), size: z.number().min(12).max(42).optional() }),
    ])).max(24),
  })).min(4).max(10),
});

const lessonPrompt = (topic: string) => `You are an exceptional visual teacher. Create a clear, accurate, engaging teaching lesson about: "${topic}". Output ONLY valid JSON matching this schema: {"topic":string,"summary":string,"duration":120,"segments":[{"id":"s1","start":0,"end":18,"title":"...","narration":"...","board":[...]}]}. Create 5 to 6 chronological segments covering about 100-120 seconds. Narration must be natural spoken language, about 160-210 words total; do not use markdown. Keep summary under 260 characters, topic under 180 characters, each title under 60 characters, and every text label under 65 characters. Every segment has a visual board action sequence that adds to (never erases) previous elements. Board coordinates use a 1000 x 620 canvas. Supported board items: {"id":"unique","type":"text","x":100,"y":100,"text":"Label","color":"#344054","size":24}, {"id":"unique","type":"formula","x":100,"y":100,"text":"E = mc²","color":"#5256d8","size":30}, {"id":"unique","type":"circle","x":300,"y":300,"radius":55,"color":"#5256d8","fill":"#efeeff","label":"Core"}, {"id":"unique","type":"rect","x":100,"y":100,"width":180,"height":90,"color":"#5256d8","fill":"#efeeff","label":"Input"}, {"id":"unique","type":"arrow","x1":100,"y1":100,"x2":200,"y2":200,"color":"#5256d8","width":3}, {"id":"unique","type":"line","x1":100,"y1":100,"x2":200,"y2":200,"color":"#5256d8","width":3}. Only use these types. Keep all x between 20-950 and y between 30-570, with shapes fully inside canvas. STRICT SIZE LIMITS: circle radius 18-55 only; rectangles width 70-220 and height 45-130 only; font size 16-38 only; line width 2-4 only. Never create giant circles, giant rectangles, full-width filled blocks, overlapping shapes, or dark-filled backgrounds. Filled shapes must use only pale fills (#efeeff, #e8f7f3, #fff1e6, #f1f4f8); use dark colors only for outlines and text. Keep each segment to 2-4 well-spaced board elements, with clear alignment and arrows connecting related objects. Use concise text labels. Use distinct meaningful color accents (#5256d8 purple, #16a085 teal, #e58a43 orange, #344054 slate). Ensure each segment starts at previous end, first start=0, final end=duration. Teach intuitively with a hook, foundational model, visual breakdown, a concrete example, recap. Make the board visually explanatory, not text-heavy.`;

async function callGemini(prompt: string, jsonOutput = true): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('AI is not configured yet. Add GEMINI_API_KEY to the server environment.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.45, maxOutputTokens: 4500, thinkingConfig: { thinkingBudget: 0 }, ...(jsonOutput ? { responseMimeType: 'application/json' } : {}) },
  }) });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok) {
    const message = payload?.error?.message || `AI provider returned ${response.status}`;
    throw new Error(`Gemini ${response.status}: ${message}`);
  }
  const text = payload?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  if (!text) throw new Error('The AI returned an empty response. Please try again.');
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}


async function callOpenRouter(prompt: string, jsonOutput = true): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OpenRouter fallback is not configured. Add OPENROUTER_API_KEY to the server environment.');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ai-whiteboard-tutor-gilt.vercel.app',
      'X-Title': 'LearnBoard AI',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openrouter/free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.65,
    }),
  });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok) {
    const message = payload?.error?.message || `OpenRouter returned ${response.status}`;
    throw new Error(`OpenRouter ${response.status}: ${message}`);
  }
  const text = payload?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('OpenRouter returned an empty response.');
  return String(text).replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '').trim();
}

async function callAI(prompt: string, jsonOutput = true): Promise<string> {
  try {
    return await callGemini(prompt, jsonOutput);
  } catch (primaryError) {
    console.error('Gemini request failed; trying OpenRouter free fallback:', primaryError);
    if (!process.env.OPENROUTER_API_KEY) throw primaryError;
    return callOpenRouter(prompt, jsonOutput);
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'LearnBoard AI API' }));
app.post('/api/lesson', async (req, res) => {
  const input = z.object({ topic: z.string().trim().min(2).max(180) }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: 'Enter a topic between 2 and 180 characters.' });
  try {
    const raw = await callAI(lessonPrompt(input.data.topic), true);
    const parsedLesson = JSON.parse(raw) as Record<string, any>;\n    if (typeof parsedLesson.summary === 'string' && parsedLesson.summary.length > 320) {\n      const shortened = parsedLesson.summary.slice(0, 317);\n      parsedLesson.summary = shortened.slice(0, Math.max(1, shortened.lastIndexOf(' '))).trimEnd() + '…';\n    }\n    const lesson = lessonSchema.parse(parsedLesson);
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


const improvementSchema = z.object({
  title: z.string().min(3).max(100),
  category: z.enum(['UI/UX','AI quality','Whiteboard','Audio','Learning','History','Languages','Performance','Other']),
  impact: z.enum(['Low','Medium','High']),
  summary: z.string().min(10).max(500),
  implementationPlan: z.array(z.string().min(3).max(240)).min(2).max(7),
  acceptanceCriteria: z.array(z.string().min(3).max(180)).min(2).max(6),
  risks: z.array(z.string().min(3).max(180)).max(4),
});

app.post('/api/improve', async (req, res) => {
  const input = z.object({
    request: z.string().trim().min(8).max(1200),
    currentContext: z.string().max(500).optional(),
  }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: 'Describe an improvement in at least 8 characters (maximum 1,200).' });
  const prompt = `You are a senior product manager and software architect reviewing an improvement request for LearnBoard AI, an AI-powered interactive whiteboard tutor built with React, TypeScript, Express, and AI model APIs. Do not claim the change is already implemented. Turn the user's request into a practical, safe implementation proposal. Prefer accessible, responsive, privacy-conscious and low-cost solutions. Never recommend silently changing production code or exposing API keys. User request: "${input.data.request}". Current context: "${input.data.currentContext || 'No additional context supplied'}". Return ONLY valid JSON with this exact shape: {"title":"...","category":"UI/UX|AI quality|Whiteboard|Audio|Learning|History|Languages|Performance|Other","impact":"Low|Medium|High","summary":"...","implementationPlan":["..."],"acceptanceCriteria":["..."],"risks":["..."]}. Keep steps actionable and testable.`;
  try {
    const raw = await callAI(prompt, true);
    const proposal = improvementSchema.parse(JSON.parse(raw));
    res.json(proposal);
  } catch (error) {
    console.error('Improvement analysis failed:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not analyse this improvement. Please try again.' });
  }
});


app.post('/api/revise', async (req, res) => {
  const input = z.object({
    lesson: lessonSchema,
    request: z.string().trim().min(8).max(800),
  }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: 'Provide the current lesson and an improvement request of at least 8 characters.' });
  const prompt = `You are improving an existing visual teaching lesson. Preserve factual accuracy and the original topic. Apply the learner's requested change while keeping the lesson structure and schema valid. Keep 5-6 segments, 90-150 seconds total, narration around 160-210 words total, summary under 260 characters, and 2-4 clear, well-spaced board elements per segment. Board canvas is 1000x620. Text/formula font size 16-38; circle radius 18-55; rectangles width 70-220 and height 45-130; line width 2-4. Use only pale fills (#efeeff, #e8f7f3, #fff1e6, #f1f4f8), dark colours only for outlines/text. Never overlap shapes or create large dark blocks. Supported board element types are text, formula, circle, rect, arrow, line with the same fields as the supplied lesson. Return ONLY valid JSON matching the exact lesson schema. User request: "${input.data.request}". Existing lesson JSON: ${JSON.stringify(input.data.lesson)}`;
  try {
    const raw = await callAI(prompt, true);
    const revised = lessonSchema.parse(JSON.parse(raw));
    const ordered = [...revised.segments].sort((a, b) => a.start - b.start);
    if (ordered[0].start !== 0) throw new Error('Revised lesson timeline is invalid. Please retry.');
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].end <= ordered[i].start || (i > 0 && ordered[i].start < ordered[i - 1].end - 0.1)) throw new Error('Revised lesson timeline overlaps. Please retry.');
    }
    if (ordered.at(-1)!.end > 180) throw new Error('Revised lesson is too long. Please retry.');
    res.json({ ...revised, duration: ordered.at(-1)!.end, segments: ordered });
  } catch (error) {
    console.error('Lesson revision failed:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not improve this lesson.' });
  }
});

app.post('/api/ask', async (req, res) => {
  const input = z.object({ topic: z.string().min(2).max(180), question: z.string().trim().min(2).max(600), lesson: z.object({ summary: z.string().max(320), segments: z.array(z.object({ title: z.string(), narration: z.string().max(1200) })).max(10) }) }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: 'Please enter a question under 600 characters.' });
  const context = input.data.lesson.segments.map((s) => `${s.title}: ${s.narration}`).join('\n');
  const prompt = `You are a warm, precise personal tutor. The learner just studied "${input.data.topic}". Lesson summary: ${input.data.lesson.summary}. Lesson notes:\n${context}\nAnswer the learner's follow-up question accurately and in a friendly teaching style: "${input.data.question}". Keep the answer concise (roughly 60-120 words), explain jargon, and use an example if useful. If the question is outside the topic, answer briefly and connect back to the lesson. Do not claim facts not supported by your knowledge.`;
  try {
    const answer = await callAI(prompt, false);
    let cleanAnswer = answer.trim();
    try {
      const parsed = JSON.parse(cleanAnswer);
      if (typeof parsed?.response === 'string') cleanAnswer = parsed.response;
      else if (typeof parsed?.answer === 'string') cleanAnswer = parsed.answer;
    } catch { /* plain-text answer is expected */ }
    res.json({ answer: cleanAnswer.replace(/^\s*["']|["']\s*$/g, '') });
  } catch (error) {
    console.error('Follow-up failed:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not answer the question.' });
  }
});

if (!process.env.VERCEL) app.listen(port, () => console.log(`LearnBoard AI API listening on ${port}`));

export default app;
