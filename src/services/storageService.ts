import { 
  db, 
  ROOT_COLLECTION_NAME, 
  doc, 
  getDoc, 
  setDoc,
  User
} from '../firebase';
import { Thread, Message, SavedExpression, SavedScript, Friend, GroupMember } from '../types';

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
          target.lastSender = message.sender;
          target.messageCount = items.length;
          target.updatedAt = message.timestamp;
          await setDoc(threadsDocRef, { items: threads });
        }
      }
    } catch (e) {
      const existing: Message[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      existing.push(message);
      localStorage.setItem(localKey, JSON.stringify(existing));

      const localThreadsKey = getLocalKey('app_threads');
      const localThreads: Thread[] = JSON.parse(localStorage.getItem(localThreadsKey) || '[]');
      const targetLocal = localThreads.find(t => t.id === threadId);
      if (targetLocal) {
        targetLocal.lastMessage = message.text;
        targetLocal.lastSender = message.sender;
        targetLocal.messageCount = existing.length;
        targetLocal.updatedAt = message.timestamp;
        localStorage.setItem(localThreadsKey, JSON.stringify(localThreads));
      }
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
