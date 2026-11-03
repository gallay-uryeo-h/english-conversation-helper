import React, { useState, useEffect } from 'react';
import { MainTab, Thread, Message, SavedExpression, SavedScript, RecommendationCard, Friend, GroupMember } from './types';
import { storageService, DEFAULT_FRIENDS } from './services/storageService';
import { aiService } from './services/aiService';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { FriendsView } from './components/FriendsView';
import { ThreadsView } from './components/ThreadsView';
import { ChatView } from './components/ChatView';
import { AnalysisView } from './components/AnalysisView';
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
  const [selectedMessageForAnalysis, setSelectedMessageForAnalysis] = useState<Message | null>(null);
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
        // 로그인한 사용자 UID로 데이터 스토리지 격리
        storageService.setUserId(user.uid);

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
          const msgs = await storageService.getMessages(fetchedThreads[0].id);
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

  // 친구 카드를 눌러 1:1 대화 시작
  const handleStartChatWithFriend = async (friend: Friend) => {
    // 1. 이미 해당 친구와의 대화방이 있는지 확인
    const existing = threads.find(t => t.partnerName === friend.name);
    if (existing) {
      const msgs = await storageService.getMessages(existing.id);
      openChatScreen(existing, msgs);
      return;
    }

    // 2. 새 대화방 개설
    const newThread: Thread = {
      id: `thread-${Date.now()}`,
      partnerName: friend.name,
      avatarBg: friend.avatarBg,
      avatarText: friend.avatarText,
      lastMessage: '대화가 시작되었습니다.',
      updatedAt: Date.now()
    };

    // 3. 친구의 첫 인사 메시지 자동 생성
    const greetingMsg: Message = {
      id: `msg-greeting-${Date.now()}`,
      sender: 'assistant',
      text: friend.isAi 
        ? 'Hi there! Ready to practice English conversation today?' 
        : `Hi! Let's chat in English! 😊`,
      timestamp: Date.now()
    };

    const updated = [newThread, ...threads];
    setThreads(updated);
    openChatScreen(newThread, [greetingMsg]);

    await storageService.saveThread(newThread);
    await storageService.saveMessage(newThread.id, greetingMsg);
  };

  // 새 친구 추가
  const handleAddFriend = async (friend: Friend) => {
    await storageService.saveFriend(friend);
    setFriends((prev) => [friend, ...prev]);
  };

  // 활성 스레드 선택하여 대화방 입장
  const handleSelectThread = async (thread: Thread) => {
    const msgs = await storageService.getMessages(thread.id);
    openChatScreen(thread, msgs);
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

  // 메시지 전송 및 AI 응답 처리
  const handleSendMessage = async (
    text: string, 
    koreanDraft?: string, 
    recommendations?: RecommendationCard[]
  ) => {
    if (!activeThread) return;

    // 1. 유저 메시지 생성 및 분석 (Groq AI 또는 로컬 분석)
    const analysis = await aiService.analyzeMessageAsync(text, koreanDraft);
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      koreanDraft,
      timestamp: Date.now(),
      recommendations,
      analysis
    };

    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setSelectedMessageForAnalysis(userMsg);
    await storageService.saveMessage(activeThread.id, userMsg);

    // 2. AI 파트너의 응답 생성
    setTimeout(async () => {
      const replyText = await aiService.generateAssistantReplyAsync(
        activeThread.partnerName, 
        text
      );
      const assistantMsg: Message = {
        id: `msg-ai-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await storageService.saveMessage(activeThread.id, assistantMsg);
    }, 850);
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
    <div className="min-h-screen bg-[#faf8ff] text-[#1f1f1f] flex flex-col font-sans">
      {/* PWA 모바일 프레임 컨테이너 */}
      <div className="w-full max-w-md mx-auto min-h-screen flex flex-col bg-[#faf8ff] shadow-2xl relative">
        {/* 상단 헤더 */}
        <Header 
          currentTab={currentTab} 
          activeThread={activeThread}
          onBack={handleBackFromChat}
          onOpenAdmin={() => setShowAdminModal(true)}
        />

        {/* 메인 뷰 컨텐츠 */}
        <main className="flex-1 overflow-x-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#5f6368]">
              <div className="w-8 h-8 border-3 border-[#1a73e8] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-[13px] font-medium">데이터 로드 중...</p>
            </div>
          ) : (
            <>
              {/* 1. 회화 친구 메뉴 */}
              {currentTab === 'friends' && (
                <FriendsView 
                  friends={friends}
                  groupMembers={groupMembers}
                  onStartChat={handleStartChatWithFriend}
                  onAddFriend={handleAddFriend}
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
                  onNavigateToFriends={() => setCurrentTab('friends')}
                />
              )}

              {/* 3. 실시간 1:1 채팅 뷰 (하단 내비바 숨김) */}
              {currentTab === 'chat' && activeThread && (
                <ChatView 
                  activeThread={activeThread}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onSelectMessageForAnalysis={(msg) => {
                    setSelectedMessageForAnalysis(msg);
                    setCurrentTab('analysis');
                  }}
                />
              )}

              {/* 4. 언어 인스펙터 분석 뷰 */}
              {currentTab === 'analysis' && (
                <AnalysisView 
                  selectedMessage={selectedMessageForAnalysis}
                  onSaveToArchive={handleSaveToArchive}
                />
              )}

              {/* 5. 표현 및 대본 보관함 뷰 */}
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

        {/* 하단 내비게이션 바 (채팅 중일 때는 대화에 집중하도록 숨김) */}
        {currentTab !== 'chat' && (
          <BottomNav 
            currentTab={currentTab} 
            onSelectTab={(tab) => setCurrentTab(tab)}
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
