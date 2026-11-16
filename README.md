# LearnBoard AI

AI-powered interactive whiteboard tutor. See project setup and deployment instructions below.

## Stack
- React + TypeScript + Vite
- Express + TypeScript API
- Gemini API for lesson generation and follow-up answers
- Browser speech synthesis for narration
- Timeline-driven whiteboard actions

## Local development

1. Install Node.js 20+.
2. Run `npm install` at the repository root.
3. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`.
4. Run `npm run dev`.

## Environment
`GEMINI_API_KEY` is required by the server. Never commit `.env` or real API keys. Set production secrets in your hosting provider's environment settings.

## Deployment
See `render.yaml` for the backend deployment configuration and `vercel.json` for frontend hosting configuration. Set the API base URL in the frontend deployment and configure the Gemini API key only in the server environment.
