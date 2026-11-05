import { 
  db, 
  ROOT_COLLECTION_NAME, 
  doc, 
  getDoc, 
  setDoc,
  User
} from '../firebase';
import { Thread, Message, SavedExpression, SavedScript, Friend, GroupMember, VocabularyCorpusItem, VocabularyContext } from '../types';

// 기본 제공 AI 영어 회화 친구
export const DEFAULT_AI_FRIEND: Friend = {
  id: 'friend-ai-coach',
  name: 'AI 친구',
  email: 'ai@helper',
  avatarBg: '#d0e1fb',
  avatarText: 'AI',
  isAi: true
};

export const DEFAULT_FRIENDS: Friend[] = [DEFAULT_AI_FRIEND];

let currentUserId: string | null = null;

const getDocId = (baseName: string) => {
  return currentUserId ? `${baseName}_${currentUserId}` : baseName;
};

const getLocalKey = (baseKey: string) => {
  return currentUserId ? `${baseKey}_${currentUserId}` : baseKey;
};

// 이메일 주소로부터 아바타 색상과 이니셜 생성
export const generateAvatarInfo = (email: string, name?: string) => {
  const colors = ['#d0e1fb', '#f3e8fd', '#e8f0fe', '#feefe3', '#e6f4ea', '#fce8e6'];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];
  const char = (name || email).charAt(0).toUpperCase();
  return { avatarBg: color, avatarText: char };
};

