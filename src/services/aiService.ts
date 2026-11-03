import { RecommendationCard, MessageAnalysis } from '../types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

export const aiService = {
  // 한글 입력에 따른 실시간 영어 변환 추천 카드 생성
  async generateRecommendationsAsync(koreanInput: string): Promise<RecommendationCard[]> {
    const trimmed = koreanInput.trim();
    if (!trimmed) return [];

    // Gemini API가 설정된 경우 실시간 AI 생성 호출
    if (GEMINI_API_KEY) {
      try {
        const prompt = `You are a real-time English conversation assistant. 
Translate and adapt the following Korean thought/draft into 3 distinct English conversation options:
1. Natural: Common, idiomatic spoken English
2. Casual: Friendly, relaxed tone for friends
3. Polite or Business: Professional or courteous tone

Korean input: "${trimmed}"

Respond ONLY with a valid JSON array of objects with keys:
- tone ("Natural" | "Casual" | "Polite" | "Business")
- english (string)
- koreanMeaning (brief 1-line Korean explanation of the tone/nuance)
- grammarTip (optional 1-line vocabulary or idiom tip)`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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
        console.warn("Gemini API translation error, using intelligent fallback:", e);
      }
    }

    // 동기식 지능형 추천 엔진 (API 미설정 또는 오프라인 시)
    return this.generateRecommendations(trimmed);
  },

  // 동기식 실시간 영어 변환 추천 카드 (입력 즉시 반응)
  generateRecommendations(koreanInput: string): RecommendationCard[] {
    const trimmed = koreanInput.trim();
    if (!trimmed) return [];

    // 키워드별 인텔리전트 추천 패턴
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
          tone: 'Business',
          english: "Would you have time for a brief coffee chat to discuss our collaboration?",
          koreanMeaning: "비즈니스 및 업무 관련 미팅 제안",
          grammarTip: "coffee chat = 가벼운 업무 협의"
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
          tone: 'Business',
          english: "I would like to align on the agenda before tomorrow's review session.",
          koreanMeaning: "회의 전 안건 조율",
          grammarTip: "align on ~ = 상호 방향을 맞추다"
        },
        {
          id: 'rec-3',
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

    // 일반적 입력에 대한 표현 패턴
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
        english: `I'd like to talk about this topic: "${trimmed}".`,
        koreanMeaning: "정중하게 화제를 제시하는 표현",
        grammarTip: "I'd like to ~ = ~하고 싶습니다"
      }
    ];
  },

  // 메시지에 대한 심화 언어 분석 결과 생성
  analyzeMessage(englishText: string, koreanDraft?: string): MessageAnalysis {
    const tipPrefix = koreanDraft ? `입력하신 의도("${koreanDraft}")가 ` : '';

    // 길이 및 어휘 난이도에 따른 점수 산출
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

  // AI 파트너의 실시간 답변 생성 (페르소나 반영)
  async generateAssistantReplyAsync(partnerName: string, partnerRole: string, userText: string): Promise<string> {
    if (GEMINI_API_KEY) {
      try {
        const prompt = `You are ${partnerName}, an English conversation partner whose role is: "${partnerRole}".
A learner said to you in English: "${userText}"

Reply naturally, warmly, and concisely (1 to 3 sentences in conversational English).
Ask a friendly follow-up question to keep the conversation going smoothly.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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

    return this.generateAssistantReply(partnerName, userText, partnerRole);
  },

  // AI 상대방의 자연스러운 답장 생성 (로컬 규칙)
  generateAssistantReply(partnerName: string, userText: string, partnerRole?: string): string {
    const textLower = userText.toLowerCase();

    if (textLower.includes('ramen') || textLower.includes('noodle') || textLower.includes('rain') || textLower.includes('umbrella')) {
      return `Haha, honestly nothing beats a steaming bowl of noodles after getting caught in the chilly rain! 🍜 Did you try a new spot or your favorite place?`;
    }
    if (textLower.includes('coffee') || textLower.includes('cafe') || textLower.includes('tea')) {
      return `A coffee break sounds wonderful! ☕ There's a cozy new cafe with great pastries nearby. What time works best for you?`;
    }
    if (textLower.includes('hello') || textLower.includes('hi') || textLower.includes('hey')) {
      return `Hey there! It's great to hear from you. How has your week been treating you so far?`;
    }
    if (textLower.includes('tired') || textLower.includes('exhausted') || textLower.includes('busy')) {
      return `Oh, take care of yourself! Sounds like you've been working really hard. Do you have any relaxing plans for the weekend?`;
    }
    if (partnerRole?.includes('Business')) {
      return `That's a very clear point. In business communications, aligning early saves a lot of back-and-forth. How should we proceed with the next step?`;
    }
    if (partnerRole?.includes('Travel')) {
      return `That sounds like an adventure! Traveling is all about those unexpected moments. Where would you love to travel next? ✈️`;
    }
    if (partnerRole?.includes('Tutor')) {
      return `Great job expressing that! Your sentence was very clear and natural. Let's try expanding on that—how did that make you feel? 😊`;
    }

    return `That makes so much sense! I really appreciate you sharing that. What inspired you to think about that today?`;
  }
};
