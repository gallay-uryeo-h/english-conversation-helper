export interface Thread {
  id: string;
  title: string;
  partnerName: string;
  partnerRole?: string;
  avatarBg: string;
  avatarText: string;
  lastMessage: string;
  updatedAt: number;
  unreadCount?: number;
  isFavorite?: boolean;
  category: 'daily' | 'business' | 'interview' | 'travel';
}

export interface RecommendationCard {
  id: string;
  tone: 'Casual' | 'Natural' | 'Polite' | 'Business';
  english: string;
  koreanMeaning: string;
  grammarTip?: string;
}

export interface MessageAnalysis {
  grammarScore: number;
  fluencyScore: number;
  improvedVersion: string;
  explanation: string;
  keyVocabulary: { word: string; meaning: string; phonetic?: string }[];
}

export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  koreanDraft?: string;
  timestamp: number;
  recommendations?: RecommendationCard[];
  analysis?: MessageAnalysis;
}

export interface SavedExpression {
  id: string;
  english: string;
  korean: string;
  exampleSentence: string;
  situation: string;
  tag: string;
  createdAt: number;
}

export interface ScriptDialogueLine {
  speaker: string;
  isUser: boolean;
  english: string;
  korean: string;
}

export interface SavedScript {
  id: string;
  title: string;
  situation: string;
  level: string;
  targetExpression: string;
  dialogue: ScriptDialogueLine[];
  createdAt: number;
}

export interface Friend {
  id: string;
  name: string;
  role: string;
  description: string;
  avatarBg: string;
  avatarText: string;
  category: 'daily' | 'business' | 'travel' | 'interview' | 'tutor';
  greeting: string;
  badge?: string;
}

export type MainTab = 'friends' | 'threads' | 'chat' | 'analysis' | 'archive';

