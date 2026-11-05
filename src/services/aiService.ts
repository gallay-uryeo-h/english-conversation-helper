import Groq from 'groq-sdk';
import { RecommendationCard, MessageAnalysis, MessageTranslation, Message } from '../types';

export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";
export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface AssistantReplyData {
  reply: string;
  translation: MessageTranslation;
}

export interface SmartReplyItem {
  reply: string;
  translation: MessageTranslation;
}

// 메모리 캐시 (선언을 최상단으로 배치하여 TDZ ReferenceError 방지)
const translationCache = new Map<string, MessageTranslation>();
const smartRepliesCache = new Map<string, string[]>();

// 기본 스마트 빠른 답장 목록 (사전 번역 탑재)
export const DEFAULT_SMART_REPLIES: SmartReplyItem[] = [
  {
    reply: "Sounds great, what time works?",
    translation: {
      translation: "좋아요, 몇 시가 괜찮으세요?",
      keyExpressions: [{ phrase: "what time works", meaning: "몇 시가 편한가요" }]
    }
  },
  {
    reply: "I'd love to! Tell me more.",
    translation: {
      translation: "저도 정말 그러고 싶어요! 더 자세히 이야기해 주세요.",
      keyExpressions: [{ phrase: "I'd love to", meaning: "정말 그러고 싶다" }]
    }
  },
  {
    reply: "Actually, I'm a bit tied up right now.",
    translation: {
      translation: "사실은, 지금 제가 일이 좀 밀려서 바빠요.",
      keyExpressions: [{ phrase: "tied up", meaning: "바쁜, 꼼짝 못 하는" }]
    }
  }
];

// 메모리 캐시 초기값 세팅
DEFAULT_SMART_REPLIES.forEach(item => {
  translationCache.set(item.reply, item.translation);
});

// 추천 카드 정렬 기준 (Polite -> Natural -> Casual)
export const TONE_ORDER: Record<string, number> = {
  'Polite': 1,
  'Natural': 2,
  'Casual': 3
};

export const sortRecommendationsByTone = (list: RecommendationCard[]): RecommendationCard[] => {
  return [...list].sort((a, b) => (TONE_ORDER[a.tone] || 99) - (TONE_ORDER[b.tone] || 99));
};

export const getGroqApiKey = (): string => {
  return localStorage.getItem('groq_api_key') || (import.meta.env.VITE_GROQ_API_KEY as string) || "";
};

export const getGeminiApiKey = (): string => {
  // Gemini 키는 환경변수(서버 제공) 우선, 그 다음 localStorage (사용자 직접 입력)
  return (import.meta.env.VITE_GEMINI_API_KEY as string) || localStorage.getItem('gemini_api_key') || "";
};

// AI 연결 상태 타입
export type AiStatus = 'ok' | 'error' | 'none' | 'checking';

