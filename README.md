# LearnBoard AI — Interactive Whiteboard Tutor

LearnBoard AI turns a learner's topic into a short visual lesson. It combines AI-generated narration, a timestamped lesson outline, a canvas whiteboard, browser speech synthesis, playback controls, and contextual follow-up questions.

## Features

- Topic-first lesson generation with Google Gemini.
- Structured 75–180 second lessons with 4–10 timed segments.
- Canvas whiteboard elements: text, formulas, circles, rectangles, lines, and arrows.
- Narration synchronized to the active lesson segment using the browser Web Speech API.
- Play, pause, resume, seek, skip, restart, chapter navigation, mute, and narration speed.
- Contextual follow-up questions using the lesson content.
- Responsive React interface with loading and error states.

## Stack

- Frontend: React 18, TypeScript, Vite, Lucide.
- Backend: Node.js, Express, Zod.
- AI: Google Gemini API (server-side only).

## Local setup

Requires Node.js 20+ and npm 10+.

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `server/.env` and add your Gemini API key:

   ```env
   GEMINI_API_KEY=your_real_key
   GEMINI_MODEL=gemini-2.5-flash
   PORT=3001
   CLIENT_ORIGIN=http://localhost:5173
   ```

3. Start the frontend and API together:

   ```bash
   npm run dev
   ```

4. Open http://localhost:5173.

Never commit `.env` or expose the Gemini key in browser code.

## Production deployment

This repository currently contains a Vite frontend and a separate Express API.

### Frontend on Netlify

- Base directory: repository root.
- Build command: `npm install && npm run build`.
- Publish directory: `client/dist`.
- Set `VITE_API_URL` to the public backend URL ending in `/api` (for example, `https://your-api.onrender.com/api`) before building.

The included `netlify.toml` configures the frontend build. It does not deploy the Express API by itself.

### API on Render

The included `render.yaml` describes the Express service. Configure these environment variables in Render:
- `GEMINI_API_KEY`: your Gemini API key (secret).
- `GEMINI_MODEL`: optional; defaults to `gemini-2.5-flash`.
- `CLIENT_ORIGIN`: the Netlify site origin, e.g. `https://your-site.netlify.app`.

After the API is deployed, set Netlify's `VITE_API_URL` to `https://your-api.onrender.com/api` and trigger a new frontend deploy.

Health check: `GET /api/health`.

## API endpoints

- `GET /api/health` — service health.
- `POST /api/lesson` — body: `{ "topic": "..." }`; returns a validated structured lesson.
- `POST /api/ask` — body: `{ "topic": "...", "lesson": { ... }, "question": "..." }`; returns a contextual answer.

## Notes and limitations

- Voice uses the browser's built-in Speech Synthesis API; available voices and pronunciation depend on the browser and operating system.
- Playback is synchronized at segment/chapter boundaries, not word-by-word.
- AI generation requires a valid Gemini API key on the backend.
- The API validates model output before returning it to the client.

## Assignment

Built for the Braynix Studios AI-Powered Interactive Whiteboard Tutor technical assignment.
