export type UserType = 'teacher' | 'student';

export type PollType = 'mcq' | 'vote';

export type PollState = 'idle' | 'active' | 'paused' | 'stopped' | 'completed';

export interface Poll {
  id: string;
  type: PollType;
  question: string;
  options?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer?: 'A' | 'B' | 'C' | 'D'; // For MCQ
  duration: number; // in seconds
  timeRemaining: number;
  state: PollState;
  answerRevealed: boolean;
  startTime?: number; // timestamp when poll became active
}

export interface StudentResponse {
  studentName: string;
  answer: string; // 'A'|'B'|'C'|'D' or 'ThumbsUp'|'ThumbsDown'
  responseTimeMs: number; // speed
  isCorrect?: boolean;
  score: number;
}

export interface Student {
  name: string;
  score: number;
  correctAnswersCount: number;
  totalAnsweredCount: number;
  totalResponseTimeMs: number;
  lastActive: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  role: 'teacher' | 'student';
  text: string;
  timestamp: number;
}

export interface ClassroomSession {
  id: string; // 6-digit code
  teacherName: string;
  students: { [name: string]: Student };
  currentPoll: Poll | null;
  polls: Poll[];
  responses: { [pollId: string]: { [studentName: string]: StudentResponse } };
  chat: ChatMessage[];
  createdAt: number;
}