// Gemini API 연결 테스트
export const testGeminiConnection = async (): Promise<{ status: AiStatus; latencyMs?: number; error?: string }> => {
  const key = getGeminiApiKey();
  if (!key) return { status: 'none' };
  const start = Date.now();
  try {
    const res = await fetch(
      `${GEMINI_API_BASE}/${GEMINI_DEFAULT_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] })
      }
    );
    const latencyMs = Date.now() - start;
    if (res.ok) return { status: 'ok', latencyMs };
    const err = await res.json().catch(() => ({}));
    return { status: 'error', latencyMs, error: err?.error?.message || `HTTP ${res.status}` };
  } catch (e: any) {
    return { status: 'error', error: e?.message || 'Network error' };
  }
};

// Groq API 연결 테스트
export const testGroqConnection = async (): Promise<{ status: AiStatus; latencyMs?: number; error?: string }> => {
  const key = getGroqApiKey();
  if (!key) return { status: 'none' };
  const start = Date.now();
  try {
    const groq = getGroqClient(key);
    if (!groq) return { status: 'none' };
    await groq.chat.completions.create({
      model: GROQ_DEFAULT_MODEL,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5
    });
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (e: any) {
    return { status: 'error', error: e?.message || 'Network error' };
  }
};

// Groq SDK 클라이언트 생성 헬퍼
export const getGroqClient = (apiKey?: string): Groq | null => {
  const key = apiKey || getGroqApiKey();
  if (!key) return null;
  return new Groq({
    apiKey: key,
    dangerouslyAllowBrowser: true
  });
};

export const aiService = {
  // 한글 또는 영어 입력에 따른 실시간 표현 추천 카드 생성 (Gemini -> Groq -> 로컬, Polite -> Natural -> Casual 순서)
  async generateRecommendationsAsync(userInput: string): Promise<RecommendationCard[]> {
    const trimmed = userInput.trim();
    if (!trimmed) return [];

    // 1. Gemini API 우선 시도 (gemini-3.5-flash-lite 기본 모델)
    const geminiKey = getGeminiApiKey();
    if (geminiKey) {
      try {
        const prompt = `You are an expert English conversation coach and expression assistant.
The user input in the chat box is: "${trimmed}" (this may be a Korean thought/draft OR an English draft/phrase).

- If the input is in Korean: translate and adapt it into 3 natural, conversational English options.
- If the input is in English: polish, enhance, and offer 3 natural, conversational English variations/alternatives.

Strictly generate 3 distinct options in this order:
1. Polite: Professional, courteous tone
2. Natural: Common, idiomatic spoken English
3. Casual: Friendly, relaxed tone for friends

Respond ONLY with a valid JSON object with key "options" containing an array of objects with keys:
- tone ("Polite" | "Natural" | "Casual")
- english (string - the natural conversational English option)
- koreanMeaning (brief 1-line Korean explanation of the tone/nuance)
- grammarTip (optional 1-line vocabulary, idiom, or phrasing tip)`;

        const res = await fetch(`${GEMINI_API_BASE}/${GEMINI_DEFAULT_MODEL}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            const list = Array.isArray(parsed) ? parsed : (parsed.options || parsed.recommendations || []);
            if (Array.isArray(list) && list.length > 0) {
              const mapped = list.map((item: any, idx: number) => ({
                id: `rec-gemini-${Date.now()}-${idx}`,
                tone: (item.tone || 'Polite') as any,
                english: item.english,
                koreanMeaning: item.koreanMeaning || '',
                grammarTip: item.grammarTip || ''
              }));
              return sortRecommendationsByTone(mapped);
            }
          }
        }
      } catch (e) {
        console.warn("Gemini recommendation error, trying Groq fallback:", e);
      }
    }

    // 2. Groq SDK 보조 시도 (openai/gpt-oss-120b 모델)
    const groqKey = getGroqApiKey();
    if (groqKey) {
      try {
        const groq = getGroqClient(groqKey);
        if (groq) {
          const prompt = `You are an expert English conversation coach.
User input: "${trimmed}" (may be Korean draft or English draft).
- If Korean: translate into 3 conversational English options.
- If English: polish and offer 3 natural conversational variations.

Strictly generate 3 distinct options in this order:
1. Polite: Courteous tone
2. Natural: Common, idiomatic spoken English
3. Casual: Friendly, relaxed tone for friends

Respond ONLY with a JSON object format:
{
  "options": [
    {
      "tone": "Polite" | "Natural" | "Casual",
      "english": "...",
      "koreanMeaning": "brief 1-line Korean nuance explanation",
      "grammarTip": "brief 1-line idiom/grammar tip"
    }
  ]
}`;

          const chatCompletion = await groq.chat.completions.create({
            model: GROQ_DEFAULT_MODEL,
            messages: [
              {
                role: "system",
                content: "You are an expert English conversation coach. Always output strictly valid JSON."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.6,
            max_tokens: 600
          });

          const content = chatCompletion.choices[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const list = Array.isArray(parsed) ? parsed : (parsed.options || parsed.recommendations || []);
            if (Array.isArray(list) && list.length > 0) {
              const mapped = list.map((item: any, idx: number) => ({
                id: `rec-groq-${Date.now()}-${idx}`,
                tone: (item.tone || 'Polite') as any,
                english: item.english,
                koreanMeaning: item.koreanMeaning || '',
                grammarTip: item.grammarTip || ''
              }));
              return sortRecommendationsByTone(mapped);
            }
          }
        }
      } catch (e) {
        console.warn("Groq SDK recommendation error, using local fallback:", e);
      }
    }

    // 3. 로컬 지능형 추천 엔진 (오프라인 / 키 미설정 시)
    return this.generateRecommendations(trimmed);
  },

  // 동기식 실시간 영어 변환 추천 카드 (Polite -> Natural -> Casual 순서)
  generateRecommendations(koreanInput: string): RecommendationCard[] {
    const trimmed = koreanInput.trim();
    if (!trimmed) return [];

    if (trimmed.includes('비') || trimmed.includes('우산') || trimmed.includes('젖')) {
      return [
        {
          id: 'rec-1',
          tone: 'Polite',
          english: "I got caught in the rain without an umbrella, but having some warm noodles made it much better.",
          koreanMeaning: "공손하고 정중한 어조",
          grammarTip: "got caught in the rain = 갑작스런 비를 만나다"
        },
        {
          id: 'rec-2',
          tone: 'Natural',
          english: "I forgot my umbrella and got totally soaked, but warm noodles cheered me right up!",
          koreanMeaning: "자연스러운 일상 구어체",
          grammarTip: "get soaked = 흠뻑 젖다 / cheer up = 기운을 북돋우다"
        },
        {
          id: 'rec-3',
          tone: 'Casual',
          english: "No umbrella, so I got completely drenched! Hot soup definitely saved the day though.",
          koreanMeaning: "친구와의 편안한 대화",
          grammarTip: "save the day = 위기를 구하다, 기분을 살리다"
        }
      ];
    }

    if (trimmed.includes('커피') || trimmed.includes('카페') || trimmed.includes('만나')) {
      return [
        {
          id: 'rec-1',
          tone: 'Polite',
          english: "Would you have time for a brief coffee chat whenever convenient?",
          koreanMeaning: "정중한 티타임 제안",
          grammarTip: "whenever convenient = 편하신 때에"
        },
        {
          id: 'rec-2',
          tone: 'Natural',
          english: "Let's grab a coffee and catch up whenever you get a chance!",
          koreanMeaning: "안부 나눌 때 쓰는 가장 자연스러운 표현",
          grammarTip: "catch up = 밀린 이야기를 나누다"
        },
        {
          id: 'rec-3',
          tone: 'Casual',
          english: "Are you free for a quick coffee break sometime this afternoon?",
          koreanMeaning: "가벼운 티타임 제안",
          grammarTip: "free for ~ = ~할 시간 되다"
        }
      ];
    }

    if (trimmed.includes('회의') || trimmed.includes('일정') || trimmed.includes('시간') || trimmed.includes('약속')) {
      return [
        {
          id: 'rec-1',
          tone: 'Polite',
          english: "Could we reschedule our meeting to later this week if possible?",
          koreanMeaning: "정중한 일정 변경 요청",
          grammarTip: "reschedule to ~ = ~로 일정을 변경하다"
        },
        {
          id: 'rec-2',
          tone: 'Natural',
          english: "Let me know what time works best for you, and I'll adjust my schedule.",
          koreanMeaning: "상대방의 편한 시간을 묻는 매끄러운 표현",
          grammarTip: "works best for you = 가장 편한 시간이다"
        },
        {
          id: 'rec-3',
          tone: 'Casual',
          english: "Can we push our chat back a bit? Let me know when you're free!",
          koreanMeaning: "편하게 일정을 늦추는 표현",
          grammarTip: "push back = 일정을 뒤로 미루다"
        }
      ];
    }

    if (trimmed.includes('안녕') || trimmed.includes('반가') || trimmed.includes('처음')) {
      return [
        {
          id: 'rec-1',
          tone: 'Polite',
          english: "Hello! It is truly a pleasure to connect with you. How have you been?",
          koreanMeaning: "정중한 첫인사 및 안부",
          grammarTip: "a pleasure to connect with you = 만나 뵙게 되어 기쁩니다"
        },
        {
          id: 'rec-2',
          tone: 'Natural',
          english: "Hi! It's so great to connect with you. How is your day going?",
          koreanMeaning: "친근하고 따뜻한 인사",
          grammarTip: "great to connect with you = 만나서 반가워요"
        },
        {
          id: 'rec-3',
          tone: 'Casual',
          english: "Hey there! How have things been on your end lately?",
          koreanMeaning: "요즘 어떻게 지내는지 가볍게 묻는 안부",
          grammarTip: "on your end = 너 쪽에서는, 너는"
        }
      ];
    }

    // 일반적 기본 구문 (Polite -> Natural -> Casual)
    return [
      {
        id: 'rec-gen-1',
        tone: 'Polite',
        english: `I would like to share this thought with you: "${trimmed}".`,
        koreanMeaning: "정중하게 화제를 공유하는 표현",
        grammarTip: "I would like to ~ = ~하고 싶습니다"
      },
      {
        id: 'rec-gen-2',
        tone: 'Natural',
        english: `I was thinking about "${trimmed}". What do you think about that?`,
        koreanMeaning: "상대방의 의견을 묻는 자연스러운 구어 표현",
        grammarTip: "what do you think about ~ = ~에 대해 어떻게 생각해?"
      },
      {
        id: 'rec-gen-3',
        tone: 'Casual',
        english: `Just wanted to share that ${trimmed}! How about you?`,
        koreanMeaning: "가벼운 생각 공유와 질문",
        grammarTip: "how about you = 너는 어때?"
      }
    ];
  },

  // 메시지에 대한 심화 언어 분석 결과 생성 (Gemini -> Groq -> 로컬)
  async analyzeMessageAsync(englishText: string, koreanDraft?: string): Promise<MessageAnalysis> {
    const analyzePrompt = `Analyze this spoken English sentence from a Korean language learner:
"${englishText}"
${koreanDraft ? `Learner's intended Korean meaning: "${koreanDraft}"` : ''}

Provide a constructive, encouraging evaluation in JSON format with:
- grammarScore (number from 75 to 100)
- fluencyScore (number from 75 to 100)
- improvedVersion (string: more natural, idiomatic phrasing)
- explanation (string in Korean: 1-2 friendly sentences explaining nuance and tips)
- keyVocabulary (array of 2-3 objects: {"word": string, "meaning": string in Korean, "phonetic": string optional})

Respond ONLY with valid JSON.`;

    // 1. Gemini 우선
    const geminiKey = getGeminiApiKey();
    if (geminiKey) {
      try {
        const res = await fetch(`${GEMINI_API_BASE}/${GEMINI_DEFAULT_MODEL}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: analyzePrompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            if (parsed.grammarScore && parsed.improvedVersion) {
              return {
                grammarScore: parsed.grammarScore,
                fluencyScore: parsed.fluencyScore || 90,
                improvedVersion: parsed.improvedVersion,
                explanation: parsed.explanation || '',
                keyVocabulary: parsed.keyVocabulary || []
              };
            }
          }
        }
      } catch (e) {
        console.warn("Gemini analysis error, trying Groq fallback:", e);
      }
    }

    // 2. Groq 보조
    const groqKey = getGroqApiKey();
    if (groqKey) {
      try {
        const groq = getGroqClient(groqKey);
        if (groq) {
          const chatCompletion = await groq.chat.completions.create({
            model: GROQ_DEFAULT_MODEL,
            messages: [
              { role: "system", content: "You are an encouraging native English evaluator. Always output valid JSON." },
              { role: "user", content: analyzePrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.5,
            max_tokens: 500
          });
          const content = chatCompletion.choices[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed.grammarScore && parsed.improvedVersion) {
              return {
                grammarScore: parsed.grammarScore,
                fluencyScore: parsed.fluencyScore || 90,
                improvedVersion: parsed.improvedVersion,
                explanation: parsed.explanation || '',
                keyVocabulary: parsed.keyVocabulary || []
              };
            }
          }
        }
      } catch (e) {
        console.warn("Groq SDK analysis error, fallback to local:", e);
      }
    }

    return this.analyzeMessage(englishText, koreanDraft);
  },

  // 로컬 언어 분석 (오프라인 / 키 미설정)
  analyzeMessage(englishText: string, koreanDraft?: string): MessageAnalysis {
    const tipPrefix = koreanDraft ? `입력하신 의도("${koreanDraft}")가 ` : '';
    const wordCount = englishText.trim().split(/\s+/).length;
    const grammarScore = Math.min(98, Math.max(82, 85 + (wordCount > 5 ? 7 : 2)));
    const fluencyScore = Math.min(97, Math.max(80, 84 + (wordCount > 7 ? 8 : 3)));

    return {
      grammarScore,
      fluencyScore,
      improvedVersion: englishText.includes('very good')
        ? englishText.replace(/very good/gi, 'truly fantastic')
        : englishText.includes('happy')
          ? englishText.replace(/happy/gi, 'thrilled')
          : englishText,
      explanation: `${tipPrefix}문장의 시제와 전달력이 우수합니다. 일상 대화에서는 'very' 대신 'completely', 'absolutely' 같은 부사를 곁들이면 훨씬 더 원어민스럽게 들립니다.`,
      keyVocabulary: [
        { word: "turn around", meaning: "상황이나 기분을 반전시키다", phonetic: "/tɜːrn əˈraʊnd/" },
        { word: "spontaneous", meaning: "자연스러운, 즉흥적인", phonetic: "/spɑːnˈteɪ.ni.əs/" },
        { word: "catch up", meaning: "밀린 이야기를 나누다", phonetic: "/kætʃ ʌp/" }
      ]
    };
  },

  // AI 파트너의 실시간 답변 및 한국어 해석/핵심표현 일괄 생성 (Gemini -> Groq -> 로컬 규칙)
  async generateAssistantReplyAsync(partnerName: string, userText: string): Promise<AssistantReplyData> {
    const prompt = `You are ${partnerName}, a close friend having an English conversation with the user.
The user said to you in English: "${userText}"

Generate a natural conversational response in English (1 to 2 sentences with a warm follow-up question), AND provide its natural Korean translation and 1 to 2 key expressions.

Respond ONLY with valid JSON:
{
  "reply": "English spoken response (1-2 sentences)",
  "translation": "자연스러운 한국어 해석",
  "keyExpressions": [
    { "phrase": "key idiom or word in English", "meaning": "한국어 의미" }
  ]
}`;

    // 1. Gemini API 우선 (gemini-3.5-flash-lite)
    const geminiKey = getGeminiApiKey();
    if (geminiKey) {
      try {
        const res = await fetch(`${GEMINI_API_BASE}/${GEMINI_DEFAULT_MODEL}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            if (parsed.reply) {
              const result: AssistantReplyData = {
                reply: parsed.reply.trim(),
                translation: {
                  translation: parsed.translation || '',
                  keyExpressions: Array.isArray(parsed.keyExpressions) ? parsed.keyExpressions : []
                }
              };
              translationCache.set(result.reply, result.translation);
              return result;
            }
          }
        }
      } catch (e) {
        console.warn("Gemini reply error, trying Groq fallback:", e);
      }
    }

    // 2. Groq SDK 보조 (openai/gpt-oss-120b 모델)
    const groqKey = getGroqApiKey();
    if (groqKey) {
      try {
        const groq = getGroqClient(groqKey);
        if (groq) {
          const chatCompletion = await groq.chat.completions.create({
            model: GROQ_DEFAULT_MODEL,
            messages: [
              {
                role: "system",
                content: "You are an English conversation partner and language coach. Always output strictly valid JSON."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 300
          });

          const content = chatCompletion.choices[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed.reply) {
              const result: AssistantReplyData = {
                reply: parsed.reply.trim(),
                translation: {
                  translation: parsed.translation || '',
                  keyExpressions: Array.isArray(parsed.keyExpressions) ? parsed.keyExpressions : []
                }
              };
              translationCache.set(result.reply, result.translation);
              return result;
            }
          }
        }
      } catch (e) {
        console.warn("Groq SDK reply error, fallback to local:", e);
      }
    }

    // 3. 로컬 답장 생성
    return this.generateAssistantReply(partnerName, userText);
  },

  // AI 상대방의 자연스러운 답장 및 사전 해석 생성 (로컬 규칙)
  generateAssistantReply(partnerName: string, userText: string): AssistantReplyData {
    const textLower = userText.toLowerCase();

    if (textLower.includes('ramen') || textLower.includes('noodle') || textLower.includes('rain') || textLower.includes('umbrella')) {
      const res: AssistantReplyData = {
        reply: `Haha, honestly nothing beats a steaming bowl of noodles after getting caught in the chilly rain! 🍜 Did you try a new spot or your favorite place?`,
        translation: {
          translation: `하하, 쌀쌀한 비를 맞고 나서는 뜨끈한 국수 한 그릇만 한 게 없죠! 🍜 새로운 식당에 가보셨나요, 아니면 자주 가시던 단골집인가요?`,
          keyExpressions: [
            { phrase: "nothing beats ~", meaning: "~만 한 게 없다, 최고다" },
            { phrase: "get caught in the rain", meaning: "갑작스러운 비를 만나다" }
          ]
        }
      };
      translationCache.set(res.reply, res.translation);
      return res;
    }

    if (textLower.includes('coffee') || textLower.includes('cafe') || textLower.includes('tea')) {
      const res: AssistantReplyData = {
        reply: `A coffee break sounds wonderful! ☕ There's a cozy new cafe with great pastries nearby. What time works best for you?`,
        translation: {
          translation: `커피 한 잔 너무 좋죠! ☕ 근처에 맛있는 디저트가 있는 아늑한 신상 카페가 있어요. 몇 시가 가장 편하세요?`,
          keyExpressions: [
            { phrase: "sounds wonderful", meaning: "정말 좋다, 듣던 중 반가운 소리다" },
            { phrase: "works best for you", meaning: "너에게 가장 편하다" }
          ]
        }
      };
      translationCache.set(res.reply, res.translation);
      return res;
    }

    if (textLower.includes('hello') || textLower.includes('hi') || textLower.includes('hey')) {
      const res: AssistantReplyData = {
        reply: `Hey there! It's great to hear from you. How has your day been treating you so far?`,
        translation: {
          translation: `안녕! 연락 줘서 반가워요. 오늘 하루는 어떻게 보내고 계신가요?`,
          keyExpressions: [
            { phrase: "great to hear from you", meaning: "연락 줘서 반갑다" },
            { phrase: "so far", meaning: "지금까지, 여태까지" }
          ]
        }
      };
      translationCache.set(res.reply, res.translation);
      return res;
    }

    if (textLower.includes('tired') || textLower.includes('exhausted') || textLower.includes('busy')) {
      const res: AssistantReplyData = {
        reply: `Oh, take care of yourself! Sounds like you've been working really hard. Do you have any relaxing plans for tonight?`,
        translation: {
          translation: `어휴, 몸 잘 챙기세요! 정말 열심히 일하셨나 봐요. 오늘 밤엔 편하게 쉴 계획이 있으신가요?`,
          keyExpressions: [
            { phrase: "take care of yourself", meaning: "몸조심하다, 무리하지 않다" },
            { phrase: "relaxing plans", meaning: "편안한 휴식 계획" }
          ]
        }
      };
      translationCache.set(res.reply, res.translation);
      return res;
    }

    const def: AssistantReplyData = {
      reply: `That makes so much sense! I really appreciate you sharing that. What's on your mind right now?`,
      translation: {
        translation: `정말 공감돼요! 이야기해 줘서 고마워요. 지금 어떤 생각하고 계신가요?`,
        keyExpressions: [
          { phrase: "makes so much sense", meaning: "완전 이해되다, 정말 공감되다" },
          { phrase: "on your mind", meaning: "마음에 두고 있는, 생각 중인" }
        ]
      }
    };
    translationCache.set(def.reply, def.translation);
    return def;
  },

  // 말풍선 한국어 해석 및 핵심 표현 아코디언 제공 (Gemini -> Groq -> 캐싱)
  async translateMessageAsync(englishText: string): Promise<MessageTranslation> {
    const trimmed = englishText.trim();
    if (!trimmed) return { translation: '', keyExpressions: [] };

    // 메모리 캐시 확인
    if (translationCache.has(trimmed)) {
      return translationCache.get(trimmed)!;
    }

    const prompt = `Translate this conversational English message into natural Korean, and identify 1 to 3 key expressions/idioms with their meanings:
"${trimmed}"

Respond ONLY with valid JSON:
{
  "translation": "자연스러운 한국어 해석 1~2문장",
  "keyExpressions": [
    { "phrase": "key idiom or word in English", "meaning": "한국어 의미" }
  ]
}`;

    // 1. Gemini
    const geminiKey = getGeminiApiKey();
    if (geminiKey) {
      try {
        const res = await fetch(`${GEMINI_API_BASE}/${GEMINI_DEFAULT_MODEL}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            const result: MessageTranslation = {
              translation: parsed.translation || '',
              keyExpressions: Array.isArray(parsed.keyExpressions) ? parsed.keyExpressions : []
            };
            translationCache.set(trimmed, result);
            return result;
          }
        }
      } catch (e) {
        console.warn("Gemini translateMessage error, trying Groq fallback:", e);
      }
    }

    // 2. Groq
    const groqKey = getGroqApiKey();
    if (groqKey) {
      try {
        const groq = getGroqClient(groqKey);
        if (groq) {
          const chat = await groq.chat.completions.create({
            model: GROQ_DEFAULT_MODEL,
            messages: [
              { role: "system", content: "You are a professional English-Korean translator. Output strictly valid JSON." },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 350
          });
          const content = chat.choices[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const result: MessageTranslation = {
              translation: parsed.translation || '',
              keyExpressions: Array.isArray(parsed.keyExpressions) ? parsed.keyExpressions : []
            };
            translationCache.set(trimmed, result);
            return result;
          }
        }
      } catch (e) {
        console.warn("Groq translateMessage error:", e);
      }
    }

    // 3. 로컬 기본 처리
    const fallback: MessageTranslation = {
      translation: "번역 정보를 불러올 수 없습니다. 인터넷 및 AI 키 설정을 확인하세요.",
      keyExpressions: []
    };
    return fallback;
  },

  // 대화 흐름 기반 빠른 답장(Smart Replies) 및 한국어 해석/핵심표현 동시 일괄 생성
  async generateSmartRepliesAsync(messages: Message[], partnerName: string): Promise<SmartReplyItem[]> {
    if (!messages || messages.length === 0) return DEFAULT_SMART_REPLIES;

    const recent = messages.slice(-4);
    const lastMsg = recent[recent.length - 1];
    const cacheKey = `${partnerName}_${lastMsg.text}`;
    if (smartRepliesCache.has(cacheKey)) {
      const cachedList = smartRepliesCache.get(cacheKey)!;
      // translationCache에서 완전한 SmartReplyItem 복원
      return cachedList.map(text => ({
        reply: text,
        translation: translationCache.get(text) || { translation: text, keyExpressions: [] }
      }));
    }

    const contextText = recent.map(m => `${m.sender === 'user' ? 'Me' : partnerName}: "${m.text}"`).join('\n');
    const prompt = `Based on this recent English conversation:
${contextText}

Generate 3 natural, conversational, short reply suggestions for 'Me' to reply to '${partnerName}' (3 to 7 words each).
For EACH reply, provide its natural Korean translation and 1 key expression/idiom.

Respond ONLY with valid JSON:
{
  "replies": [
    {
      "reply": "English reply (3-7 words)",
      "translation": "자연스러운 한국어 해석",
      "keyExpressions": [
        { "phrase": "key idiom or word", "meaning": "한국어 의미" }
      ]
    }
  ]
}`;

    // 1. Gemini
    const geminiKey = getGeminiApiKey();
    if (geminiKey) {
      try {
        const res = await fetch(`${GEMINI_API_BASE}/${GEMINI_DEFAULT_MODEL}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed.replies) && parsed.replies.length > 0) {
              const list: SmartReplyItem[] = parsed.replies.slice(0, 3).map((item: any) => {
                const reply = typeof item === 'string' ? item : item.reply;
                const translation: MessageTranslation = typeof item === 'object' && item.translation ? {
                  translation: item.translation,
                  keyExpressions: Array.isArray(item.keyExpressions) ? item.keyExpressions : []
                } : {
                  translation: reply,
                  keyExpressions: []
                };
                // 번역 공용 캐시에 즉시 저장
                translationCache.set(reply, translation);
                return { reply, translation };
              });

              smartRepliesCache.set(cacheKey, list.map(item => item.reply));
              return list;
            }
          }
        }
      } catch (e) {
        console.warn("Gemini generateSmartReplies error, trying Groq fallback:", e);
      }
    }

    // 2. Groq
    const groqKey = getGroqApiKey();
    if (groqKey) {
      try {
        const groq = getGroqClient(groqKey);
        if (groq) {
          const chat = await groq.chat.completions.create({
            model: GROQ_DEFAULT_MODEL,
            messages: [
              { role: "system", content: "You generate quick conversational smart reply chips with Korean translations. Output JSON." },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.6,
            max_tokens: 300
          });
          const content = chat.choices[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed.replies) && parsed.replies.length > 0) {
              const list: SmartReplyItem[] = parsed.replies.slice(0, 3).map((item: any) => {
                const reply = typeof item === 'string' ? item : item.reply;
                const translation: MessageTranslation = typeof item === 'object' && item.translation ? {
                  translation: item.translation,
                  keyExpressions: Array.isArray(item.keyExpressions) ? item.keyExpressions : []
                } : {
                  translation: reply,
                  keyExpressions: []
                };
                translationCache.set(reply, translation);
                return { reply, translation };
              });

              smartRepliesCache.set(cacheKey, list.map(item => item.reply));
              return list;
            }
          }
        }
      } catch (e) {
        console.warn("Groq generateSmartReplies error:", e);
      }
    }

    return DEFAULT_SMART_REPLIES;
  }
};
