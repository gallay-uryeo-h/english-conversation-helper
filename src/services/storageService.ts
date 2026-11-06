import { 
  db, 
  ROOT_COLLECTION_NAME, 
  doc, 
  getDoc, 
  setDoc,
  onSnapshot,
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
let currentUserEmail: string | null = null;
let currentUserName: string | null = null;

export const cleanEmailKey = (email: string) => {
  return (email || '').trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
};

export const getSharedThreadId = (emailA: string, emailB: string) => {
  const sorted = [emailA.trim().toLowerCase(), emailB.trim().toLowerCase()].sort();
  return `dm_${cleanEmailKey(sorted[0])}__${cleanEmailKey(sorted[1])}`;
};

const getDocId = (baseName: string) => {
  return currentUserId ? `${baseName}_${currentUserId}` : baseName;
};

const getEmailDocId = (baseName: string) => {
  return currentUserEmail ? `${baseName}_${cleanEmailKey(currentUserEmail)}` : getDocId(baseName);
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
  // 현재 로그인한 사용자 ID 및 이메일 설정 (사용자별 격리 보장)
  setUserId(uid: string | null) {
    currentUserId = uid;
  },

  setUserEmail(email: string | null) {
    currentUserEmail = email ? email.trim().toLowerCase() : null;
  },

  setUserName(name: string | null) {
    currentUserName = name;
  },

  getUserEmail(): string | null {
    return currentUserEmail;
  },

  getUserName(): string | null {
    return currentUserName;
  },

  // 사용자 로그인 시 그룹 디렉토리에 내 프로필 정보 등록/갱신
  async recordUserProfile(user: User): Promise<void> {
    currentUserEmail = (user.email || '').trim().toLowerCase();
    currentUserName = user.displayName || user.email?.split('@')[0] || '사용자';

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, "group_directory");
      const snap = await getDoc(docRef);
      let directory: Record<string, { name: string; photoURL?: string; email: string }> = {};
      if (snap.exists() && snap.data().members) {
        directory = snap.data().members;
      }
      directory[user.uid] = {
        name: currentUserName,
        photoURL: user.photoURL || undefined,
        email: currentUserEmail
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

  // 스레드(대화방) 목록 가져오기 (이메일 기반 공유 스레드 및 UID 스레드 통합)
  async getThreads(): Promise<Thread[]> {
    const docId = getDocId("threads_data");
    const emailDocId = getEmailDocId("threads_email");
    const localKey = getLocalKey('app_threads');

    // 1. 로컬 캐시 우선 확보
    let localThreads: Thread[] = [];
    try {
      const local = localStorage.getItem(localKey);
      if (local) localThreads = JSON.parse(local);
    } catch (e) {}

    try {
      const threadMap = new Map<string, Thread>();
      localThreads.forEach(t => threadMap.set(t.id, t));

      // 2. 이메일 기반 스레드 문서 조회 (친구로부터 받은 DM 포함)
      if (currentUserEmail) {
        const emailRef = doc(db, ROOT_COLLECTION_NAME, emailDocId);
        const emailSnap = await getDoc(emailRef);
        if (emailSnap.exists() && emailSnap.data().items) {
          (emailSnap.data().items as Thread[]).forEach(t => threadMap.set(t.id, t));
        }
      }

      // 3. 기존 UID 기반 스레드 문서 조회
      const threadsDocRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(threadsDocRef);
      if (snap.exists() && snap.data().items) {
        (snap.data().items as Thread[]).forEach(t => {
          if (!threadMap.has(t.id)) {
            threadMap.set(t.id, t);
          }
        });
      }

      const merged = Array.from(threadMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
      localStorage.setItem(localKey, JSON.stringify(merged));
      return merged;
    } catch (e) {
      console.warn("getThreads error, fallback to local:", e);
      return localThreads;
    }
  },

  // 스레드 목록 실시간 구독 (친구가 메시지를 보냈을 때 즉시 카카오톡 뱃지 & 목록 자동 갱신)
  subscribeToThreads(userEmail: string, callback: (threads: Thread[]) => void): () => void {
    if (!userEmail) return () => {};
    const cleanEmail = cleanEmailKey(userEmail);
    const docRef = doc(db, ROOT_COLLECTION_NAME, `threads_email_${cleanEmail}`);

    return onSnapshot(docRef, (snap) => {
      if (snap.exists() && snap.data().items) {
        const items = (snap.data().items as Thread[]).sort((a, b) => b.updatedAt - a.updatedAt);
        callback(items);
      }
    }, (err) => {
      console.warn("subscribeToThreads error:", err);
    });
  },

  // 특정 스레드 읽음 처리 (카카오톡 뱃지 0으로 초기화 + 읽음 타임스탬프 갱신)
  async markThreadAsRead(threadId: string): Promise<void> {
    const localKey = getLocalKey('app_threads');
    try {
      const local: Thread[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      const target = local.find(t => t.id === threadId);
      if (target && target.unreadCount) {
        target.unreadCount = 0;
        localStorage.setItem(localKey, JSON.stringify(local));
      }
    } catch (e) {}

    if (currentUserEmail) {
      const cleanEmail = cleanEmailKey(currentUserEmail);
      const docRef = doc(db, ROOT_COLLECTION_NAME, `threads_email_${cleanEmail}`);
      try {
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().items) {
          const items = snap.data().items as Thread[];
          const target = items.find(t => t.id === threadId);
          if (target && target.unreadCount) {
            target.unreadCount = 0;
            await setDoc(docRef, { items });
          }
        }
      } catch (e) {
        console.warn("markThreadAsRead error:", e);
      }

      // DM인 경우 상대방에게 읽었음을 알리는 읽음 타임스탬프 동기화
      if (threadId.startsWith('dm_')) {
        await this.updateThreadReadTimestamp(threadId, currentUserEmail);
      }
    }
  },

  // 스레드 저장
  async saveThread(thread: Thread): Promise<void> {
    const threadsDocId = getDocId("threads_data");
    const emailDocId = getEmailDocId("threads_email");
    const localKey = getLocalKey('app_threads');

    // 로컬 스토리지 즉시 반영
    let local: Thread[] = [];
    try {
      local = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}

    const existingIdx = local.findIndex(t => t.id === thread.id);
    if (existingIdx >= 0) {
      local[existingIdx] = thread;
    } else {
      local.unshift(thread);
    }
    localStorage.setItem(localKey, JSON.stringify(local));

    // Firestore 동기화
    try {
      if (currentUserEmail) {
        const emailDocRef = doc(db, ROOT_COLLECTION_NAME, emailDocId);
        const emailSnap = await getDoc(emailDocRef);
        let items: Thread[] = (emailSnap.exists() && emailSnap.data().items) ? emailSnap.data().items : [];
        const idx = items.findIndex(t => t.id === thread.id);
        if (idx >= 0) items[idx] = thread;
        else items.unshift(thread);
        await setDoc(emailDocRef, { items });
      }

      const threadsDocRef = doc(db, ROOT_COLLECTION_NAME, threadsDocId);
      const snap = await getDoc(threadsDocRef);
      let items: Thread[] = (snap.exists() && snap.data().items) ? snap.data().items : [];
      const idx = items.findIndex(t => t.id === thread.id);
      if (idx >= 0) items[idx] = thread;
      else items.unshift(thread);
      await setDoc(threadsDocRef, { items });
    } catch (e) {
      console.warn("saveThread remote error:", e);
    }
  },

  // 스레드 삭제
  async deleteThread(threadId: string): Promise<void> {
    const threadsDocId = getDocId("threads_data");
    const emailDocId = getEmailDocId("threads_email");
    const localKey = getLocalKey('app_threads');

    try {
      if (currentUserEmail) {
        const emailDocRef = doc(db, ROOT_COLLECTION_NAME, emailDocId);
        const emailSnap = await getDoc(emailDocRef);
        if (emailSnap.exists() && emailSnap.data().items) {
          const items = (emailSnap.data().items as Thread[]).filter(t => t.id !== threadId);
          await setDoc(emailDocRef, { items });
        }
      }

      const threadsDocRef = doc(db, ROOT_COLLECTION_NAME, threadsDocId);
      const snap = await getDoc(threadsDocRef);
      if (snap.exists() && snap.data().items) {
        const items = (snap.data().items as Thread[]).filter(t => t.id !== threadId);
        await setDoc(threadsDocRef, { items });
      }
    } catch (e) {
      console.warn("deleteThread remote error:", e);
    }

    try {
      const local: Thread[] = JSON.parse(localStorage.getItem(localKey) || '[]');
      const filtered = local.filter(t => t.id !== threadId);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    } catch (e) {}
  },

  // 전체 스레드 초기화/삭제
  async clearAllThreads(): Promise<void> {
    const threadsDocId = getDocId("threads_data");
    const emailDocId = getEmailDocId("threads_email");
    const localKey = getLocalKey('app_threads');

    try {
      if (currentUserEmail) {
        const emailDocRef = doc(db, ROOT_COLLECTION_NAME, emailDocId);
        await setDoc(emailDocRef, { items: [] });
      }
      const threadsDocRef = doc(db, ROOT_COLLECTION_NAME, threadsDocId);
      await setDoc(threadsDocRef, { items: [] });
    } catch (e) {
      console.warn("clearAllThreads remote error, clearing local:", e);
    }
    localStorage.removeItem(localKey);
  },

  // 특정 스레드의 메시지 목록 가져오기 (DM 공통 문서 또는 개인 문서 통합)
  async getMessages(threadId: string): Promise<Message[]> {
    const isDm = threadId.startsWith('dm_');
    const docId = isDm ? `shared_messages_${threadId}` : getDocId(`messages_${threadId}`);
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
        const msgMap = new Map<string, Message>();
        remoteMsgs.forEach(m => msgMap.set(m.id, m));
        localMsgs.forEach(m => {
          if (!msgMap.has(m.id)) {
            msgMap.set(m.id, m);
          }
        });

        const merged = Array.from(msgMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        
        // DM인 경우 내가 보낸 건 'user', 친구가 보낸 건 'assistant'로 자동 매핑
        const normalized = merged.map(m => {
          if (isDm && m.senderEmail && currentUserEmail) {
            const isMe = m.senderEmail.toLowerCase() === currentUserEmail.toLowerCase();
            return { ...m, sender: (isMe ? 'user' : 'assistant') as ('user' | 'assistant') };
          }
          return m;
        });

        try {
          localStorage.setItem(localKey, JSON.stringify(normalized));
        } catch (e) {}
        return normalized;
      }
    } catch (e) {
      console.warn("getMessages remote error, falling back to local:", e);
    }

    return localMsgs;
  },

  // 실시간 메시지 구독 (내가 열고 있는 DM 대화방에 친구가 메시지를 쏘면 즉시 화면에 노출)
  subscribeToMessages(threadId: string, myEmail: string, callback: (msgs: Message[]) => void): () => void {
    if (!threadId.startsWith('dm_')) return () => {};

    const docRef = doc(db, ROOT_COLLECTION_NAME, `shared_messages_${threadId}`);
    return onSnapshot(docRef, (snap) => {
      if (snap.exists() && snap.data().items) {
        const rawMsgs = snap.data().items as Message[];
        const sorted = rawMsgs.sort((a, b) => a.timestamp - b.timestamp);
        const mapped = sorted.map(m => {
          if (m.senderEmail && myEmail) {
            const isMe = m.senderEmail.toLowerCase() === myEmail.toLowerCase();
            return { ...m, sender: (isMe ? 'user' : 'assistant') as ('user' | 'assistant') };
          }
          return m;
        });
        callback(mapped);
      }
    }, (err) => {
      console.warn("subscribeToMessages error:", err);
    });
  },

  // 1:1 대화방 내 마지막 읽은 시각 갱신 (카카오톡 '1' 마커 해제용)
  async updateThreadReadTimestamp(threadId: string, email: string): Promise<void> {
    if (!threadId.startsWith('dm_') || !email) return;
    const cleanKey = cleanEmailKey(email);
    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, `dm_read_${threadId}`);
      await setDoc(docRef, { [cleanKey]: Date.now() }, { merge: true });
    } catch (e) {
      console.warn("updateThreadReadTimestamp error:", e);
    }
  },

  // 1:1 대화방 상대방의 마지막 읽은 시각 실시간 구독 ('1' 마커 즉시 소멸 연동)
  subscribeToThreadReadStatus(threadId: string, partnerEmail: string, callback: (lastReadTimestamp: number) => void): () => void {
    if (!threadId.startsWith('dm_') || !partnerEmail) return () => {};
    const cleanPartner = cleanEmailKey(partnerEmail);
    const docRef = doc(db, ROOT_COLLECTION_NAME, `dm_read_${threadId}`);
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const lastRead = Number(data?.[cleanPartner] || 0);
        callback(lastRead);
      } else {
        callback(0);
      }
    }, (err) => {
      console.warn("subscribeToThreadReadStatus error:", err);
    });
  },

  // 타이핑 인디케이터 상태 갱신 (상대방에게 '... 입력 중' 표시)
  async setTypingStatus(threadId: string, email: string, isTyping: boolean): Promise<void> {
    if (!threadId.startsWith('dm_') || !email) return;
    const cleanKey = cleanEmailKey(email);
    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, `dm_typing_${threadId}`);
      await setDoc(docRef, { [cleanKey]: isTyping ? Date.now() : 0 }, { merge: true });
    } catch (e) {
      console.warn("setTypingStatus error:", e);
    }
  },

  // 상대방 타이핑 상태 실시간 구독
  subscribeToTypingStatus(threadId: string, partnerEmail: string, callback: (isTyping: boolean) => void): () => void {
    if (!threadId.startsWith('dm_') || !partnerEmail) return () => {};
    const cleanPartner = cleanEmailKey(partnerEmail);
    const docRef = doc(db, ROOT_COLLECTION_NAME, `dm_typing_${threadId}`);
    let checkTimer: any = null;

    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const lastTypingTime = Number(data?.[cleanPartner] || 0);
        const isNowTyping = (Date.now() - lastTypingTime) < 3500;
        callback(isNowTyping);

        if (checkTimer) clearTimeout(checkTimer);
        if (isNowTyping) {
          checkTimer = setTimeout(() => {
            callback(false);
          }, 3600);
        }
      } else {
        callback(false);
      }
    }, (err) => {
      console.warn("subscribeToTypingStatus error:", err);
    });

    return () => {
      if (checkTimer) clearTimeout(checkTimer);
      unsubscribe();
    };
  },

  // 메시지 전송 및 저장 (친구 DM 공유 저장 + 카카오톡 스타일 상대방 뱃지 갱신)
  async saveMessage(threadId: string, message: Message, partnerEmail?: string): Promise<void> {
    const isDm = threadId.startsWith('dm_');
    const docId = isDm ? `shared_messages_${threadId}` : getDocId(`messages_${threadId}`);
    const localKey = getLocalKey(`app_messages_${threadId}`);
    const localThreadsKey = getLocalKey('app_threads');

    // 발신자 정보 기록
    if (!message.senderEmail && currentUserEmail) {
      message.senderEmail = currentUserEmail;
      message.senderName = currentUserName || undefined;
    }

    // 1. [0ms 동기식 보장] 브라우저 로컬 스토리지에 즉시 무조건 먼저 저장 (기존 메시지는 업데이트)!
    let currentLocalMsgs: Message[] = [];
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) currentLocalMsgs = JSON.parse(raw);
    } catch (e) {}
    
    const existingLocalIdx = currentLocalMsgs.findIndex(m => m.id === message.id);
    if (existingLocalIdx >= 0) {
      currentLocalMsgs[existingLocalIdx] = { ...currentLocalMsgs[existingLocalIdx], ...message };
    } else {
      currentLocalMsgs.push(message);
    }
    try {
      localStorage.setItem(localKey, JSON.stringify(currentLocalMsgs));
    } catch (e) {}

    // 내 로컬 스레드 목록 갱신
    try {
      const rawThreads = localStorage.getItem(localThreadsKey);
      if (rawThreads) {
        const localThreads: Thread[] = JSON.parse(rawThreads);
        const target = localThreads.find(t => t.id === threadId);
        if (target) {
          target.lastMessage = message.text;
          target.lastSender = 'user';
          target.updatedAt = message.timestamp;
          target.unreadCount = 0;
          localStorage.setItem(localThreadsKey, JSON.stringify(localThreads));
        }
      }
    } catch (e) {}

    // 2. Firestore 동기화
    try {
      // 2-1. 메시지 저장 (신규 추가 또는 메타데이터 업데이트)
      const msgDocRef = doc(db, ROOT_COLLECTION_NAME, docId);
      const snap = await getDoc(msgDocRef);
      let items: Message[] = [];
      if (snap.exists() && snap.data().items) {
        items = snap.data().items as Message[];
      }
      const existingIdx = items.findIndex(m => m.id === message.id);
      if (existingIdx >= 0) {
        items[existingIdx] = { ...items[existingIdx], ...message };
      } else {
        items.push(message);
      }
      await setDoc(msgDocRef, { items });

      // 2-2. 내 스레드 목록 업데이트
      if (currentUserEmail) {
        const myEmailRef = doc(db, ROOT_COLLECTION_NAME, getEmailDocId("threads_email"));
        const myEmailSnap = await getDoc(myEmailRef);
        let myThreads: Thread[] = (myEmailSnap.exists() && myEmailSnap.data().items) ? myEmailSnap.data().items : [];
        const myIdx = myThreads.findIndex(t => t.id === threadId);
        if (myIdx >= 0) {
          myThreads[myIdx].lastMessage = message.text;
          myThreads[myIdx].lastSender = 'user';
          myThreads[myIdx].updatedAt = message.timestamp;
          myThreads[myIdx].unreadCount = 0;
        }
        await setDoc(myEmailRef, { items: myThreads });
      }

      // 2-3. [친구와의 DM인 경우] 상대방 친구의 대화 목록에 방 생성 및 unreadCount +1 갱신 (카카오톡 뱃지)
      if (isDm && partnerEmail) {
        const cleanPartner = cleanEmailKey(partnerEmail);
        const partnerRef = doc(db, ROOT_COLLECTION_NAME, `threads_email_${cleanPartner}`);
        const partnerSnap = await getDoc(partnerRef);
        let partnerThreads: Thread[] = (partnerSnap.exists() && partnerSnap.data().items) ? partnerSnap.data().items : [];
        
        const existingPartnerIdx = partnerThreads.findIndex(t => t.id === threadId);
        if (existingPartnerIdx >= 0) {
          partnerThreads[existingPartnerIdx].lastMessage = message.text;
          partnerThreads[existingPartnerIdx].lastSender = 'assistant';
          partnerThreads[existingPartnerIdx].updatedAt = message.timestamp;
          partnerThreads[existingPartnerIdx].unreadCount = (partnerThreads[existingPartnerIdx].unreadCount || 0) + 1;
        } else {
          // 상대방에게 아직 해당 방이 없는 경우 새로 방 생성
          const myAvatar = generateAvatarInfo(currentUserEmail || '', currentUserName || undefined);
          const newPartnerThread: Thread = {
            id: threadId,
            partnerName: currentUserName || currentUserEmail?.split('@')[0] || '친구',
            partnerEmail: currentUserEmail || '',
            avatarBg: myAvatar.avatarBg,
            avatarText: myAvatar.avatarText,
            lastMessage: message.text,
            lastSender: 'assistant',
            updatedAt: message.timestamp,
            unreadCount: 1, // 최초 1개 미확인
            isAi: false
          };
          partnerThreads.unshift(newPartnerThread);
        }
        await setDoc(partnerRef, { items: partnerThreads });
      }
    } catch (e) {
      console.warn("saveMessage remote error:", e);
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
