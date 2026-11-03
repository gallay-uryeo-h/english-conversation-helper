import React, { useState, useEffect } from 'react';
import { MainTab, Thread } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  currentTab: MainTab;
  activeThread: Thread | null;
  onBack?: () => void;
  onOpenInfo?: () => void;
  onOpenAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  currentTab, 
  activeThread, 
  onBack, 
  onOpenInfo,
  onOpenAdmin 
}) => {
  const { user, logout, appTarget, isAdmin } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // PWA 설치 가능 여부 감지 (Chrome / Edge / Android)
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else {
      alert("iOS Safari 브라우저에서는 하단의 [공유] 아이콘을 누른 후 [홈 화면에 추가]를 선택하시면 앱으로 설치됩니다.");
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#f0f4f9] border-b border-[#e0e3e7] pt-[env(safe-area-inset-top,0px)] max-w-md mx-auto relative">
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && currentTab === 'chat' && (
            <button 
              onClick={onBack}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#444746] hover:bg-black/5 active:scale-95"
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
                  AI 회화 파트너
                </>
              )}
              {currentTab === 'threads' && (
                <>
                  <span className="material-symbols-outlined text-[#1a73e8] text-[20px]">forum</span>
                  진행 중인 대화
                </>
              )}
              {currentTab === 'chat' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#188038] animate-pulse"></span>
                  {activeThread?.partnerName || '실시간 스레드 대화'}
                </>
              )}
              {currentTab === 'analysis' && (
                <>
                  <span className="material-symbols-outlined text-[#00897b] text-[20px]">insights</span>
                  스레드 언어 인스펙터
                </>
              )}
              {currentTab === 'archive' && (
                <>
                  <span className="material-symbols-outlined text-[#795900] text-[20px]">bookmark</span>
                  표현 및 대본 보관함
                </>
              )}
            </h1>
            {currentTab === 'chat' && activeThread?.partnerRole && (
              <p className="text-[11px] text-[#5f6368] truncate">
                {activeThread.partnerRole}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* 어드민 계정 관리 버튼 (관리자만 노출) */}
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="h-8 px-2.5 bg-[#fef7e0] hover:bg-[#feefc3] text-[#b06000] rounded-full flex items-center gap-1 text-[11px] font-bold border border-[#fbd65c] transition-all active:scale-95 shadow-xs"
              title="접근 허용 계정 일괄 관리"
            >
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              <span>계정 관리</span>
            </button>
          )}

          {/* 앱 설치 버튼 (PWA) */}
          <button
            onClick={handleInstallClick}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#1a73e8] hover:bg-black/5 active:scale-95"
            title="홈 화면에 앱 설치하기"
          >
            <span className="material-symbols-outlined text-[19px]">install_mobile</span>
          </button>

          {/* 프로젝트 정보 모달 */}
          <button 
            onClick={onOpenInfo}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#444746] hover:bg-black/5 active:scale-95"
            title="프로젝트 환경 정보"
          >
            <span className="material-symbols-outlined text-[19px]">cloud_done</span>
          </button>

          {/* 유저 프로필 아바타 버튼 */}
          {user && (
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-8 h-8 rounded-full overflow-hidden border border-[#dadce0] hover:ring-2 hover:ring-[#1a73e8]/30 transition-all flex items-center justify-center bg-[#e8f0fe] text-[#1a73e8] text-xs font-bold shrink-0 ml-0.5"
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
          <div className="absolute right-4 top-14 mt-1 w-64 bg-white rounded-2xl shadow-xl border border-[#dadce0] p-4 z-50 animate-fadeIn text-left">
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

            <div className="py-2.5 space-y-1">
              <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${
                appTarget === 'family' ? 'bg-[#e8f0fe] text-[#1967d2]' : 'bg-[#e6f4ea] text-[#137333]'
              }`}>
                {appTarget === 'family' ? '🏡 가족 모드 접속 중' : '🏫 학교 모드 접속 중'}
              </span>
              {isAdmin && (
                <span className="block text-[10px] font-bold text-[#b06000]">
                  👑 마스터 관리자 권한 활성화됨
                </span>
              )}
            </div>

            {isAdmin && onOpenAdmin && (
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onOpenAdmin();
                }}
                className="w-full mb-1.5 py-2 px-3 bg-[#fef7e0] hover:bg-[#feefc3] text-[#b06000] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
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
