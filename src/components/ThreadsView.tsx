import React, { useState, useMemo } from 'react';
import { Thread, Friend } from '../types';
import { DEFAULT_AI_FRIEND } from '../services/storageService';

interface ThreadsViewProps {
  threads: Thread[];
  friends: Friend[];
  activeThreadId: string;
  onSelectThread: (thread: Thread) => void;
  onStartChatWithFriend: (friend: Friend, forceNew?: boolean) => void;
  onDeleteThread?: (threadId: string) => void;
  onClearAllThreads?: () => void;
  onNavigateToFriends?: () => void;
}

export const ThreadsView: React.FC<ThreadsViewProps> = ({
  threads,
  friends,
  activeThreadId,
  onSelectThread,
  onStartChatWithFriend,
  onDeleteThread,
  onClearAllThreads,
  onNavigateToFriends
}) => {
  const [filter, setFilter] = useState<'all' | 'fav'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  // 같은 친구와의 대화 아코디언 펼침/접힘 상태
  const [expandedFriends, setExpandedFriends] = useState<Record<string, boolean>>({});

  const toggleFriendAccordion = (partnerName: string) => {
    setExpandedFriends(prev => ({
      ...prev,
      [partnerName]: !prev[partnerName]
    }));
  };

  const filteredThreads = threads.filter((t) => {
    if (filter === 'fav' && !t.isFavorite) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.partnerName.toLowerCase().includes(q) ||
        t.lastMessage.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // 같은 친구끼리 대화를 그룹화 (최신 대화순 정렬)
  interface ThreadGroup {
    partnerName: string;
    avatarBg: string;
    avatarText: string;
    threads: Thread[];
    latestThread: Thread;
  }

  const threadGroups = useMemo(() => {
    const map = new Map<string, ThreadGroup>();

    for (const thread of filteredThreads) {
      const key = thread.partnerName;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          partnerName: thread.partnerName,
          avatarBg: thread.avatarBg,
          avatarText: thread.avatarText,
          threads: [thread],
          latestThread: thread
        });
      } else {
        existing.threads.push(thread);
        if (thread.updatedAt > existing.latestThread.updatedAt) {
          existing.latestThread = thread;
        }
      }
    }

    // 그룹 내 대화 최신순 정렬
    for (const group of map.values()) {
      group.threads.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    // 최신 대화가 발생한 친구 그룹 순으로 정렬
    return Array.from(map.values()).sort(
      (a, b) => b.latestThread.updatedAt - a.latestThread.updatedAt
    );
  }, [filteredThreads]);

  const filteredFriends = friends.filter((f) => {
    if (!friendSearch.trim()) return true;
    const q = friendSearch.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      (f.email && f.email.toLowerCase().includes(q))
    );
  });

  const handleSelectFriendToChat = (friend: Friend) => {
    setShowModal(false);
    setFriendSearch('');
    onStartChatWithFriend(friend, true);
  };

  // 구글챗 스타일 시간 포맷팅
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      const hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const period = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      return `${formattedHours}:${minutes} ${period}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return '어제';
    }

    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  return (
    <div className="pb-24 pt-2">
      {/* 검색 바 */}
      <div className="px-4 mb-3">
        <div className="relative flex items-center bg-[#eaedff] rounded-full px-3.5 py-2">
          <span className="material-symbols-outlined text-[#5f6368] text-[20px] mr-2">search</span>
          <input
            type="text"
            placeholder="대화 내용 또는 대화 상대 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-[14px] text-[#1f1f1f] outline-none placeholder-[#777586]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[#5f6368]">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* 필터 칩 & 대화 비우기 버튼 */}
      <div className="px-4 flex items-center justify-between gap-1.5 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: `전체 대화 (${threads.length})` },
            { id: 'fav', label: '⭐ 즐겨찾기' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id as any)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                filter === item.id
                  ? 'bg-[#1a73e8] text-white shadow-xs'
                  : 'bg-[#f0f4f9] text-[#444746] hover:bg-[#e2e7ff]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {threads.length > 0 && onClearAllThreads && (
          <button
            type="button"
            onClick={onClearAllThreads}
            className="text-[11px] text-[#5f6368] hover:text-[#d93025] px-2 py-1 rounded-lg hover:bg-[#fce8e6] whitespace-nowrap transition-colors shrink-0"
            title="대화 목록 전체 비우기"
          >
            대화 비우기
          </button>
        )}
      </div>

      {/* 구글챗 스타일 스레드 스트림 리스트 */}
      <div className="divide-y divide-[#edf0f5] mt-1" id="thread-stream">
        {threads.length === 0 ? (
          <div className="py-16 px-6 text-center text-[#5f6368] space-y-4">
            <div className="w-16 h-16 bg-[#e8f0fe] rounded-3xl mx-auto flex items-center justify-center text-[#1a73e8] shadow-xs">
              <span className="material-symbols-outlined text-[36px]">forum</span>
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-[#1f1f1f] mb-1">
                대화 목록이 비어 있습니다
              </h3>
              <p className="text-[13px] text-[#5f6368] leading-relaxed">
                Gemini 3.5 기반 AI와 영어 회화를 시작해보세요!
              </p>
            </div>
            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                onClick={() => onStartChatWithFriend(DEFAULT_AI_FRIEND, true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a73e8] text-white rounded-2xl text-[14px] font-bold hover:bg-[#1557b0] shadow-md active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                AI와 새 대화 시작하기
              </button>
              {onNavigateToFriends && (
                <button
                  onClick={onNavigateToFriends}
                  className="text-[12px] text-[#5f6368] hover:text-[#1a73e8] hover:underline"
                >
                  회화 친구 목록 보기 →
                </button>
              )}
            </div>
          </div>
        ) : threadGroups.length === 0 ? (
          <div className="py-16 text-center text-[#5f6368]">
            <span className="material-symbols-outlined text-[48px] text-[#bfc6dd] mb-2">search_off</span>
            <p className="text-[14px]">검색 조건에 맞는 대화가 없습니다.</p>
          </div>
        ) : (
          threadGroups.map((group) => {
            const isSingle = group.threads.length === 1;
            const singleThread = group.threads[0];
            const isExpanded = Boolean(expandedFriends[group.partnerName] || searchQuery.trim());
            const hasActiveThread = group.threads.some(t => t.id === activeThreadId);

            // 1. 단일 대화방인 경우 (아코디언 불필요, 바로 표시)
            if (isSingle) {
              const isSelected = singleThread.id === activeThreadId;
              return (
                <article
                  key={singleThread.id}
                  onClick={() => onSelectThread(singleThread)}
                  className={`thread-card flex items-start gap-3.5 px-4 py-3.5 cursor-pointer transition-colors active:bg-[#edf2fa] group relative ${
                    isSelected ? 'bg-[#eef4ff]' : 'hover:bg-[#f8fafd]'
                  }`}
                >
                  {/* 아바타 */}
                  <div className="relative shrink-0 mt-0.5">
                    <div
                      className="w-10 h-10 rounded-full font-semibold text-[15px] flex items-center justify-center ring-1 ring-black/5"
                      style={{ backgroundColor: singleThread.avatarBg, color: '#1f1f1f' }}
                    >
                      {singleThread.avatarText}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#188038] border-2 border-white"></span>
                  </div>

                  {/* 정보 영역 */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[14px] font-semibold text-[#1f1f1f] truncate">
                          {singleThread.partnerName}
                        </span>
                        {singleThread.isFavorite && (
                          <span className="text-[#fbbc04] text-[13px]">★</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-[#5f6368] font-mono">
                          {formatTime(singleThread.updatedAt)}
                        </span>
                        {/* 카카오톡 스타일 안 읽은 대화 개수 뱃지 */}
                        {typeof singleThread.unreadCount === 'number' && singleThread.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#b3261e] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                            {singleThread.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 최신 메시지 스니펫 */}
                    <p className="text-[13px] text-[#3c4043] truncate">
                      {singleThread.lastSender === 'user' ? (
                        <span className="text-[#1a73e8] font-semibold">나: </span>
                      ) : (
                        <span className="font-semibold text-[#1f1f1f]">{singleThread.partnerName}: </span>
                      )}
                      <span>{singleThread.lastMessage || '대화를 시작해보세요.'}</span>
                    </p>
                  </div>

                  {/* 삭제 버튼 */}
                  {onDeleteThread && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`'${singleThread.partnerName}'님과의 대화방을 삭제하시겠습니까?`)) {
                          onDeleteThread(singleThread.id);
                        }
                      }}
                      className="absolute right-3 top-3 text-[#9aa0a6] hover:text-[#d93025] p-1.5 rounded-full hover:bg-black/5 transition-colors"
                      title="대화방 삭제"
                    >
                      <span className="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                  )}
                </article>
              );
            }

            // 2. 같은 친구와의 대화가 여러 개 있는 경우 (아코디언 그룹)
            return (
              <div key={group.partnerName} className="border-b border-[#edf0f5] last:border-b-0">
                {/* 아코디언 메인 헤더 카드 */}
                <article
                  onClick={() => toggleFriendAccordion(group.partnerName)}
                  className={`flex items-start gap-3.5 px-4 py-3.5 cursor-pointer transition-colors active:bg-[#edf2fa] group relative select-none ${
                    hasActiveThread ? 'bg-[#f0f6ff]' : 'hover:bg-[#f8fafd]'
                  }`}
                >
                  {/* 아바타 */}
                  <div className="relative shrink-0 mt-0.5">
                    <div
                      className="w-10 h-10 rounded-full font-semibold text-[15px] flex items-center justify-center ring-1 ring-black/5"
                      style={{ backgroundColor: group.avatarBg, color: '#1f1f1f' }}
                    >
                      {group.avatarText}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#188038] border-2 border-white"></span>
                  </div>

                  {/* 친구 정보 & 아코디언 토글 */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[14px] font-semibold text-[#1f1f1f] truncate">
                          {group.partnerName}
                        </span>
                        {/* 아코디언 뱃지 */}
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors shrink-0 ${
                            isExpanded 
                              ? 'bg-[#1a73e8] text-white' 
                              : 'bg-[#e8f0fe] text-[#1a73e8]'
                          }`}
                        >
                          대화 {group.threads.length}개
                          <span className="material-symbols-outlined text-[14px] leading-none">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-[#5f6368] font-mono">
                          {formatTime(group.latestThread.updatedAt)}
                        </span>
                        {/* 그룹 내 안 읽은 대화 총합 뱃지 */}
                        {(() => {
                          const groupUnread = group.threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
                          return groupUnread > 0 ? (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#b3261e] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                              {groupUnread}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    {/* 최신 메시지 미리보기 */}
                    <p className="text-[13px] text-[#3c4043] truncate">
                      <span className="text-[11px] font-semibold text-[#1a73e8] mr-1">[최근]</span>
                      {group.latestThread.lastSender === 'user' ? (
                        <span className="text-[#1a73e8] font-semibold">나: </span>
                      ) : (
                        <span className="font-semibold text-[#1f1f1f]">{group.partnerName}: </span>
                      )}
                      <span>{group.latestThread.lastMessage || '대화를 시작해보세요.'}</span>
                    </p>
                  </div>

                  {/* 아코디언 펼침/접힘 화살표 */}
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#747775] group-hover:text-[#1a73e8] transition-colors">
                    <span className="material-symbols-outlined text-[20px]">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                </article>

                {/* 아코디언 서브 리스트 (숨겨져 있다가 펼쳐짐) */}
                {isExpanded && (
                  <div className="bg-[#f8fafd] border-t border-[#e8eaed] px-4 py-2.5 space-y-2 animate-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between text-[11px] text-[#5f6368] font-medium px-1 pb-1 border-b border-[#e8eaed]">
                      <span>'{group.partnerName}'님과의 대화 목록 ({group.threads.length})</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const matched = friends.find(f => f.name === group.partnerName) || {
                            id: `friend-${Date.now()}`,
                            name: group.partnerName,
                            avatarBg: group.avatarBg,
                            avatarText: group.avatarText,
                            isAi: group.partnerName.includes('AI')
                          };
                          onStartChatWithFriend(matched, true);
                        }}
                        className="text-[#1a73e8] hover:underline font-bold flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-[13px]">add</span>
                        새 대화
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {group.threads.map((thread, idx) => {
                        const isSelected = thread.id === activeThreadId;
                        return (
                          <div
                            key={thread.id}
                            onClick={() => onSelectThread(thread)}
                            className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                              isSelected 
                                ? 'bg-[#e8f0fe] border border-[#1a73e8]/40 shadow-xs' 
                                : 'bg-white hover:bg-[#eef4ff] border border-[#dadce0]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                  idx === 0 
                                    ? 'bg-[#e8f0fe] text-[#1a73e8]' 
                                    : 'bg-[#f1f3f4] text-[#5f6368]'
                                }`}>
                                  {idx === 0 ? '최근 대화' : `#${group.threads.length - idx}`}
                                </span>
                                <span className="text-[11px] text-[#5f6368] font-mono shrink-0">
                                  {formatTime(thread.updatedAt)}
                                </span>
                                {typeof thread.unreadCount === 'number' && thread.unreadCount > 0 && (
                                  <span className="min-w-[17px] h-[17px] px-1 rounded-full bg-[#b3261e] text-white text-[9px] font-bold flex items-center justify-center">
                                    {thread.unreadCount}
                                  </span>
                                )}
                              </div>
                              <p className="text-[13px] text-[#1f1f1f] truncate leading-snug">
                                {thread.lastSender === 'user' ? (
                                  <span className="text-[#1a73e8] font-medium">나: </span>
                                ) : null}
                                {thread.lastMessage || '대화를 시작해보세요.'}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span className="material-symbols-outlined text-[16px] text-[#1a73e8]">
                                arrow_forward
                              </span>
                              {onDeleteThread && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`이 대화방을 삭제하시겠습니까?`)) {
                                      onDeleteThread(thread.id);
                                    }
                                  }}
                                  className="p-1 text-[#9aa0a6] hover:text-[#d93025] rounded-full hover:bg-black/5 transition-colors ml-1"
                                  title="대화방 삭제"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 새 대화 시작 플로팅 버튼 (FAB) */}
      <div className="fixed bottom-20 right-4 z-40 max-w-md mx-auto">
        <button
          onClick={() => setShowModal(true)}
          className="h-14 px-5 rounded-2xl bg-[#c2e7ff] text-[#001d35] hover:bg-[#b3e1ff] active:scale-95 transition-all shadow-md flex items-center gap-2.5 font-semibold text-[14px]"
        >
          <span className="material-symbols-outlined text-[22px]">edit</span>
          <span>새 대화 만들기</span>
        </button>
      </div>

      {/* 새 대화 시작: 친구 선택 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl flex flex-col max-h-[82vh]">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between pb-3 border-b border-[#e0e3e7]">
              <div>
                <h3 className="text-[17px] font-bold text-[#1f1f1f]">새 대화 시작하기</h3>
                <p className="text-[12px] text-[#5f6368] mt-0.5">상대를 선택하여 새 대화방을 엽니다</p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setFriendSearch('');
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-[#f0f4f9]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* AI와 대화하기 최우선 옵션 카드 */}
            <div className="py-3 border-b border-[#e0e3e7]">
              <div
                onClick={() => handleSelectFriendToChat(DEFAULT_AI_FRIEND)}
                className="p-3 bg-gradient-to-r from-[#e8f0fe] via-[#f0f4f9] to-[#e6f4ea] border border-[#b8d7ff] rounded-2xl cursor-pointer hover:shadow-md active:scale-98 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1a73e8] text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[22px]">smart_toy</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-bold text-[#1f1f1f]">AI와 대화하기</span>
                      <span className="text-[10px] bg-[#1a73e8] text-white font-semibold px-1.5 py-0.2 rounded-full">
                        Gemini 3.5
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5f6368]">실시간 AI 파트너와 바로 회화 시작</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-[#1a73e8] text-white rounded-xl text-[12px] font-bold shadow-xs shrink-0"
                >
                  시작
                </button>
              </div>
            </div>

            {/* 친구 검색창 */}
            <div className="py-2.5">
              <div className="relative flex items-center bg-[#f0f4f9] rounded-2xl px-3 py-2 border border-[#e0e3e7]">
                <span className="material-symbols-outlined text-[#5f6368] text-[18px] mr-2">search</span>
                <input
                  type="text"
                  placeholder="회화 친구 이름 또는 이메일 검색..."
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  className="w-full bg-transparent text-[13px] text-[#1f1f1f] outline-none placeholder-[#777586]"
                />
                {friendSearch && (
                  <button onClick={() => setFriendSearch('')} className="text-[#5f6368]">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* 친구 목록 리스트 */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#f0f4f9] space-y-1">
              {filteredFriends.filter(f => !f.isAi).length === 0 ? (
                <div className="py-6 text-center text-[#5f6368] space-y-1.5">
                  <p className="text-[12px]">
                    {friendSearch ? '검색된 친구가 없습니다.' : '추가된 다른 친구가 없습니다.'}
                  </p>
                  {onNavigateToFriends && (
                    <button
                      onClick={() => {
                        setShowModal(false);
                        onNavigateToFriends();
                      }}
                      className="text-[12px] text-[#1a73e8] font-semibold underline block mx-auto"
                    >
                      '회화 친구' 메뉴에서 멤버 추가하기 →
                    </button>
                  )}
                </div>
              ) : (
                filteredFriends.filter(f => !f.isAi).map((friend) => {
                  const friendThreadCount = threads.filter(t => t.partnerName === friend.name).length;

                  return (
                    <div
                      key={friend.id}
                      onClick={() => handleSelectFriendToChat(friend)}
                      className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#f0f4f9] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full font-semibold text-[15px] flex items-center justify-center shrink-0 ring-1 ring-black/5 overflow-hidden"
                          style={{ backgroundColor: friend.avatarBg, color: '#1f1f1f' }}
                        >
                          {friend.photoURL ? (
                            <img
                              src={friend.photoURL}
                              alt={friend.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            friend.avatarText
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[14px] font-bold text-[#1f1f1f] truncate block">
                            {friend.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {friend.email && (
                              <p className="text-[11px] text-[#5f6368] truncate">
                                {friend.email}
                              </p>
                            )}
                            {friendThreadCount > 0 && (
                              <span className="text-[10px] text-[#1a73e8] font-medium bg-[#e8f0fe] px-1.5 py-0.2 rounded shrink-0">
                                대화 {friendThreadCount}개
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-3 py-1.5 bg-[#f0f4f9] hover:bg-[#e0e3e7] text-[#1f1f1f] rounded-xl text-[12px] font-semibold shrink-0"
                      >
                        새 대화
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* 하단 닫기 */}
            <div className="pt-3 border-t border-[#e0e3e7] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setFriendSearch('');
                }}
                className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#5f6368] hover:bg-[#f0f4f9]"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