export const storageService = {
  // 현재 로그인한 사용자 ID 설정 (사용자별 격리 보장)
  setUserId(uid: string | null) {
    currentUserId = uid;
  },

  // 사용자 로그인 시 그룹 디렉토리에 내 프로필 정보 등록/갱신
  async recordUserProfile(user: User): Promise<void> {
    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, "group_directory");
      const snap = await getDoc(docRef);
      let directory: Record<string, { name: string; photoURL?: string; email: string }> = {};
      if (snap.exists() && snap.data().members) {
        directory = snap.data().members;
      }
      directory[user.uid] = {
        name: user.displayName || user.email?.split('@')[0] || '사용자',
        photoURL: user.photoURL || undefined,
        email: (user.email || '').toLowerCase()
      };
      await setDoc(docRef, { members: directory });
    } catch (e) {
      console.warn("Group directory update error:", e);
    }
  },

  // 전체 그룹 멤버 목록 가져오기 (허용된 이메일 목록 기반)
  async getGroupMembers(allowedEmails: string[]): Promise<GroupMember[]> {
    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, "group_directory");
      const snap = await getDoc(docRef);
      const directory: Record<string, { name: string; photoURL?: string; email: string }> = 
        (snap.exists() && snap.data().members) ? snap.data().members : {};

      const dirList = Object.values(directory);

      // 허용된 모든 이메일을 그룹 멤버로 변환
      const members: GroupMember[] = allowedEmails.map((email) => {
        const lower = email.trim().toLowerCase();
        const matched = dirList.find(d => d.email.toLowerCase() === lower);
        const name = matched?.name || lower.split('@')[0];
        const { avatarBg, avatarText } = generateAvatarInfo(lower, name);

        return {
          id: `member-${lower}`,
          email: lower,
          name,
          photoURL: matched?.photoURL,
          avatarBg,
          avatarText,
          isAi: false
        };
      });

      // AI 코치를 항상 최상단에 포함
      return [
        {
          id: DEFAULT_AI_FRIEND.id,
          name: DEFAULT_AI_FRIEND.name,
          email: DEFAULT_AI_FRIEND.email || '',
          avatarBg: DEFAULT_AI_FRIEND.avatarBg,
          avatarText: DEFAULT_AI_FRIEND.avatarText,
          isAi: true
        },
        ...members
      ];
    } catch (e) {
      console.warn("getGroupMembers error, fallback:", e);
      return [
        {
          id: DEFAULT_AI_FRIEND.id,
          name: DEFAULT_AI_FRIEND.name,
          email: DEFAULT_AI_FRIEND.email || '',
          avatarBg: DEFAULT_AI_FRIEND.avatarBg,
          avatarText: DEFAULT_AI_FRIEND.avatarText,
          isAi: true
        },
        ...allowedEmails.map(em => {
          const { avatarBg, avatarText } = generateAvatarInfo(em);
          return {
            id: `member-${em}`,
            name: em.split('@')[0],
            email: em,
            avatarBg,
            avatarText,
            isAi: false
          };
        })
      ];
    }
  },

  // 현재 사용자가 추가/대화 중인 친구 목록 가져오기
  async getFriends(): Promise<Friend[]> {
    const docId = getDocId("friends_data");
    const localKey = getLocalKey('app_friends');

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().items) {
        return snap.data().items as Friend[];
      }
      // 최초 기본값: AI 코치 등록
      const initial = [DEFAULT_AI_FRIEND];
      await setDoc(docRef, { items: initial });
      return initial;
    } catch (e) {
      console.warn("Friends fetch error, fallback to local:", e);
      const local = localStorage.getItem(localKey);
      if (local) return JSON.parse(local);
      return [DEFAULT_AI_FRIEND];
    }
  },

  // 친구 목록에 추가 (중복 방지)
  async saveFriend(friend: Friend): Promise<void> {
    const docId = getDocId("friends_data");
    const localKey = getLocalKey('app_friends');

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(docRef);
      let items: Friend[] = [DEFAULT_AI_FRIEND];
      if (snap.exists() && snap.data().items) {
        items = snap.data().items;
      }
      if (!items.some(f => f.id === friend.id || (f.email && f.email === friend.email))) {
        items = [friend, ...items];
        await setDoc(docRef, { items });
      }
    } catch (e) {
      const local: Friend[] = JSON.parse(localStorage.getItem(localKey) || JSON.stringify([DEFAULT_AI_FRIEND]));
      if (!local.some(f => f.id === friend.id)) {
        local.unshift(friend);
        localStorage.setItem(localKey, JSON.stringify(local));
      }
    }
  },

  // 친구 삭제
  async deleteFriend(friendId: string): Promise<void> {
    const docId = getDocId("friends_data");
    const localKey = getLocalKey('app_friends');

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().items) {
        const items = (snap.data().items as Friend[]).filter(f => f.id !== friendId);
        await setDoc(docRef, { items });
      }
    } catch (e) {
      console.warn("deleteFriend remote error:", e);
    }

    const local: Friend[] = JSON.parse(localStorage.getItem(localKey) || '[]');
    const filtered = local.filter(f => f.id !== friendId);
    localStorage.setItem(localKey, JSON.stringify(filtered));
  },

  // 스레드(대화방) 목록 가져오기
  async getThreads(): Promise<Thread[]> {
    const docId = getDocId("threads_data");
    const localKey = getLocalKey('app_threads');

    try {
      const threadsDocRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(threadsDocRef);
      if (snap.exists() && snap.data().items) {
        return snap.data().items as Thread[];
      }
      await setDoc(threadsDocRef, { items: [] });
      return [];
    } catch (e) {
      const local = localStorage.getItem(localKey);
      if (local) return JSON.parse(local);
      return [];
    }
  },

  // 스레드 저장
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

  // 전체 스레드 초기화/삭제
  async clearAllThreads(): Promise<void> {
    const threadsDocId = getDocId("threads_data");
    const localKey = getLocalKey('app_threads');

    try {
      const threadsDocRef = doc(db, ROOT_COLLECTION_NAME, threadsDocId);
      await setDoc(threadsDocRef, { items: [] });
    } catch (e) {
      console.warn("clearAllThreads remote error, clearing local:", e);
    }
    localStorage.removeItem(localKey);
  },

  // 특정 스레드의 메시지 목록 가져오기 (오프라인 우선 + 원격 병합)
  async getMessages(threadId: string): Promise<Message[]> {
    const docId = getDocId(`messages_${threadId}`);
    const localKey = getLocalKey(`app_messages_${threadId}`);

    // 1. 로컬에 저장된 메시지 즉시 확보 (0ms)
    let localMsgs: Message[] = [];
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) localMsgs = JSON.parse(raw);
    } catch (e) {}

    // 2. 원격 Firestore에서 최신 메시지 조회 및 병합
    try {
      const msgDocRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(msgDocRef);
      if (snap.exists() && snap.data().items) {
        const remoteMsgs = snap.data().items as Message[];
        // ID 기준으로 로컬과 원격 메시지 병합 (중복 방지 및 누락 방지)
        const msgMap = new Map<string, Message>();
        remoteMsgs.forEach(m => msgMap.set(m.id, m));
        localMsgs.forEach(m => {
          if (!msgMap.has(m.id)) {
            msgMap.set(m.id, m);
          }
        });
        const merged = Array.from(msgMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        try {
          localStorage.setItem(localKey, JSON.stringify(merged));
        } catch (e) {}
        return merged;
      }
    } catch (e) {
      console.warn("getMessages remote error, falling back to local:", e);
    }

    return localMsgs;
  },

  // 메시지 전송 및 저장 (0ms 로컬 즉시 영구 저장 + Firestore 백그라운드 동기화)
  async saveMessage(threadId: string, message: Message): Promise<void> {
    const docId = getDocId(`messages_${threadId}`);
    const threadsDocId = getDocId("threads_data");
    const localKey = getLocalKey(`app_messages_${threadId}`);
    const localThreadsKey = getLocalKey('app_threads');

    // 1. [0ms 동기식 보장] 브라우저 로컬 스토리지에 즉시 무조건 먼저 저장!
    // 사용자가 전송 누르고 1ms 만에 화면을 나가더라도 절대 사라지지 않음
    let currentLocalMsgs: Message[] = [];
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) currentLocalMsgs = JSON.parse(raw);
    } catch (e) {}
    
    // 이미 동일 id가 없으면 추가
    if (!currentLocalMsgs.some(m => m.id === message.id)) {
      currentLocalMsgs.push(message);
      try {
        localStorage.setItem(localKey, JSON.stringify(currentLocalMsgs));
      } catch (e) {
        console.warn("localStorage setItem error:", e);
      }
    }

    // 로컬 스레드 목록 최신 정보 업데이트
    try {
      const rawThreads = localStorage.getItem(localThreadsKey);
      if (rawThreads) {
        const localThreads: Thread[] = JSON.parse(rawThreads);
        const target = localThreads.find(t => t.id === threadId);
        if (target) {
          target.lastMessage = message.text;
          target.lastSender = message.sender;
          target.messageCount = currentLocalMsgs.length;
          target.updatedAt = message.timestamp;
          localStorage.setItem(localThreadsKey, JSON.stringify(localThreads));
        }
      }
    } catch (e) {}

    // 2. [원격 비동기 백업] Firestore에 동기화
    try {
      const msgDocRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(msgDocRef);
      let items: Message[] = [];
      if (snap.exists() && snap.data().items) {
        items = snap.data().items;
      }
      if (!items.some(m => m.id === message.id)) {
        items.push(message);
      }
      await setDoc(msgDocRef, { items });

      // 스레드 최신 메시지 업데이트
      const threadsDocRef = doc(db, ROOT_COLLECTION_NAME, threadsDocId);
      const threadSnap = await getDoc(threadsDocRef);
      if (threadSnap.exists() && threadSnap.data().items) {
        const threads = threadSnap.data().items as Thread[];
        const target = threads.find(t => t.id === threadId);
        if (target) {
          target.lastMessage = message.text;
          target.lastSender = message.sender;
          target.messageCount = items.length;
          target.updatedAt = message.timestamp;
          await setDoc(threadsDocRef, { items: threads });
        }
      }
    } catch (e) {
      console.warn("saveMessage Firestore sync error (local data is safe):", e);
    }
  },

  // 모든 대화방에서 단어/표현 중심으로 집계하고 용례 문장들을 연결하는 메서드 (스마트 오버랩 병합 탑재)
  async getAllVocabularyItems(): Promise<VocabularyCorpusItem[]> {
    const threads = await this.getThreads();
    const vocabMap = new Map<string, {
      phrase: string;
      meaning: string;
      lastUsedAt: number;
      contexts: VocabularyContext[];
    }>();

    // 단어 정규화 헬퍼 (소문자, 앞뒤 공백 및 특수문자 제거, 끝의 be동사/대명사 등 단순 수식어 정리)
    const normalizeKey = (raw: string) => {
      return raw.toLowerCase().trim()
        .replace(/^to\s+/, '') // 'to appreciate' -> 'appreciate'
        .replace(/^(a|an|the)\s+/, '')
        .replace(/[.,!?~]+$/, '');
    };

    for (const thread of threads) {
      const messages = await this.getMessages(thread.id);
      for (const msg of messages) {
        if (!msg.text) continue;
        const expressions = msg.translation?.keyExpressions || [];
        const koreanTrans = msg.translation?.translation || '';

        for (const exp of expressions) {
          if (!exp.phrase || !exp.phrase.trim()) continue;
          const cleanPhrase = exp.phrase.trim();
          const key = normalizeKey(cleanPhrase);
          if (!key) continue;

          // [스마트 오버랩 병합]:
          // 이미 등록된 단어 중 key를 포함하거나(예: 기존에 'cozy'가 있고 새 단어가 'cozy inside'인 경우)
          // 또는 새 단어가 기존의 더 긴 단어의 핵심어인 경우 기본 핵심어 키로 통합
          let matchedKey = key;
          for (const existingKey of vocabMap.keys()) {
            const regex1 = new RegExp(`\\b${existingKey}\\b`, 'i');
            const regex2 = new RegExp(`\\b${key}\\b`, 'i');
            
            // 기존 키가 더 짧고 새 키에 포함되어 있으면 기존 키로 흡수 (예: 기존 cozy, 새 키 cozy inside -> cozy로 흡수)
            if (existingKey.length <= key.length && regex1.test(key)) {
              matchedKey = existingKey;
              break;
            }
            // 새 키가 더 짧고 기존 키에 포함되어 있으면 더 짧은 핵심어로 교체
            else if (key.length < existingKey.length && regex2.test(existingKey)) {
              const oldData = vocabMap.get(existingKey)!;
              vocabMap.delete(existingKey);
              vocabMap.set(key, oldData);
              matchedKey = key;
              break;
            }
          }

          const contextItem: VocabularyContext = {
            msgId: msg.id,
            threadId: thread.id,
            partnerName: thread.partnerName,
            avatarBg: thread.avatarBg,
            avatarText: thread.avatarText,
            englishSentence: msg.text,
            koreanTranslation: koreanTrans,
            timestamp: msg.timestamp,
            sender: msg.sender
          };

          if (vocabMap.has(matchedKey)) {
            const existing = vocabMap.get(matchedKey)!;
            // 동일 문장이 중복 추가되지 않도록 방지
            if (!existing.contexts.some(c => c.msgId === msg.id)) {
              existing.contexts.push(contextItem);
            }
            if (msg.timestamp > existing.lastUsedAt) {
              existing.lastUsedAt = msg.timestamp;
            }
          } else {
            vocabMap.set(matchedKey, {
              phrase: cleanPhrase,
              meaning: exp.meaning || '',
              lastUsedAt: msg.timestamp,
              contexts: [contextItem]
            });
          }
        }
      }
    }

    // 결과 배열 생성 (최근 사용순 정렬)
    const result: VocabularyCorpusItem[] = [];
    vocabMap.forEach((val, id) => {
      val.contexts.sort((a, b) => b.timestamp - a.timestamp);
      result.push({
        id,
        phrase: val.phrase,
        meaning: val.meaning,
        usageCount: val.contexts.length,
        lastUsedAt: val.lastUsedAt,
        contexts: val.contexts
      });
    });

    return result.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
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
