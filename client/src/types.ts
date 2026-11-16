export type BoardElement =
  | { id: string; type: 'text'; x: number; y: number; text: string; color?: string; size?: number; align?: 'left' | 'center' | 'right' }
  | { id: string; type: 'circle'; x: number; y: number; radius: number; color?: string; fill?: string; label?: string }
  | { id: string; type: 'rect'; x: number; y: number; width: number; height: number; color?: string; fill?: string; label?: string }
  | { id: string; type: 'line' | 'arrow'; x1: number; y1: number; x2: number; y2: number; color?: string; width?: number }
  | { id: string; type: 'formula'; x: number; y: number; text: string; color?: string; size?: number };

export interface LessonSegment {
  id: string;
  start: number;
  end: number;
  narration: string;
  title: string;
  board: BoardElement[];
}

export interface Lesson {
  topic: string;
  summary: string;
  duration: number;
  segments: LessonSegment[];
}