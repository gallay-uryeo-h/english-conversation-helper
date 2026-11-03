import React, { useState, useEffect } from 'react';
import { MainTab, Thread } from '../types';
import { useAuth } from '../contexts/AuthContext';

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

  // Groq API 키 상태 관리
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem('groq_api_key') || '');
  const [showKeyText, setShowKeyText] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showKeyAccordion, setShowKeyAccordion] = useState(!localStorage.getItem('groq_api_key'));

  const handleSaveGroqKey = () => {
    const trimmed = groqKey.trim();
    if (trimmed) {
      localStorage.setItem('groq_api_key', trimmed);
      setSaveStatus('API 키가 저장되었습니다!');
    } else {
      localStorage.removeItem('groq_api_key');
      setSaveStatus('API 키가 삭제되었습니다.');
    }
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleClearGroqKey = () => {
    localStorage.removeItem('groq_api_key');
    setGroqKey('');
    setSaveStatus('API 키가 삭제되었습니다.');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  // PWA 설치 가능 여부 감지 (Chrome / Edge / Android)
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

  return (
    <header className="sticky top-0 z-40 bg-[#f0f4f9] border-b border-[#e0e3e7] pt-[env(safe-area-inset-top,0px)] w-full relative">
      <div className="h-14 px-4 flex items-center justify-between w-full">
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
              {currentTab === 'analysis' && (
                <>
                  <span className="material-symbols-outlined text-[#00897b] text-[20px]">insights</span>
                  언어 인스펙터
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

        <div className="flex items-center gap-1">
          {/* 유저 프로필 아바타 버튼 (헤더에는 이 버튼 하나만 깔끔하게 유지) */}
          {user && (
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="relative w-8 h-8 rounded-full overflow-hidden border border-[#dadce0] hover:ring-2 hover:ring-[#1a73e8]/30 transition-all flex items-center justify-center bg-[#e8f0fe] text-[#1a73e8] text-xs font-bold shrink-0"
              title={`${user.displayName || user.email} 프로필`}
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

      {/* 프로필 팝업 메뉴 */}
      {showProfileMenu && user && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowProfileMenu(false)}
          />
          <div className="absolute right-4 top-14 mt-1 w-72 sm:w-80 max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-[#dadce0] p-4 z-50 animate-fadeIn text-left">
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

            <div className="py-2 space-y-1">
              <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${
                appTarget === 'family' ? 'bg-[#e8f0fe] text-[#1967d2]' : 'bg-[#e6f4ea] text-[#137333]'
              }`}>
                {appTarget === 'family' ? '🏡 가족 모드 접속 중' : '🏫 학교 모드 접속 중'}
              </span>
              {isAdmin && (
                <span className="block text-[10px] font-bold text-[#b06000]">
                  👑 마스터 관리자 권한
                </span>
              )}
            </div>

            {/* AI API 키 설정 (Groq) */}
            <div className="my-2 p-3 bg-[#f8fafd] rounded-2xl border border-[#dadce0] space-y-2">
              <div 
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setShowKeyAccordion(!showKeyAccordion)}
              >
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#f29900] text-[18px]">bolt</span>
                  <span className="text-[12px] font-bold text-[#1f1f1f]">Groq AI API 키</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    groqKey ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#f1f3f4] text-[#5f6368]'
                  }`}>
                    {groqKey ? '● 활성화' : '미등록'}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-[#5f6368]">
                    {showKeyAccordion ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
              </div>

              {showKeyAccordion && (
                <div className="space-y-2 pt-1 border-t border-[#e0e3e7]">
                  <p className="text-[11px] text-[#5f6368] leading-tight">
                    Groq SDK 기반 <span className="font-mono text-[#1a73e8] font-semibold">openai/gpt-oss-120b</span> 모델을 기본으로 초고속 실시간 추천과 AI 대화를 구동합니다.
                  </p>

                  <div className="relative flex items-center">
                    <input
                      type={showKeyText ? 'text' : 'password'}
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                      placeholder="gsk_..."
                      className="w-full text-[12px] font-mono px-2.5 py-1.5 pr-8 bg-white border border-[#dadce0] rounded-xl outline-none focus:border-[#1a73e8]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeyText(!showKeyText)}
                      className="absolute right-2 text-[#747775] hover:text-[#1f1f1f]"
                      title={showKeyText ? '가리기' : '보기'}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {showKeyText ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#1a73e8] hover:underline flex items-center gap-0.5"
                    >
                      <span>무료 키 발급</span>
                      <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                    </a>

                    <div className="flex items-center gap-1">
                      {groqKey && (
                        <button
                          type="button"
                          onClick={handleClearGroqKey}
                          className="px-2 py-1 text-[11px] text-[#d93025] hover:bg-[#fce8e6] rounded-lg font-medium transition-colors"
                        >
                          삭제
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveGroqKey}
                        className="px-3 py-1 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-lg text-[11px] font-semibold transition-colors shadow-xs"
                      >
                        저장
                      </button>
                    </div>
                  </div>

                  {saveStatus && (
                    <p className="text-[11px] font-medium text-[#188038] text-center bg-[#e6f4ea] py-1 rounded-lg animate-in fade-in">
                      {saveStatus}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 홈 화면에 앱 설치하기 버튼 (PWA) */}
            <button
              onClick={() => {
                setShowProfileMenu(false);
                handleInstallClick();
              }}
              className="w-full mb-1.5 py-2 px-3 bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#1a73e8] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-[#c2e7ff]"
            >
              <span className="material-symbols-outlined text-[16px]">install_mobile</span>
              홈 화면에 앱 설치하기
            </button>

            {/* 프로필 팝업 내 어드민 계정 관리 버튼 (관리자만 노출) */}
            {isAdmin && onOpenAdmin && (
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onOpenAdmin();
                }}
                className="w-full mb-1.5 py-2 px-3 bg-[#fef7e0] hover:bg-[#feefc3] text-[#b06000] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-[#fbd65c]"
              >
                <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                접근 허용 계정 관리
              </button>
            )}

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
