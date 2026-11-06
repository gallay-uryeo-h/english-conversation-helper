import React, { useState, useEffect } from 'react';
import { MainTab, Thread, Message, MessageTranslation, SavedExpression, SavedScript, RecommendationCard, Friend, GroupMember } from './types';
import { storageService, DEFAULT_FRIENDS, getSharedThreadId } from './services/storageService';
import { aiService } from './services/aiService';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { FriendsView } from './components/FriendsView';
import { ThreadsView } from './components/ThreadsView';
import { ChatView } from './components/ChatView';
import { ArchiveView } from './components/ArchiveView';
import { LoginView } from './components/LoginView';
import { AdminModal } from './components/AdminModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const MainApp: React.FC = () => {
  const { user, appTarget, allowedEmails, allowedDomains } = useAuth();
  const [currentTab, setCurrentTab] = useState<MainTab>('friends');
  const [prevTab, setPrevTab] = useState<MainTab>('friends');
  const [friends, setFriends] = useState<Friend[]>(DEFAULT_FRIENDS);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [expressions, setExpressions] = useState<SavedExpression[]>([]);
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // 스마트폰 기기 뒤로가기(하드웨어/브라우저 popstate) 감지
  useEffect(() => {
    const handlePopState = () => {
      if (currentTab === 'chat') {
        setCurrentTab(prevTab || 'friends');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentTab, prevTab]);

  // 사용자별 데이터 로드 (Firestore)
  useEffect(() => {
    async function initData() {
      if (!user) return;
      try {
        setLoading(true);
        // 로그인한 사용자 UID 및 이메일로 데이터 스토리지 설정
        storageService.setUserId(user.uid);
        storageService.setUserEmail(user.email);
        storageService.setUserName(user.displayName);

        // 0. 사용자 프로필 그룹 디렉토리 동기화 및 그룹 멤버 목록 로드
        await storageService.recordUserProfile(user);
        const members = await storageService.getGroupMembers(allowedEmails);
        setGroupMembers(members);

        // 1. 친구 목록 로드
        const loadedFriends = await storageService.getFriends();
        setFriends(loadedFriends);

        // 2. 대화방 목록 로드
        const fetchedThreads = await storageService.getThreads();
        setThreads(fetchedThreads);
        if (fetchedThreads.length > 0) {
          setActiveThread(fetchedThreads[0]);
          let msgs = await storageService.getMessages(fetchedThreads[0].id);
          // 레거시 또는 이전 자동 생성 첫 인사만 남아있는 경우 빈 방으로 정리
          if (msgs.length === 1 && (msgs[0].id.startsWith('msg-greeting') || msgs[0].text.includes('Ready to practice') || msgs[0].text.includes("Let's chat in English"))) {
            msgs = [];
          }
          setMessages(msgs);
        } else {
          setActiveThread(null);
          setMessages([]);
        }

        // 3. 보관함 데이터 로드
        const expList = await storageService.getSavedExpressions();
        setExpressions(expList);
        const scriptList = await storageService.getSavedScripts();
        setScripts(scriptList);
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, [user?.uid, allowedEmails]);

  // 실시간 스레드 목록 구독 (친구로부터 온 새 메시지 및 안 읽은 뱃지 실시간 동기화)
  useEffect(() => {
    if (!user?.email) return;
    const unsubscribe = storageService.subscribeToThreads(user.email, (liveThreads) => {
      setThreads(prev => {
        const map = new Map<string, Thread>();
        prev.forEach(t => map.set(t.id, t));
        liveThreads.forEach(t => map.set(t.id, t));
        return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
      });
    });
    return () => unsubscribe();
  }, [user?.email]);

  // 현재 활성 대화방 실시간 메시지 구독 (친구가 보낸 메시지가 0ms로 화면에 즉시 뜸)
  useEffect(() => {
    if (!activeThread?.id || !user?.email || !activeThread.id.startsWith('dm_')) return;
    const unsubscribe = storageService.subscribeToMessages(activeThread.id, user.email, (liveMsgs) => {
      setMessages(liveMsgs);
    });
    return () => unsubscribe();
  }, [activeThread?.id, user?.email]);

  // 대화 화면 진입 헬퍼 (히스토리 스택에 push하여 뒤로가기 지원)
  const openChatScreen = (thread: Thread, msgs: Message[]) => {
    if (currentTab !== 'chat') {
      setPrevTab(currentTab);
      window.history.pushState({ screen: 'chat' }, '');
    }
    setActiveThread(thread);
    setMessages(msgs);
    setCurrentTab('chat');
  };

  // 상단 헤더 뒤로가기 버튼 클릭 핸들러
  const handleBackFromChat = () => {
    if (window.history.state?.screen === 'chat') {
      window.history.back();
    } else {
      setCurrentTab(prevTab || 'friends');
    }
  };

  // 친구 카드를 눌러 1:1 대화 시작 (실제 친구는 공유 DM 스레드, AI는 개인 연습 스레드)
  const handleStartChatWithFriend = async (friend: Friend, forceNew = false) => {
    // A. 실제 친구와의 1:1 대화 (양방향 공유 DM 스레드)
    if (!friend.isAi && friend.email && user?.email) {
      const sharedThreadId = getSharedThreadId(user.email, friend.email);
      let targetThread = threads.find(t => t.id === sharedThreadId);

      if (!targetThread) {
        targetThread = {
          id: sharedThreadId,
          partnerName: friend.name,
          partnerEmail: friend.email,
          avatarBg: friend.avatarBg,
          avatarText: friend.avatarText,
          lastMessage: '대화를 시작해보세요.',
          messageCount: 0,
          updatedAt: Date.now(),
          unreadCount: 0,
          isAi: false
        };
        setThreads(prev => [targetThread!, ...prev.filter(t => t.id !== sharedThreadId)]);
        await storageService.saveThread(targetThread);
      } else {
        // 이미 방이 있으면 읽음 처리 후 입장
        targetThread = { ...targetThread, unreadCount: 0 };
        setThreads(prev => prev.map(t => t.id === sharedThreadId ? targetThread! : t));
        await storageService.markThreadAsRead(sharedThreadId);
      }

      let msgs = await storageService.getMessages(sharedThreadId);
      openChatScreen(targetThread, msgs);
      return;
    }

    // B. AI 친구와의 대화
    if (!forceNew) {
      const existing = threads.find(t => t.partnerName === friend.name && (t.isAi || !t.partnerEmail));
      if (existing) {
        let msgs = await storageService.getMessages(existing.id);
        if (msgs.length === 1 && (msgs[0].id.startsWith('msg-greeting') || msgs[0].text.includes('Ready to practice') || msgs[0].text.includes("Let's chat in English"))) {
          msgs = [];
        }
        openChatScreen(existing, msgs);
        return;
      }
    }

    const newThread: Thread = {
      id: `thread-${Date.now()}`,
      partnerName: friend.name,
      avatarBg: friend.avatarBg,
      avatarText: friend.avatarText,
      lastMessage: '대화를 시작해보세요.',
      messageCount: 0,
      updatedAt: Date.now(),
      unreadCount: 0,
      isAi: true
    };

    const updated = [newThread, ...threads];
    setThreads(updated);
    openChatScreen(newThread, []);

    await storageService.saveThread(newThread);
  };

  // 새 친구 추가
  const handleAddFriend = async (friend: Friend) => {
    await storageService.saveFriend(friend);
    setFriends((prev) => [friend, ...prev]);
  };

  // 친구 삭제
  const handleDeleteFriend = async (friendId: string) => {
    await storageService.deleteFriend(friendId);
    setFriends((prev) => prev.filter(f => f.id !== friendId));
  };

  // 활성 스레드 선택하여 대화방 입장 (카카오톡 스타일 읽음 처리)
  const handleSelectThread = async (thread: Thread) => {
    if (thread.id.startsWith('dm_') || (thread.unreadCount && thread.unreadCount > 0)) {
      await storageService.markThreadAsRead(thread.id);
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unreadCount: 0 } : t));
    }

    let msgs = await storageService.getMessages(thread.id);
    if (msgs.length === 1 && (msgs[0].id.startsWith('msg-greeting') || msgs[0].text.includes('Ready to practice') || msgs[0].text.includes("Let's chat in English"))) {
      msgs = [];
    }
    openChatScreen({ ...thread, unreadCount: 0 }, msgs);
  };

  // 대화방 삭제
  const handleDeleteThread = async (threadId: string) => {
    await storageService.deleteThread(threadId);
    setThreads((prev) => prev.filter(t => t.id !== threadId));
    if (activeThread?.id === threadId) {
      setActiveThread(null);
      setMessages([]);
      setCurrentTab('threads');
    }
  };

  // 새 스레드 직접 생성
  const handleCreateThread = async (partnerName: string) => {
    const newThread: Thread = {
      id: `thread-${Date.now()}`,
      partnerName,
      avatarBg: '#d0e1fb',
      avatarText: partnerName.charAt(0).toUpperCase(),
      lastMessage: '대화가 시작되었습니다.',
      updatedAt: Date.now()
    };
    const updated = [newThread, ...threads];
    setThreads(updated);
    openChatScreen(newThread, []);

    await storageService.saveThread(newThread);
  };

  // 전체 대화방 초기화 (Mock 및 기존 대화 청소)
  const handleClearAllThreads = async () => {
    if (confirm("모든 대화 목록을 비우시겠습니까?")) {
      await storageService.clearAllThreads();
      setThreads([]);
      setActiveThread(null);
      setMessages([]);
    }
  };

  // 메시지 전송 및 응답 처리 (실제 친구는 공유 저장 및 뱃지 전달, AI는 자동 응답)
  const handleSendMessage = async (
    text: string, 
    koreanDraft?: string, 
    recommendations?: RecommendationCard[],
    precomputedTranslation?: MessageTranslation
  ) => {
    if (!activeThread) return;
    const currentThreadId = activeThread.id;
    const currentPartnerName = activeThread.partnerName;
    const isFriendChat = !activeThread.isAi && Boolean(activeThread.partnerEmail);

    // 1. 유저 메시지 화면에 0ms 즉시 추가
    const userMsgId = `msg-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      senderEmail: user?.email || undefined,
      senderName: user?.displayName || undefined,
      text,
      timestamp: Date.now(),
      recommendations,
      translation: precomputedTranslation
    };

    // UI state 즉시 반영
    setMessages((prev) => [...prev, userMsg]);

    // 스레드 목록 프리뷰 즉시 업데이트
    setThreads(prev => prev.map(t => t.id === currentThreadId ? {
      ...t,
      lastMessage: userMsg.text,
      lastSender: 'user',
      messageCount: (t.messageCount || 0) + 1,
      updatedAt: userMsg.timestamp,
      unreadCount: 0
    } : t));

    // 로컬스토리지 및 Firestore 저장 (실제 친구인 경우 상대방 이메일 전달하여 상대방 대화방 뱃지 +1)
    await storageService.saveMessage(currentThreadId, userMsg, activeThread.partnerEmail);

    // 내 발화도 AI 발화와 동일하게 정식 한국어 해석과 핵심 어휘만 깔끔하게 비동기 생성 및 보존
    if (!precomputedTranslation) {
      aiService.translateMessageAsync(text).then((transData) => {
        if (transData && (transData.translation || transData.keyExpressions.length > 0)) {
          userMsg.translation = transData;
          storageService.saveMessage(currentThreadId, userMsg, activeThread.partnerEmail);
          setMessages(prev => prev.map(m => m.id === userMsgId ? { ...m, translation: transData } : m));
        }
      }).catch(e => console.warn("User message translation error:", e));
    }

    // 2. [실제 친구와의 대화인 경우] AI 자동 응답을 끄고 종료! (진짜 친구 간 대화 모드)
    if (isFriendChat) {
      return;
    }

    // 3. [AI 친구인 경우] AI 파트너의 응답 및 한국어 해석/핵심표현 일괄 생성 (즉시 응답)
    try {
      const replyData = await aiService.generateAssistantReplyAsync(
        currentPartnerName, 
        text
      );
      const assistantMsg: Message = {
        id: `msg-ai-${Date.now()}`,
        sender: 'assistant',
        text: replyData.reply,
        timestamp: Date.now(),
        translation: replyData.translation
      };

      // 사용자가 방을 나간 상태여도 백그라운드에서 스레드에 안전하게 저장 완료
      await storageService.saveMessage(currentThreadId, assistantMsg);

      // UI state 동기화
      setMessages((prev) => [...prev, assistantMsg]);
      setThreads(prev => prev.map(t => t.id === currentThreadId ? {
        ...t,
        lastMessage: assistantMsg.text,
        lastSender: 'assistant',
        messageCount: (t.messageCount || 0) + 1,
        updatedAt: assistantMsg.timestamp
      } : t));
    } catch (e) {
      console.warn("Assistant reply error:", e);
    }
  };

  // 표현 보관함 저장
  const handleSaveToArchive = async (exp: SavedExpression) => {
    setExpressions((prev) => [exp, ...prev]);
    await storageService.saveExpression(exp);
  };

  // 표현 보관함 삭제
  const handleDeleteExpression = async (id: string) => {
    await storageService.deleteExpression(id);
    setExpressions((prev) => prev.filter(e => e.id !== id));
  };

  return (
    <div className={`bg-[#faf8ff] text-[#1f1f1f] flex flex-col font-sans ${currentTab === 'chat' ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen'}`}>
      {/* PWA 모바일 프레임 컨테이너 */}
      <div className={`w-full max-w-md mx-auto flex flex-col bg-[#faf8ff] shadow-2xl relative ${currentTab === 'chat' ? 'h-full max-h-full overflow-hidden' : 'min-h-screen'}`}>
        {/* 상단 헤더 */}
        <Header 
          currentTab={currentTab} 
          activeThread={activeThread}
          onBack={handleBackFromChat}
          onOpenAdmin={() => setShowAdminModal(true)}
        />

        {/* 메인 뷰 컨텐츠 */}
        <main className={`flex-1 min-h-0 ${currentTab === 'chat' ? 'overflow-hidden flex flex-col' : 'overflow-x-hidden'}`}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#5f6368]">
              <div className="w-8 h-8 border-3 border-[#1a73e8] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-[13px] font-medium">데이터 로드 중...</p>
            </div>
          ) : (
            <>
              {/* 1. 친구 메뉴 */}
              {currentTab === 'friends' && (
                <FriendsView 
                  friends={friends}
                  groupMembers={groupMembers}
                  threads={threads}
                  onStartChat={handleStartChatWithFriend}
                  onAddFriend={handleAddFriend}
                  onDeleteFriend={handleDeleteFriend}
                />
              )}

              {/* 2. 대화 목록 메뉴 */}
              {currentTab === 'threads' && (
                <ThreadsView 
                  threads={threads}
                  friends={friends}
                  activeThreadId={activeThread?.id || ''}
                  onSelectThread={handleSelectThread}
                  onStartChatWithFriend={handleStartChatWithFriend}
                  onDeleteThread={handleDeleteThread}
                  onClearAllThreads={handleClearAllThreads}
                  onNavigateToFriends={() => setCurrentTab('friends')}
                />
              )}

              {/* 3. 실시간 1:1 채팅 뷰 (하단 내비바 숨김) */}
              {currentTab === 'chat' && activeThread && (
                <ChatView 
                  activeThread={activeThread}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                />
              )}

              {/* 4. 표현 및 대본 보관함 뷰 */}
              {currentTab === 'archive' && (
                <ArchiveView 
                  expressions={expressions}
                  scripts={scripts}
                  onAddExpression={handleSaveToArchive}
                  onDeleteExpression={handleDeleteExpression}
                />
              )}
            </>
          )}
        </main>

        {/* 하단 내비게이션 바 (카카오톡 스타일 안 읽은 총 개수 뱃지 표시, 채팅 중일 때는 숨김) */}
        {currentTab !== 'chat' && (
          <BottomNav 
            currentTab={currentTab} 
            onSelectTab={(tab) => setCurrentTab(tab)}
            unreadCount={threads.reduce((acc, t) => acc + (t.unreadCount || 0), 0)}
          />
        )}
      </div>

      {/* 어드민 계정 일괄 관리 모달 */}
      {showAdminModal && (
        <AdminModal onClose={() => setShowAdminModal(false)} />
      )}

      {/* 프로젝트 & 데이터베이스 정보 모달 */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#e0e3e7]">
              <h3 className="text-[16px] font-bold text-[#1f1f1f] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1a73e8]">cloud_done</span>
                프로젝트 & 인증 정보
              </h3>
              <button onClick={() => setShowInfoModal(false)} className="text-[#5f6368]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-[13px] text-[#444746] leading-relaxed">
              <div className="p-3 bg-[#e8f0fe] rounded-2xl">
                <span className="text-[11px] font-bold text-[#1a73e8] block mb-1">
                  🔒 Firestore 단일 컬렉션 + 계정별 격리
                </span>
                <p className="text-[12px]">
                  루트 컬렉션 <code className="bg-white px-1.5 py-0.5 rounded text-[#001d35] font-mono">english-conversation-helper</code> 하위에서 로그인한 사용자의 UID별로 데이터를 격리 저장합니다.
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <p><strong>접속 계정:</strong> {user?.email}</p>
                <p><strong>실행 모드:</strong> {appTarget === 'family' ? '🏡 가족 전용 (family-eb4f8)' : '🏫 학교 전용 (studio-2726051254-c02c9)'}</p>
                <p><strong>등록 계정 수:</strong> {allowedEmails.length}개 허용됨</p>
                <p><strong>학교 허용 도메인:</strong> {allowedDomains.join(', ') || '없음'}</p>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2.5 bg-[#1a73e8] text-white font-semibold rounded-2xl text-[13px] hover:bg-[#1557b0]"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafd] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-[#1a73e8] border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-[13px] text-[#5f6368] font-medium">안전한 로그인 상태 확인 중...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return <MainApp />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
