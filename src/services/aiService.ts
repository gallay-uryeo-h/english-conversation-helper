import { RecommendationCard, MessageAnalysis } from '../types';

export const aiService = {
  // 한글 입력에 따른 실시간 영어 변환 추천 카드 생성
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

    if (trimmed.includes('회의') || trimmed.includes('일정') || trimmed.includes('시간')) {
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
        }
      ];
    }

    // 기본 동적 변환
    return [
      {
        id: 'rec-gen-1',
        tone: 'Natural',
        english: `I was thinking about "${trimmed}", what's your take on it?`,
        koreanMeaning: "상대방의 의견을 묻는 자연스러운 표현",
        grammarTip: "what's your take on ~ = ~에 대해 어떻게 생각해?"
      },
      {
        id: 'rec-gen-2',
        tone: 'Casual',
        english: `Just wanted to say that ${trimmed}! Hope everything is going well.`,
        koreanMeaning: "가벼운 스몰톡 공유"
      }
    ];
  },

  // 메시지에 대한 심화 언어 분석 결과 생성
  analyzeMessage(englishText: string, koreanDraft?: string): MessageAnalysis {
    const tipPrefix = koreanDraft ? `초안("${koreanDraft}")의 의도가 명확히 전달되었습니다. ` : '';
    return {
      grammarScore: 94,
      fluencyScore: 92,
      improvedVersion: englishText.includes('very good') 
        ? englishText.replace('very good', 'truly fantastic') 
        : englishText,
      explanation: `${tipPrefix}문장의 시제와 연결어가 매끄럽게 구성되어 있습니다. 원어민 화자는 구체적인 감정 형용사(e.g., soaked, cheered up, thrilled)를 사용하여 생동감을 더합니다.`,
      keyVocabulary: [
        { word: "turn around", meaning: "상황이나 기분을 반전시키다", phonetic: "/tɜːrn əˈraʊnd/" },
        { word: "spontaneous", meaning: "즉흥적인, 자연스러운", phonetic: "/spɑːnˈteɪ.ni.əs/" }
      ]
    };
  },

  // AI 상대방의 자연스러운 답장 생성
  generateAssistantReply(partnerName: string, userText: string): string {
    const nameGreeting = partnerName ? `${partnerName}: ` : '';
    if (userText.toLowerCase().includes('ramen') || userText.toLowerCase().includes('noodles') || userText.toLowerCase().includes('rain')) {
      return `${nameGreeting}Haha, honestly nothing beats a steaming bowl of ramen after getting caught in cold rain! 🍜 Did you try a new spot or your usual favorite?`;
    }
    if (userText.toLowerCase().includes('coffee') || userText.toLowerCase().includes('tea')) {
      return `${nameGreeting}A coffee break sounds wonderful! There's a cozy new cafe around the corner. What time works best for you? ☕`;
    }
    return `${nameGreeting}That makes so much sense! I really appreciate your perspective on that. How do you usually handle that kind of situation?`;
  }
};

