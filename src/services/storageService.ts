import { 
  db, 
  ROOT_COLLECTION_NAME, 
  doc, 
  getDoc, 
  setDoc
} from '../firebase';
import { Thread, Message, SavedExpression, SavedScript } from '../types';

// 초기 시드 데이터 (시안 기반)
const INITIAL_THREADS: Thread[] = [
  {
    id: 'thread-1',
    title: '비 오는 날의 일상 스몰톡',
    partnerName: '박서준 (Alex)',
    partnerRole: 'Casual Native Friend',
    avatarBg: '#fce8e6',
    avatarText: '준',
    lastMessage: 'I forgot my umbrella so I got wet... But warm noodles were good!',
    updatedAt: Date.now() - 1000 * 60 * 30, // 30분 전
    isFavorite: true,
    category: 'daily'
  },
  {
    id: 'thread-2',
    title: '새 앨범과 음악 취향 토크',
    partnerName: '최수아 (Chloe)',
    partnerRole: 'Music Producer & Critic',
    avatarBg: '#f3e8fd',
    avatarText: '수',
    lastMessage: 'What is your favorite track on the new album?',
    updatedAt: Date.now() - 1000 * 60 * 120, // 2시간 전
    isFavorite: true,
    category: 'daily'
  },
  {
    id: 'thread-3',
    title: '디자인 시스템 가이드라인 리뷰',
    partnerName: '김민지 (Sarah)',
    partnerRole: 'Senior Product Designer',
    avatarBg: '#e8f0fe',
    avatarText: '민',
    lastMessage: 'Could we align on the token hierarchy before the release?',
    updatedAt: Date.now() - 1000 * 60 * 60 * 5,
    isFavorite: false,
    category: 'business'
  }
];

const INITIAL_MESSAGES: Record<string, Message[]> = {
  'thread-1': [
    {
      id: 'msg-1',
      sender: 'assistant',
      text: "Hey! The weather has been really unpredictable today. Did you get caught in the rain?",
      timestamp: Date.now() - 1000 * 60 * 45
    },
    {
      id: 'msg-2',
      sender: 'user',
      text: "I forgot my umbrella so I got soaking wet, but eating hot ramen afterward made my day!",
      koreanDraft: "우산 깜빡해서 다 젖었는데 그래도 따뜻한 라면 먹고 기분 풀렸어",
      timestamp: Date.now() - 1000 * 60 * 35,
      recommendations: [
        {
          id: 'rec-1',
          tone: 'Natural',
          english: "I forgot my umbrella and got completely soaked, but some hot ramen turned my day around!",
          koreanMeaning: "자연스러운 구어체 감정 표현",
          grammarTip: "get soaked = 흠뻑 젖다"
        },
        {
          id: 'rec-2',
          tone: 'Casual',
          english: "No umbrella, so I was drenched! But warm soup totally saved the day.",
          koreanMeaning: "친구와의 편안한 대화",
          grammarTip: "drenched = 물에 푹 젖은"
        }
      ],
      analysis: {
        grammarScore: 92,
        fluencyScore: 95,
        improvedVersion: "I left my umbrella behind and got soaked, but hot noodles cheered me right up!",
        explanation: "'make my day'도 훌륭하지만 'turned my day around' 또는 'cheered me up'을 쓰면 기분 전환의 뉘앙스가 더 선명해집니다.",
        keyVocabulary: [
          { word: "get soaked", meaning: "비 등에 흠뻑 젖다", phonetic: "/ɡɛt soʊkt/" },
          { word: "turn around", meaning: "상황이나 기분을 반전시키다", phonetic: "/tɜːrn əˈraʊnd/" }
        ]
      }
    },
    {
      id: 'msg-3',
      sender: 'assistant',
      text: "Haha, there's honestly nothing better than warm comfort food after a chilly downpour! What kind of noodles did you have?",
      timestamp: Date.now() - 1000 * 60 * 30
    }
  ]
};

