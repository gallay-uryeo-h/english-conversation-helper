import React, { useState, useEffect } from 'react';
import { MainTab, Thread, Message, SavedExpression, SavedScript, RecommendationCard } from './types';
import { storageService } from './services/storageService';
import { aiService } from './services/aiService';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ThreadsView } from './components/ThreadsView';
import { ChatView } from './components/ChatView';
import { AnalysisView } from './components/AnalysisView';
import { ArchiveView } from './components/ArchiveView';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<MainTab>('threads');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [expressions, setExpressions] = useState<SavedExpression[]>([]);
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [selectedMessageForAnalysis, setSelectedMessageForAnalysis] = useState<Message | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // 초기 데이터 로드 (Firestore)
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        const fetchedThreads = await storageService.getThreads();
        setThreads(fetchedThreads);
        if (fetchedThreads.length > 0) {
          setActiveThread(fetchedThreads[0]);
          const msgs = await storageService.getMessages(fetchedThreads[0].id);
          setMessages(msgs);
        }
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
  }, []);

  // 활성 스레드 변경 시 해당 스레드의 메시지 로드
  const handleSelectThread = async (thread: Thread) => {
    setActiveThread(thread);
    const msgs = await storageService.getMessages(thread.id);
    setMessages(msgs);
    setCurrentTab('chat');
  };

  // 새 스레드 생성
  const handleCreateThread = async (title: string, partnerName: string) => {
    const newThread: Thread = {
      id: `thread-${Date.now()}`,
      title,
      partnerName,
      partnerRole: 'Conversational Partner',
      avatarBg: '#d0e1fb',
      avatarText: partnerName.charAt(0),
      lastMessage: '대화가 시작되었습니다.',
      updatedAt: Date.now(),
      category: 'daily'
    };
    const updated = [newThread, ...threads];
    setThreads(updated);
    setActiveThread(newThread);
    setMessages([]);
    setCurrentTab('chat');
  };

  // 메시지 전송 및 AI 응답 처리
  const handleSendMessage = async (
    text: string, 
    koreanDraft?: string, 
    recommendations?: RecommendationCard[]
  ) => {
    if (!activeThread) return;

    // 1. 유저 메시지 생성 및 분석
    const analysis = aiService.analyzeMessage(text, koreanDraft);
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

    // 2. AI 파트너의 응답 생성 (실시간 느낌)
    setTimeout(async () => {
      const replyText = aiService.generateAssistantReply(activeThread.partnerName, text);
      const assistantMsg: Message = {
        id: `msg-ai-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await storageService.saveMessage(activeThread.id, assistantMsg);
    }, 900);
  };

  // 표현 보관함 저장
  const handleSaveToArchive = async (exp: SavedExpression) => {
    setExpressions((prev) => [exp, ...prev]);
    await storageService.saveExpression(exp);
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#1f1f1f] flex flex-col font-sans">
      {/* PWA 모바일 프레임 컨테이너 */}
      <div className="w-full max-w-md mx-auto min-h-screen flex flex-col bg-[#faf8ff] shadow-2xl relative">
        {/* 상단 헤더 */}
        <Header 
          currentTab={currentTab} 
          activeThread={activeThread}
          onBack={() => setCurrentTab('threads')}
          onOpenInfo={() => setShowInfoModal(true)}
        />

        {/* 메인 뷰 컨텐츠 */}
        <main className="flex-1 overflow-x-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#5f6368]">
              <div className="w-8 h-8 border-3 border-[#1a73e8] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-[13px] font-medium">Firestore 데이터 로드 중...</p>
            </div>
          ) : (
            <>
              {currentTab === 'threads' && (
                <ThreadsView 
                  threads={threads}
                  activeThreadId={activeThread?.id || ''}
                  onSelectThread={handleSelectThread}
                  onCreateThread={handleCreateThread}
                />
              )}

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

              {currentTab === 'analysis' && (
                <AnalysisView 
                  selectedMessage={selectedMessageForAnalysis}
                  onSaveToArchive={handleSaveToArchive}
                />
              )}

              {currentTab === 'archive' && (
                <ArchiveView 
                  expressions={expressions}
                  scripts={scripts}
                  onAddExpression={handleSaveToArchive}
                />
              )}
            </>
          )}
        </main>

        {/* 하단 내비게이션 바 */}
        <BottomNav 
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
        />
      </div>

      {/* 프로젝트 & 데이터베이스 정보 모달 */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#e0e3e7]">
              <h3 className="text-[16px] font-bold text-[#1f1f1f] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1a73e8]">cloud_done</span>
                PWA & Firestore 설정
              </h3>
              <button onClick={() => setShowInfoModal(false)} className="text-[#5f6368]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-[13px] text-[#444746] leading-relaxed">
              <div className="p-3 bg-[#e8f0fe] rounded-2xl">
                <span className="text-[11px] font-bold text-[#1a73e8] block mb-1">
                  🔒 Firestore 단일 컬렉션 정책 준수
                </span>
                <p className="text-[12px]">
                  다른 앱과의 충돌 방지를 위해 단일 루트 컬렉션인 
                  <code className="bg-white px-1.5 py-0.5 rounded text-[#001d35] font-mono ml-1">english-conversation-helper</code>
                  하위에서만 모든 데이터를 격리 관리합니다.
                </p>
              </div>

              <div>
                <p><strong>프로젝트:</strong> studio-2726051254-c02c9</p>
                <p><strong>디자인 테마:</strong> Stitch Linguistic Flow (Inter / Hanken Grotesk)</p>
                <p><strong>PWA:</strong> 오프라인 캐싱 & 웹앱 설치 지원</p>
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

export default App;

