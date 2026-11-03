import { 
  db, 
  ROOT_COLLECTION_NAME, 
  doc, 
  getDoc, 
  setDoc
} from '../firebase';
import { Thread, Message, SavedExpression, SavedScript, Friend } from '../types';

// 기본 제공 AI 회화 친구 목록
export const DEFAULT_FRIENDS: Friend[] = [
  {
    id: 'friend-alex',
    name: '박서준 (Alex)',
    role: 'Casual Native Friend',
    description: '편안한 일상 스몰톡, 취미, 주말 계획을 나누는 친근한 원어민 친구',
    avatarBg: '#d0e1fb',
    avatarText: '준',
    category: 'daily',
    greeting: "Hey! What's up? How is your day going so far?",
    badge: '일상 회화'
  },
  {
    id: 'friend-chloe',
    name: '최수아 (Chloe)',
    role: 'Culture & Trend Enthusiast',
    description: '음악, 영화, SNS 트렌드와 감각적인 요즘 영어 표현을 함께 이야기하는 친구',
    avatarBg: '#f3e8fd',
    avatarText: '수',
    category: 'daily',
    greeting: "Hello there! Found any great music or movies lately? I'd love to chat!",
    badge: '문화/트렌드'
  },
  {
    id: 'friend-sarah',
    name: '김민지 (Sarah)',
    role: 'Global Business Coach',
    description: '비즈니스 이메일, 업무 협의, 회의 발표 및 인터뷰 표현을 코칭해주는 프로',
    avatarBg: '#e8f0fe',
    avatarText: '민',
    category: 'business',
    greeting: "Good to meet you. Are you preparing for any business discussions or presentations today?",
    badge: '비즈니스'
  },
  {
    id: 'friend-liam',
    name: 'Liam Smith',
    role: 'Travel & Roleplay Guide',
    description: '공항 입국, 호텔 체크인, 카페/식당 주문 등 해외 여행 실전 롤플레잉 파트너',
    avatarBg: '#feefe3',
    avatarText: 'L',
    category: 'travel',
    greeting: "Welcome! Where are we traveling today? Ready to practice ordering or checking in?",
    badge: '여행/롤플레잉'
  },
  {
    id: 'friend-emma',
    name: 'Emma Watson',
    role: 'Friendly Beginner Tutor',
    description: '쉬운 단어와 친절한 설명으로 영어가 낯선 분들도 자신감을 키워주는 다정한 튜터',
    avatarBg: '#e6f4ea',
    avatarText: 'E',
    category: 'tutor',
    greeting: "Hi! Don't worry about making mistakes at all. Let's take it slow and have fun!",
    badge: '초보자 추천'
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

  // 친구 목록 가져오기 (기본 친구 + 사용자가 추가한 친구)
  async getFriends(): Promise<Friend[]> {
    const docId = getDocId("friends_data");
    const localKey = getLocalKey('app_friends');

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().items) {
        return snap.data().items as Friend[];
      }
      // 최초 실행 시 기본 친구 리스트 등록
      await setDoc(docRef, { items: DEFAULT_FRIENDS });
      return DEFAULT_FRIENDS;
    } catch (e) {
      console.warn("Firestore friends fetch error, fallback to local:", e);
      const local = localStorage.getItem(localKey);
      if (local) return JSON.parse(local);
      localStorage.setItem(localKey, JSON.stringify(DEFAULT_FRIENDS));
      return DEFAULT_FRIENDS;
    }
  },

  // 새 친구 추가
  async saveFriend(friend: Friend): Promise<void> {
    const docId = getDocId("friends_data");
    const localKey = getLocalKey('app_friends');

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(docRef);
      let items: Friend[] = DEFAULT_FRIENDS;
      if (snap.exists() && snap.data().items) {
        items = snap.data().items;
      }
      items = [friend, ...items];
      await setDoc(docRef, { items });
    } catch (e) {
      const local: Friend[] = JSON.parse(localStorage.getItem(localKey) || JSON.stringify(DEFAULT_FRIENDS));
      local.unshift(friend);
      localStorage.setItem(localKey, JSON.stringify(local));
    }
  },

  // 스레드(대화방) 목록 가져오기 (실제 사용자 데이터만 반환, mock 제외)
  async getThreads(): Promise<Thread[]> {
    const docId = getDocId("threads_data");
    const localKey = getLocalKey('app_threads');

    try {
      const threadsDocRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(threadsDocRef);
      if (snap.exists() && snap.data().items) {
        return snap.data().items as Thread[];
      }
      // 최초 사용자: 빈 배열로 초기화 (가짜 mock 데이터 제거)
      await setDoc(threadsDocRef, { items: [] });
      return [];
    } catch (e) {
      console.warn("Firestore threads fetch error, fallback to local:", e);
      const local = localStorage.getItem(localKey);
      if (local) return JSON.parse(local);
      return [];
    }
  },

  // 스레드 생성 또는 업데이트
  async saveThread(thread: Thread): Promise<void> {
    const threadsDocId = getDocId("threads_data");
    const localKey = getLocalKey('app_threads');

    try {
      const threadsDocRef = doc(db, ROOT_COLLECTION_NAME, threadsDocId);
      const snap = await getDoc(threadsDocRef);
      let items: Thread[] = [];
      if (snap.exists() && snap.data().items) {
        items = snap.data().items as Thread[];
      }
      const existingIdx = items.findIndex(t => t.id === thread.id);
      if (existingIdx >= 0) {
        items[existingIdx] = thread;
      } else {
        items.unshift(thread);
      }
      await setDoc(threadsDocRef, { items });
    } catch (e) {
      const local: Thread[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      const existingIdx = local.findIndex(t => t.id === thread.id);
      if (existingIdx >= 0) {
        local[existingIdx] = thread;
      } else {
        local.unshift(thread);
      }
      localStorage.setItem(localKey, JSON.stringify(local));
    }
  },

  // 스레드 삭제
  async deleteThread(threadId: string): Promise<void> {
    const threadsDocId = getDocId("threads_data");
    const localKey = getLocalKey('app_threads');

    try {
      const threadsDocRef = doc(db, ROOT_COLLECTION_NAME, threadsDocId);
      const snap = await getDoc(threadsDocRef);
      if (snap.exists() && snap.data().items) {
        const items = (snap.data().items as Thread[]).filter(t => t.id !== threadId);
        await setDoc(threadsDocRef, { items });
      }
    } catch (e) {
      const local: Thread[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      const filtered = local.filter(t => t.id !== threadId);
      localStorage.setItem(localKey, JSON.stringify(filtered));
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
      return [];
    } catch (e) {
      console.warn("Firestore message fetch error, fallback to local:", e);
      const local = localStorage.getItem(localKey);
      if (local) return JSON.parse(local);
      return [];
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
      return [];
    } catch (e) {
      const local = localStorage.getItem(localKey);
      if (local) return JSON.parse(local);
      return [];
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

  // 표현 삭제
  async deleteExpression(id: string): Promise<void> {
    const docId = getDocId("saved_expressions");
    const localKey = getLocalKey('app_expressions');

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().items) {
        const filtered = (snap.data().items as SavedExpression[]).filter(e => e.id !== id);
        await setDoc(docRef, { items: filtered });
      }
    } catch (e) {
      const local: SavedExpression[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      const filtered = local.filter(e => e.id !== id);
      localStorage.setItem(localKey, JSON.stringify(filtered));
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
      return [];
    } catch (e) {
      const local = localStorage.getItem(localKey);
      if (local) return JSON.parse(local);
      return [];
    }
  },

  // 대본 추가
  async saveScript(script: SavedScript): Promise<void> {
    const docId = getDocId("saved_scripts");
    const localKey = getLocalKey('app_scripts');

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(docRef);
      let items: SavedScript[] = [];
      if (snap.exists() && snap.data().items) {
        items = snap.data().items;
      }
      items.unshift(script);
      await setDoc(docRef, { items });
    } catch (e) {
      const local = JSON.parse(localStorage.getItem(localKey) || '[]');
      local.unshift(script);
      localStorage.setItem(localKey, JSON.stringify(local));
    }
  }
};
