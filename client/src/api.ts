import type { Lesson } from './types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

export const generateLesson = (topic: string) => request<Lesson>('/lesson', { topic });
export const askTutor = (topic: string, lesson: Lesson, question: string) =>
  request<{ answer: string }>('/ask', { topic, lesson, question });
export interface ImprovementProposal {
  title: string;
  category: 'UI/UX' | 'AI quality' | 'Whiteboard' | 'Audio' | 'Learning' | 'History' | 'Languages' | 'Performance' | 'Other';
  impact: 'Low' | 'Medium' | 'High';
  summary: string;
  implementationPlan: string[];
  acceptanceCriteria: string[];
  risks: string[];
}

export const analyseImprovement = (requestText: string, currentContext?: string) =>
  request<ImprovementProposal>('/improve', { request: requestText, currentContext });


export const reviseLesson = (lesson: Lesson, requestText: string) =>
  request<Lesson>('/revise', { lesson, request: requestText });
