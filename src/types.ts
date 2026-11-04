export interface Thread {
  id: string;
  partnerName: string;
  avatarBg: string;
  avatarText: string;
  lastMessage: string;
  updatedAt: number;
  messageCount?: number;
  lastSender?: 'user' | 'assistant';
  title?: string;
  partnerRole?: string;
  unreadCount?: number;
  isFavorite?: boolean;
  category?: string;
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
  translation?: string;
}

export interface MessageTranslation {
  translation: string;
  keyExpressions: Array<{ phrase: string; meaning: string }>;
}

export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  koreanDraft?: string;
  timestamp: number;
  recommendations?: RecommendationCard[];
  analysis?: MessageAnalysis;
  translation?: MessageTranslation;
}

export interface SavedExpression {
  id: string;
  english: string;
  korean: string;
  exampleSentence: string;
  situation?: string;
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
  level: string;
  targetExpression: string;
  dialogue: ScriptDialogueLine[];
  createdAt: number;
  situation?: string;
}

export interface Friend {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  role?: string;
  avatarBg: string;
  avatarText: string;
  isAi?: boolean;
}

export interface GroupMember {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
  avatarBg: string;
  avatarText: string;
  isAi?: boolean;
}

export type MainTab = 'friends' | 'threads' | 'chat' | 'analysis' | 'archive';