const INITIAL_EXPRESSIONS: SavedExpression[] = [
  {
    id: 'exp-1',
    english: 'turn one\'s day around',
    korean: '기분/상황을 좋게 반전시키다',
    exampleSentence: 'A warm cup of coffee completely turned my day around.',
    situation: '기분 전환 / 소소한 위로',
    tag: 'Casual Idiom',
    createdAt: Date.now() - 1000 * 60 * 60 * 24
  },
  {
    id: 'exp-2',
    english: 'caught in the rain',
    korean: '갑작스러운 비를 만나다',
    exampleSentence: 'I didn\'t expect the shower and got caught in the rain on my way home.',
    situation: '날씨 / 통근',
    tag: 'Daily Phrase',
    createdAt: Date.now() - 1000 * 60 * 60 * 20
  },
  {
    id: 'exp-3',
    english: 'align on ~',
    korean: '~에 대해 의견/방향을 일치시키다',
    exampleSentence: 'Let\'s align on the project scope before starting development.',
    situation: '비즈니스 / 미팅',
    tag: 'Business',
    createdAt: Date.now() - 1000 * 60 * 60 * 12
  }
];

const INITIAL_SCRIPTS: SavedScript[] = [
  {
    id: 'script-1',
    title: '비 오는 날의 소소한 카페 대화',
    situation: '갑자기 비가 올 때 카페에서 만난 친구와의 스몰톡',
    level: 'Intermediate (B1)',
    targetExpression: 'turn my day around, get soaked',
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
    dialogue: [
      { speaker: 'Alex', isUser: false, english: 'Look at that rain pouring down! Did you bring an umbrella?', korean: '비 오는 것 좀 봐! 우산 챙겨왔어?' },
      { speaker: 'You', isUser: true, english: 'Nope, I got totally soaked running across the street!', korean: '아니, 길 건너오면서 완전히 흠뻑 젖었어!' },
      { speaker: 'Alex', isUser: false, english: 'Oh no! You must be freezing. Go grab a hot drink, my treat.', korean: '이런! 엄청 춥겠다. 따뜻한 음료 한 잔 마셔, 내가 살게.' },
      { speaker: 'You', isUser: true, english: 'Thanks, a hot vanilla latte will definitely turn my day around.', korean: '고마워, 따뜻한 바닐라 라떼 마시면 기분 완전 좋아질 것 같아.' }
    ]
  }
];

let currentUserId: string | null = null;

const getDocId = (baseName: string) => {
  return currentUserId ? `${baseName}_${currentUserId}` : baseName;
};

const getLocalKey = (baseKey: string) => {
  return currentUserId ? `${baseKey}_${currentUserId}` : baseKey;
};

