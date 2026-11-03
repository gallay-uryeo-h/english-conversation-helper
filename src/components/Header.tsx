import React, { useState } from 'react';
import { MainTab, Thread } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  currentTab: MainTab;
  activeThread: Thread | null;
  onBack?: () => void;
  onOpenInfo?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, activeThread, onBack, onOpenInfo }) => {
  const { user, logout, appTarget } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#f0f4f9] border-b border-[#e0e3e7] pt-[env(safe-area-inset-top,0px)] max-w-md mx-auto relative">
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && currentTab !== 'threads' && (
            <button 
              onClick={onBack}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#444746] hover:bg-black/5 active:scale-95"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          )}

          <div className="truncate">
            <h1 className="text-[17px] font-semibold text-[#1f1f1f] truncate leading-tight flex items-center gap-1.5">
              {currentTab === 'threads' && (
                <>
                  <span className="material-symbols-outlined text-[#1a73e8] text-[20px]">forum</span>
                  스레드 대화 목록
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
          <button 
            onClick={onOpenInfo}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#444746] hover:bg-black/5 active:scale-95"
            title="프로젝트 환경 정보"
          >
            <span className="material-symbols-outlined text-[20px]">cloud_done</span>
          </button>

          {/* 유저 프로필 아바타 버튼 */}
          {user && (
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-8 h-8 rounded-full overflow-hidden border border-[#dadce0] hover:ring-2 hover:ring-[#1a73e8]/30 transition-all flex items-center justify-center bg-[#e8f0fe] text-[#1a73e8] text-xs font-bold"
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

            <div className="py-2.5">
              <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${
                appTarget === 'family' ? 'bg-[#e8f0fe] text-[#1967d2]' : 'bg-[#e6f4ea] text-[#137333]'
              }`}>
                {appTarget === 'family' ? '🏡 가족 모드 접속 중' : '🏫 학교 모드 접속 중'}
              </span>
            </div>

            <button
              onClick={() => {
                setShowProfileMenu(false);
                logout();
              }}
              className="w-full mt-1 py-2 px-3 bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#d93025] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
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
