export interface User {
  id?: string; // Supabase UID
  username: string;
  email?: string;
  name: string;
  surname: string;
  password?: string;
  rank: string;
  points: number;
  sessionsCompleted: number;
  joinedDate: string;
  credits: number; // Stored in seconds
}

export interface SessionResult {
  overallScore: number;
  vocabularyScore: number;
  grammarScore: number;
  pronunciationScore: number; // Estimated from transcript clarity
  fluencyRating: 'Beginner' | 'Intermediate' | 'Advanced' | 'Native';
  feedback: string;
  durationSeconds: number;
  transcript: string;
  date: string;
  avatarName: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum AvatarVoice {
  Puck = 'Puck',
  Charon = 'Charon',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}

export interface AvatarConfig {
  name: string;
  accent: 'American' | 'British';
  voice: AvatarVoice;
  systemInstruction: string;
  description: string; // Portuguese description for UI
  color: string;
  avatarImage: string;
  videoUrl: string; // URL for the realistic talking video
}

export const RANKS = [
  { name: 'Novato', minPoints: 0 },
  { name: 'Aprendiz', minPoints: 500 },
  { name: 'Falante', minPoints: 2000 },
  { name: 'Orador', minPoints: 5000 },
  { name: 'Linguista', minPoints: 12000 },
  { name: 'Fluente', minPoints: 25000 },
  { name: 'Nativo', minPoints: 50000 },
];