export const storageService = {
  // 현재 로그인한 사용자 ID 설정 (사용자별 격리 보장)
  setUserId(uid: string | null) {
    currentUserId = uid;
  },

  // 스레드 목록 가져오기 (Firestore 실패 시 로컬 스토리지 Fallback 지원)
  async getThreads(): Promise<Thread[]> {
    const docId = getDocId("threads_data");
    const localKey = getLocalKey('app_threads');

    try {
      const threadsDocRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(threadsDocRef);
      if (snap.exists() && snap.data().items) {
        return snap.data().items as Thread[];
      }
      // 최초 실행 시 기본 데이터 등록
      await setDoc(threadsDocRef, { items: INITIAL_THREADS });
      return INITIAL_THREADS;
    } catch (e) {
      console.warn("Firestore access error, falling back to local memory:", e);
      const local = localStorage.getItem(localKey);
      if (local) return JSON.parse(local);
      localStorage.setItem(localKey, JSON.stringify(INITIAL_THREADS));
      return INITIAL_THREADS;
    }
  },

  // 특정 스레드의 메시지 목록 가져오기
  async getMessages(threadId: string): Promise<Message[]> {
    const docId = getDocId(`messages_${threadId}`);
    const localKey = getLocalKey(`app_messages_${threadId}`);

    try {
      const msgDocRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(msgDocRef);
      if (snap.exists() && snap.data().items) {
        return snap.data().items as Message[];
      }
      const initial = INITIAL_MESSAGES[threadId] || [];
      await setDoc(msgDocRef, { items: initial });
      return initial;
    } catch (e) {
      console.warn("Firestore message fetch error, falling back to local:", e);
      const local = localStorage.getItem(localKey);
      if (local) return JSON.parse(local);
      const initial = INITIAL_MESSAGES[threadId] || [];
      localStorage.setItem(localKey, JSON.stringify(initial));
      return initial;
    }
  },

  // 메시지 전송 및 저장
  async saveMessage(threadId: string, message: Message): Promise<void> {
    const docId = getDocId(`messages_${threadId}`);
    const threadsDocId = getDocId("threads_data");
    const localKey = getLocalKey(`app_messages_${threadId}`);

    try {
      const msgDocRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(msgDocRef);
      let items: Message[] = [];
      if (snap.exists() && snap.data().items) {
        items = snap.data().items;
      }
      items.push(message);
      await setDoc(msgDocRef, { items });

      // 스레드 최신 메시지 업데이트
      const threadsDocRef = doc(db, ROOT_COLLECTION_NAME, threadsDocId);
      const threadSnap = await getDoc(threadsDocRef);
      if (threadSnap.exists() && threadSnap.data().items) {
        const threads = threadSnap.data().items as Thread[];
        const target = threads.find(t => t.id === threadId);
        if (target) {
          target.lastMessage = message.text;
          target.updatedAt = message.timestamp;
          await setDoc(threadsDocRef, { items: threads });
        }
      }
    } catch (e) {
      console.warn("Firestore saveMessage fallback to local:", e);
      const existing: Message[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      existing.push(message);
      localStorage.setItem(localKey, JSON.stringify(existing));
    }
  },

  // 보관된 표현 목록 가져오기
  async getSavedExpressions(): Promise<SavedExpression[]> {
    const docId = getDocId("saved_expressions");
    const localKey = getLocalKey('app_expressions');

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().items) {
        return snap.data().items as SavedExpression[];
      }
      await setDoc(docRef, { items: INITIAL_EXPRESSIONS });
      return INITIAL_EXPRESSIONS;
    } catch (e) {
      const local = localStorage.getItem(localKey);
      if (local) return JSON.parse(local);
      localStorage.setItem(localKey, JSON.stringify(INITIAL_EXPRESSIONS));
      return INITIAL_EXPRESSIONS;
    }
  },

  // 표현 추가
  async saveExpression(expression: SavedExpression): Promise<void> {
    const docId = getDocId("saved_expressions");
    const localKey = getLocalKey('app_expressions');

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(docRef);
      let items: SavedExpression[] = [];
      if (snap.exists() && snap.data().items) {
        items = snap.data().items;
      }
      items.unshift(expression);
      await setDoc(docRef, { items });
    } catch (e) {
      const local = JSON.parse(localStorage.getItem(localKey) || '[]');
      local.unshift(expression);
      localStorage.setItem(localKey, JSON.stringify(local));
    }
  },

  // 보관된 대본 목록 가져오기
  async getSavedScripts(): Promise<SavedScript[]> {
    const docId = getDocId("saved_scripts");
    const localKey = getLocalKey('app_scripts');

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().items) {
        return snap.data().items as SavedScript[];
      }
      await setDoc(docRef, { items: INITIAL_SCRIPTS });
      return INITIAL_SCRIPTS;
    } catch (e) {
      const local = localStorage.getItem(localKey);
      if (local) return JSON.parse(local);
      localStorage.setItem(localKey, JSON.stringify(INITIAL_SCRIPTS));
      return INITIAL_SCRIPTS;
    }
  }
};
