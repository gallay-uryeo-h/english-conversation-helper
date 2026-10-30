import React from 'react';
import { MainTab, Thread } from '../types';

interface HeaderProps {
  currentTab: MainTab;
  activeThread: Thread | null;
  onBack?: () => void;
  onOpenInfo?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, activeThread, onBack, onOpenInfo }) => {
  return (
    <header className="sticky top-0 z-40 bg-[#f0f4f9] border-b border-[#e0e3e7] pt-[env(safe-area-inset-top,0px)] max-w-md mx-auto">
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
            title="프로젝트 정보"
          >
            <span className="material-symbols-outlined text-[20px]">cloud_done</span>
          </button>
        </div>
      </div>
    </header>
  );
};

