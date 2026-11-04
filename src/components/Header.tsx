import React, { useState, useEffect } from 'react';
import { MainTab, Thread } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  testGeminiConnection, 
  testGroqConnection, 
  getGeminiApiKey, 
  getGroqApiKey,
  GEMINI_DEFAULT_MODEL,
  GROQ_DEFAULT_MODEL
} from '../services/aiService';

interface HeaderProps {
  currentTab: MainTab;
  activeThread: Thread | null;
  onBack?: () => void;
  onOpenAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  currentTab, 
  activeThread, 
  onBack, 
  onOpenAdmin 
}) => {
  const { user, logout, appTarget, isAdmin } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Gemini API 상태 관리
  const envGeminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
  const [geminiCustomKey, setGeminiCustomKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showGeminiKeyText, setShowGeminiKeyText] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'checking' | 'ok' | 'error' | 'none'>('idle');
  const [geminiLatency, setGeminiLatency] = useState<number | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [showGeminiCustomInput, setShowGeminiCustomInput] = useState(false);
  const [geminiSaveStatus, setGeminiSaveStatus] = useState<string | null>(null);

  // Groq API 상태 관리
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem('groq_api_key') || '');
  const [showGroqKeyText, setShowGroqKeyText] = useState(false);
  const [groqStatus, setGroqStatus] = useState<'idle' | 'checking' | 'ok' | 'error' | 'none'>('idle');
  const [groqLatency, setGroqLatency] = useState<number | null>(null);
  const [groqError, setGroqError] = useState<string | null>(null);
  const [showGroqAccordion, setShowGroqAccordion] = useState(false);
  const [groqSaveStatus, setGroqSaveStatus] = useState<string | null>(null);

  // Gemini 연결 테스트 실행
  const runGeminiTest = async () => {
    setGeminiStatus('checking');
    setGeminiError(null);
    const result = await testGeminiConnection();
    setGeminiStatus(result.status);
    if (result.latencyMs !== undefined) setGeminiLatency(result.latencyMs);
    if (result.error) setGeminiError(result.error);
  };

  // Groq 연결 테스트 실행
  const runGroqTest = async () => {
    setGroqStatus('checking');
    setGroqError(null);
    const result = await testGroqConnection();
    setGroqStatus(result.status);
    if (result.latencyMs !== undefined) setGroqLatency(result.latencyMs);
    if (result.error) setGroqError(result.error);
  };

  // 마운트 시 초기 연결 상태 검사
  useEffect(() => {
    const activeGeminiKey = getGeminiApiKey();
    if (activeGeminiKey) {
      runGeminiTest();
    } else {
      setGeminiStatus('none');
    }

    const activeGroqKey = getGroqApiKey();
    if (activeGroqKey) {
      runGroqTest();
    } else {
      setGroqStatus('none');
    }
  }, []);

  const handleSaveGeminiKey = () => {
    const trimmed = geminiCustomKey.trim();
    if (trimmed) {
      localStorage.setItem('gemini_api_key', trimmed);
      setGeminiSaveStatus('Gemini 키가 저장되었습니다!');
    } else {
      localStorage.removeItem('gemini_api_key');
      setGeminiSaveStatus('Gemini 키가 삭제되었습니다.');
    }
    setTimeout(() => {
      setGeminiSaveStatus(null);
      runGeminiTest();
    }, 1200);
  };

  const handleClearGeminiKey = () => {
    localStorage.removeItem('gemini_api_key');
    setGeminiCustomKey('');
    setGeminiSaveStatus('Gemini 키가 삭제되었습니다.');
    setTimeout(() => {
      setGeminiSaveStatus(null);
      runGeminiTest();
    }, 1200);
  };

  const handleSaveGroqKey = () => {
    const trimmed = groqKey.trim();
    if (trimmed) {
      localStorage.setItem('groq_api_key', trimmed);
      setGroqSaveStatus('Groq 키가 저장되었습니다!');
    } else {
      localStorage.removeItem('groq_api_key');
      setGroqSaveStatus('Groq 키가 삭제되었습니다.');
    }
    setTimeout(() => {
      setGroqSaveStatus(null);
      runGroqTest();
    }, 1200);
  };

  const handleClearGroqKey = () => {
    localStorage.removeItem('groq_api_key');
    setGroqKey('');
    setGroqSaveStatus('Groq 키가 삭제되었습니다.');
    setTimeout(() => {
      setGroqSaveStatus(null);
      runGroqTest();
    }, 1200);
  };

  // PWA 설치 감지
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      alert("iOS Safari 브라우저는 하단의 [공유] 아이콘을 누른 후 [홈 화면에 추가]를 선택하시면 앱으로 설치할 수 있습니다.");
    }
  };

  // 헤더 상단 AI 상태 뱃지 판별
  const getAiBadgeInfo = () => {
    if (geminiStatus === 'ok') {
      return {
        label: `Gemini 3.5 (${geminiLatency ? `${geminiLatency}ms` : '정상'})`,
        dotClass: 'bg-[#188038]',
        bgClass: 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]',
        title: 'Gemini 3.5 Flash-Lite 정상 연결됨 (주력 엔진 작동 중)'
      };
    }
    if (geminiStatus === 'checking') {
      return {
        label: 'Gemini 연결 확인 중...',
        dotClass: 'bg-[#1a73e8] animate-ping',
        bgClass: 'bg-[#e8f0fe] text-[#1a73e8] border-[#c2e7ff]',
        title: 'Gemini API 연결 확인 중'
      };
    }
    if (groqStatus === 'ok') {
      return {
        label: `Groq 백업 (${groqLatency ? `${groqLatency}ms` : '정상'})`,
        dotClass: 'bg-[#f29900]',
        bgClass: 'bg-[#fef7e0] text-[#b06000] border-[#feefc3]',
        title: 'Gemini 미연결 -> Groq 백업 엔진 작동 중'
      };
    }
    if (geminiStatus === 'error' || groqStatus === 'error') {
      return {
        label: '로컬 엔진 작동 (오프라인)',
        dotClass: 'bg-[#ea4335]',
        bgClass: 'bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]',
        title: 'AI API 오류로 로컬 내장 엔진이 작동 중입니다. 프로필을 눌러 상태를 확인하세요.'
      };
    }
    return {
      label: '로컬 엔진 작동',
      dotClass: 'bg-[#5f6368]',
      bgClass: 'bg-[#f1f3f4] text-[#444746] border-[#dadce0]',
      title: 'API 키 미등록 - 로컬 지능형 엔진 작동 중'
    };
  };

  const badge = getAiBadgeInfo();

  return (
    <header className="sticky top-0 z-40 bg-[#f0f4f9] border-b border-[#e0e3e7] pt-[env(safe-area-inset-top,0px)] w-full relative">
      <div className="h-14 px-3 sm:px-4 flex items-center justify-between w-full">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && currentTab === 'chat' && (
            <button 
              onClick={onBack}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#444746] hover:bg-black/5 active:scale-95 shrink-0"
              title="이전 화면으로 돌아가기"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          )}

          <div className="truncate">
            <h1 className="text-[17px] font-semibold text-[#1f1f1f] truncate leading-tight flex items-center gap-1.5">
              {currentTab === 'friends' && (
                <>
                  <span className="material-symbols-outlined text-[#1a73e8] text-[20px]">group</span>
                  회화 친구
                </>
              )}
              {currentTab === 'threads' && (
                <>
                  <span className="material-symbols-outlined text-[#1a73e8] text-[20px]">forum</span>
                  대화 목록
                </>
              )}
              {currentTab === 'chat' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#188038] animate-pulse shrink-0"></span>
                  <span className="truncate">{activeThread?.partnerName || '대화'}</span>
                </>
              )}
              {currentTab === 'archive' && (
                <>
                  <span className="material-symbols-outlined text-[#795900] text-[20px]">bookmark</span>
                  표현 보관함
                </>
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 개발 및 운영용 실시간 AI 연결 상태 뱃지 버튼 */}
          <button
            onClick={() => setShowProfileMenu(true)}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${badge.bgClass}`}
            title={badge.title}
          >
            <span className={`w-2 h-2 rounded-full ${badge.dotClass} shrink-0`}></span>
            <span className="font-mono">{badge.label}</span>
          </button>

          {/* 유저 프로필 아바타 버튼 */}
          {user && (
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="relative w-8 h-8 rounded-full overflow-hidden border border-[#dadce0] hover:ring-2 hover:ring-[#1a73e8]/30 transition-all flex items-center justify-center bg-[#e8f0fe] text-[#1a73e8] text-xs font-bold shrink-0"
              title={`${user.displayName || user.email} 프로필 및 AI 설정`}
            >
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>
              )}

              {/* 관리자 뱃지 도트 */}
              {isAdmin && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#f29900] border-2 border-white rounded-full"></span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 프로필 및 AI 상태 모니터 팝업 메뉴 */}
      {showProfileMenu && user && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/10" 
            onClick={() => setShowProfileMenu(false)}
          />
          <div className="absolute right-3 sm:right-4 top-14 mt-1 w-80 sm:w-96 max-h-[88vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-[#dadce0] p-4 z-50 animate-fadeIn text-left space-y-3">
            
            {/* 유저 정보 */}
            <div className="flex items-center gap-3 pb-3 border-b border-[#f1f3f4]">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#e8f0fe] flex items-center justify-center text-[#1a73e8] font-bold text-sm shrink-0">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#1f1f1f] truncate">
                  {user.displayName || '사용자'}
                </p>
                <p className="text-[11px] text-[#5f6368] truncate">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${
                appTarget === 'family' ? 'bg-[#e8f0fe] text-[#1967d2]' : 'bg-[#e6f4ea] text-[#137333]'
              }`}>
                {appTarget === 'family' ? '🏡 가족 모드' : '🏫 학교 모드'}
              </span>
              {isAdmin && (
                <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#fef7e0] text-[#b06000]">
                  👑 마스터 관리자
                </span>
              )}
            </div>

            {/* AI 연결 및 모델 상태 모니터 (개발/운영 모니터) */}
            <div className="p-3 bg-[#f8fafd] rounded-2xl border border-[#d2e3fc] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#1a73e8] text-[20px]">smart_toy</span>
                  <span className="text-[13px] font-bold text-[#1f1f1f]">AI 엔진 연결 상태</span>
                </div>
                <span className="text-[10px] bg-[#e8f0fe] text-[#1a73e8] px-2 py-0.5 rounded-md font-semibold">
                  개발 모니터
                </span>
              </div>

              {/* 1. Gemini 3.5 Flash-Lite (주력 엔진) */}
              <div className="p-2.5 bg-white rounded-xl border border-[#e0e3e7] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#1a73e8] text-[16px]">stars</span>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[12px] font-bold text-[#1f1f1f]">Gemini 3.5</span>
                        <span className="text-[10px] bg-[#e8f0fe] text-[#1967d2] font-semibold px-1.5 py-0.2 rounded">주력</span>
                      </div>
                      <p className="text-[10px] text-[#747775] font-mono leading-tight">{GEMINI_DEFAULT_MODEL}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {geminiStatus === 'ok' && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-[#188038] bg-[#e6f4ea] px-2 py-0.5 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-[#188038]"></span>
                        {geminiLatency ? `${geminiLatency}ms` : '연결됨'}
                      </span>
                    )}
                    {geminiStatus === 'checking' && (
                      <span className="text-[11px] text-[#1a73e8] bg-[#e8f0fe] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#1a73e8] animate-ping"></span>
                        확인 중
                      </span>
                    )}
                    {geminiStatus === 'error' && (
                      <span className="text-[11px] text-[#d93025] bg-[#fce8e6] px-2 py-0.5 rounded-full font-semibold">
                        ● 오류
                      </span>
                    )}
                    {geminiStatus === 'none' && (
                      <span className="text-[11px] text-[#747775] bg-[#f1f3f4] px-2 py-0.5 rounded-full">
                        키 미설정
                      </span>
                    )}
                    
                    <button
                      type="button"
                      onClick={runGeminiTest}
                      disabled={geminiStatus === 'checking'}
                      className="px-2 py-1 text-[11px] bg-[#f1f3f4] hover:bg-[#e0e3e7] text-[#1f1f1f] rounded-lg font-medium transition-colors active:scale-95 flex items-center gap-0.5"
                      title="연결 테스트"
                    >
                      <span className="material-symbols-outlined text-[13px]">refresh</span>
                      테스트
                    </button>
                  </div>
                </div>

                {/* Gemini 키 출처 표시 */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#f1f3f4] text-[#5f6368]">
                  <span>
                    키 출처:{' '}
                    {geminiCustomKey ? (
                      <strong className="text-[#1a73e8]">브라우저 직접 설정</strong>
                    ) : envGeminiKey ? (
                      <strong className="text-[#137333]">서버 환경변수 (배포 자동적용)</strong>
                    ) : (
                      <span className="text-[#d93025]">서버/로컬 키 없음</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowGeminiCustomInput(!showGeminiCustomInput)}
                    className="text-[10px] text-[#1a73e8] hover:underline"
                  >
                    {showGeminiCustomInput ? '키 입력 닫기' : '키 직접 입력'}
                  </button>
                </div>

                {/* 에러 상세 메시지 */}
                {geminiError && (
                  <p className="text-[10px] text-[#d93025] bg-[#fce8e6] p-1.5 rounded-lg break-all font-mono">
                    {geminiError}
                  </p>
                )}

                {/* 개발용 커스텀 Gemini 키 입력창 */}
                {showGeminiCustomInput && (
                  <div className="space-y-1.5 pt-1.5 bg-[#f8fafd] p-2 rounded-lg border border-[#e0e3e7]">
                    <p className="text-[10px] text-[#5f6368]">
                      개발/테스트용으로 내 Gemini API 키를 브라우저에 임시 설정할 수 있습니다.
                    </p>
                    <div className="relative flex items-center">
                      <input
                        type={showGeminiKeyText ? 'text' : 'password'}
                        value={geminiCustomKey}
                        onChange={(e) => setGeminiCustomKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full text-[11px] font-mono px-2 py-1 pr-7 bg-white border border-[#dadce0] rounded-lg outline-none focus:border-[#1a73e8]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKeyText(!showGeminiKeyText)}
                        className="absolute right-1.5 text-[#747775]"
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {showGeminiKeyText ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                    <div className="flex items-center justify-end gap-1 pt-1">
                      {geminiCustomKey && (
                        <button
                          type="button"
                          onClick={handleClearGeminiKey}
                          className="px-2 py-0.5 text-[10px] text-[#d93025] hover:bg-[#fce8e6] rounded font-medium"
                        >
                          삭제
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveGeminiKey}
                        className="px-2.5 py-0.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded text-[10px] font-semibold"
                      >
                        저장 및 테스트
                      </button>
                    </div>
                    {geminiSaveStatus && (
                      <p className="text-[10px] text-[#188038] text-center font-medium">
                        {geminiSaveStatus}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Groq SDK (백업 엔진) */}
              <div className="p-2.5 bg-white rounded-xl border border-[#e0e3e7] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#f29900] text-[16px]">bolt</span>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[12px] font-bold text-[#1f1f1f]">Groq</span>
                        <span className="text-[10px] bg-[#fef7e0] text-[#b06000] font-semibold px-1.5 py-0.2 rounded">백업</span>
                      </div>
                      <p className="text-[10px] text-[#747775] font-mono leading-tight">{GROQ_DEFAULT_MODEL}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {groqStatus === 'ok' && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-[#188038] bg-[#e6f4ea] px-2 py-0.5 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-[#188038]"></span>
                        {groqLatency ? `${groqLatency}ms` : '연결됨'}
                      </span>
                    )}
                    {groqStatus === 'checking' && (
                      <span className="text-[11px] text-[#f29900] bg-[#fef7e0] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#f29900] animate-ping"></span>
                        확인 중
                      </span>
                    )}
                    {groqStatus === 'error' && (
                      <span className="text-[11px] text-[#d93025] bg-[#fce8e6] px-2 py-0.5 rounded-full font-semibold">
                        ● 오류
                      </span>
                    )}
                    {groqStatus === 'none' && (
                      <span className="text-[11px] text-[#747775] bg-[#f1f3f4] px-2 py-0.5 rounded-full">
                        키 미설정
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={runGroqTest}
                      disabled={groqStatus === 'checking'}
                      className="px-2 py-1 text-[11px] bg-[#f1f3f4] hover:bg-[#e0e3e7] text-[#1f1f1f] rounded-lg font-medium transition-colors active:scale-95 flex items-center gap-0.5"
                      title="연결 테스트"
                    >
                      <span className="material-symbols-outlined text-[13px]">refresh</span>
                      테스트
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#f1f3f4] text-[#5f6368]">
                  <span>Gemini 장애 시 초고속 자동 전환 백업</span>
                  <button
                    type="button"
                    onClick={() => setShowGroqAccordion(!showGroqAccordion)}
                    className="text-[10px] text-[#1a73e8] hover:underline"
                  >
                    {showGroqAccordion ? '키 설정 닫기' : '키 설정 열기'}
                  </button>
                </div>

                {groqError && (
                  <p className="text-[10px] text-[#d93025] bg-[#fce8e6] p-1.5 rounded-lg break-all font-mono">
                    {groqError}
                  </p>
                )}

                {showGroqAccordion && (
                  <div className="space-y-1.5 pt-1.5 bg-[#f8fafd] p-2 rounded-lg border border-[#e0e3e7]">
                    <div className="relative flex items-center">
                      <input
                        type={showGroqKeyText ? 'text' : 'password'}
                        value={groqKey}
                        onChange={(e) => setGroqKey(e.target.value)}
                        placeholder="gsk_..."
                        className="w-full text-[11px] font-mono px-2 py-1 pr-7 bg-white border border-[#dadce0] rounded-lg outline-none focus:border-[#1a73e8]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGroqKeyText(!showGroqKeyText)}
                        className="absolute right-1.5 text-[#747775]"
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {showGroqKeyText ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#1a73e8] hover:underline flex items-center gap-0.5"
                      >
                        <span>무료 키 발급</span>
                        <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                      </a>
                      <div className="flex items-center gap-1">
                        {groqKey && (
                          <button
                            type="button"
                            onClick={handleClearGroqKey}
                            className="px-2 py-0.5 text-[10px] text-[#d93025] hover:bg-[#fce8e6] rounded font-medium"
                          >
                            삭제
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSaveGroqKey}
                          className="px-2.5 py-0.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded text-[10px] font-semibold"
                        >
                          저장 및 테스트
                        </button>
                      </div>
                    </div>

                    {groqSaveStatus && (
                      <p className="text-[10px] text-[#188038] text-center font-medium">
                        {groqSaveStatus}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 3. 로컬 지능형 엔진 */}
              <div className="flex items-center justify-between px-2.5 py-2 bg-white rounded-xl border border-[#e0e3e7] text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#5f6368] text-[16px]">memory</span>
                  <div>
                    <span className="font-semibold text-[#1f1f1f]">내장 규칙 엔진</span>
                    <span className="text-[10px] text-[#747775] ml-1.5">(오프라인 폴백)</span>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-medium text-[#188038]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#188038]"></span>
                  상시 대기
                </span>
              </div>
            </div>

            {/* 홈 화면에 앱 설치하기 버튼 (PWA) */}
            <button
              onClick={() => {
                setShowProfileMenu(false);
                handleInstallClick();
              }}
              className="w-full py-2 px-3 bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#1a73e8] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-[#c2e7ff]"
            >
              <span className="material-symbols-outlined text-[16px]">install_mobile</span>
              홈 화면에 앱 설치하기
            </button>

            {/* 어드민 계정 관리 버튼 (관리자만 노출) */}
            {isAdmin && onOpenAdmin && (
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onOpenAdmin();
                }}
                className="w-full py-2 px-3 bg-[#fef7e0] hover:bg-[#feefc3] text-[#b06000] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-[#fbd65c]"
              >
                <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                접근 허용 계정 관리
              </button>
            )}

            {/* 로그아웃 버튼 */}
            <button
              onClick={() => {
                setShowProfileMenu(false);
                logout();
              }}
              className="w-full py-2 px-3 bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#d93025] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              로그아웃
            </button>
          </div>
        </>
      )}
    </header>
  );
};
