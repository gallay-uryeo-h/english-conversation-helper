import React from 'react';
import { MainTab } from '../types';

interface BottomNavProps {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  unreadCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, unreadCount }) => {
  const tabs = [
    {
      id: 'threads' as MainTab,
      label: '대화 목록',
      icon: 'forum',
      fill: currentTab === 'threads'
    },
    {
      id: 'chat' as MainTab,
      label: '실시간 채팅',
      icon: 'chat',
      badge: unreadCount,
      fill: currentTab === 'chat'
    },
    {
      id: 'analysis' as MainTab,
      label: '대화 분석',
      icon: 'insights',
      fill: currentTab === 'analysis'
    },
    {
      id: 'archive' as MainTab,
      label: '표현 보관함',
      icon: 'bookmark',
      fill: currentTab === 'archive'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#f0f4f9] border-t border-[#e0e3e7] pb-[env(safe-area-inset-bottom,0px)] shadow-lg max-w-md mx-auto">
      <div className="h-16 px-2 grid grid-cols-4 items-center">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className="flex flex-col items-center justify-center gap-1 py-1 transition-transform active:scale-95"
            >
              <div 
                className={`relative px-4 py-1 rounded-full flex items-center justify-center transition-all ${
                  isActive 
                    ? 'bg-[#c2e7ff] text-[#001d35]' 
                    : 'text-[#444746] hover:bg-black/5'
                }`}
              >
                <span 
                  className="material-symbols-outlined text-[22px]"
                  style={isActive ? { fontVariationSettings: '"FILL" 1' } : undefined}
                >
                  {tab.icon}
                </span>
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#ba1a1a] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[11px] font-medium transition-colors ${
                isActive ? 'font-semibold text-[#001d35]' : 'text-[#444746]'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

