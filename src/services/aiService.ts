import { RecommendationCard, MessageAnalysis } from '../types';

export const getGroqApiKey = (): string => {
  return localStorage.getItem('groq_api_key') || (import.meta.env.VITE_GROQ_API_KEY as string) || "";
};

export const getGeminiApiKey = (): string => {
  return localStorage.getItem('gemini_api_key') || (import.meta.env.VITE_GEMINI_API_KEY as string) || "";
};

export const aiService = {
  // 한글 입력에 따른 실시간 영어 변환 추천 카드 생성 (Groq -> Gemini -> 로컬 패턴)
  async generateRecommendationsAsync(koreanInput: string): Promise<RecommendationCard[]> {
    const trimmed = koreanInput.trim();
    if (!trimmed) return [];

    // 1. Groq API 우선 시도 (초고속 Llama 3.3 70B)
    const groqKey = getGroqApiKey();
    if (groqKey) {
      try {
        const prompt = `Translate and adapt this Korean sentence/thought into 3 distinct English conversation options:
1. Natural: Common, idiomatic spoken English
2. Casual: Friendly, relaxed tone for friends
3. Polite: Courteous tone

Korean input: "${trimmed}"

Respond ONLY with a JSON object format:
{
  "options": [
    {
      "tone": "Natural" | "Casual" | "Polite",
      "english": "...",
      "koreanMeaning": "brief 1-line Korean nuance explanation",
      "grammarTip": "brief 1-line idiom/grammar tip"
    }
  ]
}`;

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
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
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const list = Array.isArray(parsed) ? parsed : (parsed.options || parsed.recommendations || []);
            if (Array.isArray(list) && list.length > 0) {
              return list.map((item: any, idx: number) => ({
                id: `rec-groq-${Date.now()}-${idx}`,
                tone: item.tone || 'Natural',
                english: item.english,
                koreanMeaning: item.koreanMeaning || '',
                grammarTip: item.grammarTip || ''
              }));
            }
          }
        }
      } catch (e) {
        console.warn("Groq recommendation error, trying fallback:", e);
      }
    }

    // 2. Gemini API 보조 시도
    const geminiKey = getGeminiApiKey();
    if (geminiKey) {
      try {
        const prompt = `You are a real-time English conversation assistant. 
Translate and adapt the following Korean thought/draft into 3 distinct English conversation options:
1. Natural: Common, idiomatic spoken English
2. Casual: Friendly, relaxed tone for friends
3. Polite or Business: Professional or courteous tone

Korean input: "${trimmed}"

Respond ONLY with a valid JSON array of objects with keys:
- tone ("Natural" | "Casual" | "Polite")
- english (string)
- koreanMeaning (brief 1-line Korean explanation of the tone/nuance)
- grammarTip (optional 1-line vocabulary or idiom tip)`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
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
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed.map((item, idx) => ({
                id: `rec-ai-${Date.now()}-${idx}`,
                tone: item.tone || 'Natural',
                english: item.english,
                koreanMeaning: item.koreanMeaning || '',
                grammarTip: item.grammarTip || ''
              }));
            }
          }
        }
      } catch (e) {
        console.warn("Gemini translation error, using local fallback:", e);
      }
    }

    // 3. 로컬 지능형 추천 엔진 (오프라인 / 키 미설정 시)
    return this.generateRecommendations(trimmed);
  },

  // 동기식 실시간 영어 변환 추천 카드 (입력 즉시 반응)
  generateRecommendations(koreanInput: string): RecommendationCard[] {
    const trimmed = koreanInput.trim();
    if (!trimmed) return [];

    if (trimmed.includes('비') || trimmed.includes('우산') || trimmed.includes('젖')) {
      return [
        {
          id: 'rec-1',
          tone: 'Natural',
          english: "I forgot my umbrella and got totally soaked, but warm noodles cheered me right up!",
          koreanMeaning: "자연스러운 일상 구어체 (감정 표현)",
          grammarTip: "get soaked = 흠뻑 젖다 / cheer up = 기운을 북돋우다"
        },
        {
          id: 'rec-2',
          tone: 'Casual',
          english: "No umbrella, so I got completely drenched! Hot soup definitely saved the day though.",
          koreanMeaning: "친구와의 편안한 대화",
          grammarTip: "save the day = 위기를 구하다, 기분을 살리다"
        },
        {
          id: 'rec-3',
          tone: 'Polite',
          english: "I got caught in the rain without an umbrella, but having some hot noodles made it much better.",
          koreanMeaning: "공손하고 정중한 어조",
          grammarTip: "got caught in the rain = 갑작스런 비를 만나다"
        }
      ];
    }

    if (trimmed.includes('커피') || trimmed.includes('카페') || trimmed.includes('만나')) {
      return [
        {
          id: 'rec-1',
          tone: 'Casual',
          english: "Are you free for a quick coffee break sometime this afternoon?",
          koreanMeaning: "가벼운 티타임 제안",
          grammarTip: "free for ~ = ~할 시간 되다"
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
          tone: 'Polite',
          english: "Would you have time for a brief coffee chat whenever convenient?",
          koreanMeaning: "정중한 티타임 제안",
          grammarTip: "whenever convenient = 편하신 때에"
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
        }
      ];
    }

    if (trimmed.includes('안녕') || trimmed.includes('반가') || trimmed.includes('처음')) {
      return [
        {
          id: 'rec-1',
          tone: 'Natural',
          english: "Hi! It's so great to connect with you. How is your day going?",
          koreanMeaning: "친근하고 따뜻한 첫인사",
          grammarTip: "great to connect with you = 만나서 반가워요"
        },
        {
          id: 'rec-2',
          tone: 'Casual',
          english: "Hey there! How have things been on your end lately?",
          koreanMeaning: "요즘 어떻게 지내는지 가볍게 묻는 안부",
          grammarTip: "on your end = 너 쪽에서는, 너는"
        }
      ];
    }

    if (trimmed.includes('피곤') || trimmed.includes('힘들') || trimmed.includes('쉬')) {
      return [
        {
          id: 'rec-1',
          tone: 'Casual',
          english: "It has been such an exhausting day, I just need to crash on the couch.",
          koreanMeaning: "피로감을 솔직하게 털어놓는 구어체",
          grammarTip: "crash on the couch = 소파에 쓰러져 쉬다/자다"
        },
        {
          id: 'rec-2',
          tone: 'Natural',
          english: "I'm feeling pretty worn out today. Hoping to unwind with some good rest tonight.",
          koreanMeaning: "자연스럽게 휴식을 취하고 싶다는 표현",
          grammarTip: "worn out = 지친 / unwind = 긴장을 풀다"
        }
      ];
    }

    // 일반적 기본 구문
    return [
      {
        id: 'rec-gen-1',
        tone: 'Natural',
        english: `I was thinking about "${trimmed}". What do you think about that?`,
        koreanMeaning: "상대방의 의견을 묻는 자연스러운 구어 표현",
        grammarTip: "what do you think about ~ = ~에 대해 어떻게 생각해?"
      },
      {
        id: 'rec-gen-2',
        tone: 'Casual',
        english: `Just wanted to share that ${trimmed}! How about you?`,
        koreanMeaning: "가벼운 생각 공유와 상대방 질문",
        grammarTip: "how about you = 너는 어때?"
      },
      {
        id: 'rec-gen-3',
        tone: 'Polite',
        english: `I'd like to share this with you: "${trimmed}".`,
        koreanMeaning: "정중하게 화제를 공유하는 표현",
        grammarTip: "I'd like to ~ = ~하고 싶습니다"
      }
    ];
  },

  // 메시지에 대한 심화 언어 분석 결과 생성 (Groq -> 로컬)
  async analyzeMessageAsync(englishText: string, koreanDraft?: string): Promise<MessageAnalysis> {
    const groqKey = getGroqApiKey();
    if (groqKey) {
      try {
        const prompt = `Analyze this spoken English sentence from a Korean language learner:
"${englishText}"
${koreanDraft ? `Learner's intended Korean meaning: "${koreanDraft}"` : ''}

Provide a constructive, encouraging evaluation in JSON format with:
- grammarScore (number from 75 to 100)
- fluencyScore (number from 75 to 100)
- improvedVersion (string: more natural, idiomatic phrasing)
- explanation (string in Korean: 1-2 friendly sentences explaining nuance and tips)
- keyVocabulary (array of 2-3 objects: {"word": string, "meaning": string in Korean, "phonetic": string optional})

Respond ONLY with valid JSON.`;

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: "You are an encouraging native English evaluator. Always output valid JSON."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.5,
            max_tokens: 500
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
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
        console.warn("Groq analysis error, fallback to local:", e);
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

  // AI 파트너의 실시간 답변 생성 (Groq -> Gemini -> 로컬 규칙)
  async generateAssistantReplyAsync(partnerName: string, userText: string): Promise<string> {
    // 1. Groq API 우선 (초고속 Llama 3.3 70B)
    const groqKey = getGroqApiKey();
    if (groqKey) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `You are ${partnerName}, a close friend having an English conversation with the user. Reply warmly, naturally, and concisely (1 to 2 sentences in authentic spoken English). Ask a friendly follow-up question to keep the chat going smoothly.`
              },
              {
                role: "user",
                content: userText
              }
            ],
            temperature: 0.7,
            max_tokens: 150
          })
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content;
          if (reply) return reply.trim();
        }
      } catch (e) {
        console.warn("Groq reply error, trying Gemini fallback:", e);
      }
    }

    // 2. Gemini API 보조
    const geminiKey = getGeminiApiKey();
    if (geminiKey) {
      try {
        const prompt = `You are ${partnerName}, an English conversation partner for a friendly English learner.
The user said to you in English: "${userText}"

Reply naturally, warmly, and concisely (1 to 2 sentences in conversational spoken English).
Ask a friendly follow-up question to keep the chat going smoothly.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) return reply.trim();
        }
      } catch (e) {
        console.warn("Gemini reply error, fallback to local:", e);
      }
    }

    // 3. 로컬 답장 생성
    return this.generateAssistantReply(partnerName, userText);
  },

  // AI 상대방의 자연스러운 답장 생성 (로컬 규칙)
  generateAssistantReply(partnerName: string, userText: string): string {
    const textLower = userText.toLowerCase();

    if (textLower.includes('ramen') || textLower.includes('noodle') || textLower.includes('rain') || textLower.includes('umbrella')) {
      return `Haha, honestly nothing beats a steaming bowl of noodles after getting caught in the chilly rain! 🍜 Did you try a new spot or your favorite place?`;
    }
    if (textLower.includes('coffee') || textLower.includes('cafe') || textLower.includes('tea')) {
      return `A coffee break sounds wonderful! ☕ There's a cozy new cafe with great pastries nearby. What time works best for you?`;
    }
    if (textLower.includes('hello') || textLower.includes('hi') || textLower.includes('hey')) {
      return `Hey there! It's great to hear from you. How has your day been treating you so far?`;
    }
    if (textLower.includes('tired') || textLower.includes('exhausted') || textLower.includes('busy')) {
      return `Oh, take care of yourself! Sounds like you've been working really hard. Do you have any relaxing plans for tonight?`;
    }

    return `That makes so much sense! I really appreciate you sharing that. What's on your mind right now?`;
  }
};
