import React, { useState } from 'react';
import { Thread, Friend } from '../types';

interface ThreadsViewProps {
  threads: Thread[];
  friends: Friend[];
  activeThreadId: string;
  onSelectThread: (thread: Thread) => void;
  onStartChatWithFriend: (friend: Friend) => void;
  onDeleteThread?: (threadId: string) => void;
  onNavigateToFriends?: () => void;
}

export const ThreadsView: React.FC<ThreadsViewProps> = ({
  threads,
  friends,
  activeThreadId,
  onSelectThread,
  onStartChatWithFriend,
  onDeleteThread,
  onNavigateToFriends
}) => {
  const [filter, setFilter] = useState<'all' | 'fav'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');

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
    onStartChatWithFriend(friend);
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
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

      {/* 필터 칩 */}
      <div className="px-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
        {[
          { id: 'all', label: '전체 대화' },
          { id: 'fav', label: '⭐ 즐겨찾기' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id as any)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
              filter === item.id
                ? 'bg-[#1a73e8] text-white shadow-sm'
                : 'bg-[#f0f4f9] text-[#444746] hover:bg-[#e2e7ff]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 스레드 카드 리스트 */}
      <div className="divide-y divide-[#f0f4f9] mt-1">
        {threads.length === 0 ? (
          <div className="py-20 px-6 text-center text-[#5f6368] space-y-4">
            <div className="w-16 h-16 bg-[#e8f0fe] rounded-3xl mx-auto flex items-center justify-center text-[#1a73e8]">
              <span className="material-symbols-outlined text-[36px]">forum</span>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#1f1f1f] mb-1">
                아직 시작된 대화가 없습니다
              </h3>
              <p className="text-[13px] text-[#5f6368] leading-relaxed">
                '회화 친구' 메뉴에서 대화할 친구를 선택하거나<br />
                우측 하단의 '새 대화 만들기' 버튼을 눌러보세요!
              </p>
            </div>
            {onNavigateToFriends && (
              <button
                onClick={onNavigateToFriends}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a73e8] text-white rounded-2xl text-[13px] font-semibold hover:bg-[#1557b0] shadow-sm active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">group</span>
                회화 친구 목록 보기
              </button>
            )}
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="py-16 text-center text-[#5f6368]">
            <span className="material-symbols-outlined text-[48px] text-[#bfc6dd] mb-2">search_off</span>
            <p className="text-[14px]">검색 조건에 맞는 대화가 없습니다.</p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const isSelected = thread.id === activeThreadId;
            return (
              <article
                key={thread.id}
                onClick={() => onSelectThread(thread)}
                className={`flex items-start gap-3.5 px-4 py-3.5 cursor-pointer transition-colors active:bg-[#edf2fa] group relative ${
                  isSelected ? 'bg-[#eef4ff]' : 'hover:bg-[#f8fafd]'
                }`}
              >
                {/* 아바타 */}
                <div className="relative shrink-0 mt-0.5">
                  <div
                    className="w-11 h-11 rounded-full font-semibold text-[16px] flex items-center justify-center ring-1 ring-black/5"
                    style={{ backgroundColor: thread.avatarBg, color: '#1f1f1f' }}
                  >
                    {thread.avatarText}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#188038] border-2 border-white"></span>
                </div>

                {/* 대화 정보 */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-[15px] font-semibold text-[#1f1f1f] truncate">
                        {thread.partnerName}
                      </span>
                      {thread.isFavorite && (
                        <span className="text-[#fbbc04] text-[14px]">★</span>
                      )}
                    </div>
                    <span className="text-[12px] text-[#5f6368] shrink-0 font-mono">
                      {formatTime(thread.updatedAt)}
                    </span>
                  </div>

                  <p className="text-[13px] text-[#444746] truncate">
                    {thread.lastMessage || '대화를 시작해보세요.'}
                  </p>
                </div>

                {/* 삭제 버튼 */}
                {onDeleteThread && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`'${thread.title}' 대화방을 삭제하시겠습니까?`)) {
                        onDeleteThread(thread.id);
                      }
                    }}
                    className="absolute right-3 top-4 text-[#9aa0a6] hover:text-[#d93025] p-1.5 rounded-full hover:bg-black/5 transition-colors"
                    title="대화방 삭제"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                )}
              </article>
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
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl flex flex-col max-h-[80vh]">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between pb-3 border-b border-[#e0e3e7]">
              <div>
                <h3 className="text-[17px] font-bold text-[#1f1f1f]">새 대화 시작하기</h3>
                <p className="text-[12px] text-[#5f6368] mt-0.5">대화할 상대를 친구 목록에서 선택하세요</p>
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

            {/* 친구 검색창 */}
            <div className="py-3">
              <div className="relative flex items-center bg-[#f0f4f9] rounded-2xl px-3 py-2 border border-[#e0e3e7]">
                <span className="material-symbols-outlined text-[#5f6368] text-[18px] mr-2">search</span>
                <input
                  type="text"
                  placeholder="친구 이름 또는 이메일 검색..."
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  className="w-full bg-transparent text-[13px] text-[#1f1f1f] outline-none placeholder-[#777586]"
                  autoFocus
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
              {filteredFriends.length === 0 ? (
                <div className="py-10 text-center text-[#5f6368] space-y-2">
                  <span className="material-symbols-outlined text-[36px] text-[#bfc6dd]">person_search</span>
                  <p className="text-[13px]">
                    {friends.length === 0 ? '등록된 친구가 없습니다.' : '검색 결과가 없습니다.'}
                  </p>
                  {onNavigateToFriends && (
                    <button
                      onClick={() => {
                        setShowModal(false);
                        onNavigateToFriends();
                      }}
                      className="text-[12px] text-[#1a73e8] font-semibold underline mt-1"
                    >
                      '회화 친구' 메뉴에서 그룹 멤버 추가하기 →
                    </button>
                  )}
                </div>
              ) : (
                filteredFriends.map((friend) => (
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
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14px] font-bold text-[#1f1f1f] truncate">
                            {friend.name}
                          </span>
                          {friend.isAi && (
                            <span className="text-[10px] font-semibold bg-[#e8f0fe] text-[#1a73e8] px-1.5 py-0.5 rounded-full">
                              AI
                            </span>
                          )}
                        </div>
                        {friend.email && (
                          <p className="text-[11px] text-[#5f6368] truncate">
                            {friend.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 bg-[#1a73e8] text-white rounded-xl text-[12px] font-semibold hover:bg-[#1557b0] shrink-0"
                    >
                      대화하기
                    </button>
                  </div>
                ))
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
