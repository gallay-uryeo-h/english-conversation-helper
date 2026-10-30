import React, { useState } from 'react';
import { Thread } from '../types';

interface ThreadsViewProps {
  threads: Thread[];
  activeThreadId: string;
  onSelectThread: (thread: Thread) => void;
  onCreateThread?: (title: string, partnerName: string) => void;
}

export const ThreadsView: React.FC<ThreadsViewProps> = ({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread
}) => {
  const [filter, setFilter] = useState<'all' | 'fav' | 'daily' | 'business'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPartner, setNewPartner] = useState('');

  const filteredThreads = threads.filter((t) => {
    if (filter === 'fav' && !t.isFavorite) return false;
    if (filter === 'daily' && t.category !== 'daily') return false;
    if (filter === 'business' && t.category !== 'business') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.partnerName.toLowerCase().includes(q) ||
        t.lastMessage.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPartner.trim()) return;
    onCreateThread?.(newTitle.trim(), newPartner.trim());
    setNewTitle('');
    setNewPartner('');
    setShowModal(false);
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return '어제';
  };

  return (
    <div className="pb-24 pt-2">
      {/* 검색 바 */}
      <div className="px-4 mb-3">
        <div className="relative flex items-center bg-[#eaedff] rounded-full px-3.5 py-2">
          <span className="material-symbols-outlined text-[#5f6368] text-[20px] mr-2">search</span>
          <input
            type="text"
            placeholder="스레드 및 대화 내용 검색..."
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

      {/* 카테고리 필터 칩 */}
      <div className="px-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
        {[
          { id: 'all', label: '전체 대화' },
          { id: 'fav', label: '⭐ 즐겨찾기' },
          { id: 'daily', label: '☕ 일상 스몰톡' },
          { id: 'business', label: '💼 비즈니스' }
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
        {filteredThreads.length === 0 ? (
          <div className="py-16 text-center text-[#5f6368]">
            <span className="material-symbols-outlined text-[48px] text-[#bfc6dd] mb-2">forum</span>
            <p className="text-[14px]">해당 조건의 대화 스레드가 없습니다.</p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const isSelected = thread.id === activeThreadId;
            return (
              <article
                key={thread.id}
                onClick={() => onSelectThread(thread)}
                className={`flex items-start gap-3.5 px-4 py-3.5 cursor-pointer transition-colors active:bg-[#edf2fa] ${
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
                <div className="flex-1 min-w-0">
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

                  <p className="text-[12px] text-[#1a73e8] font-medium truncate mb-1">
                    {thread.title}
                  </p>

                  <p className="text-[13px] text-[#444746] truncate">
                    {thread.lastMessage}
                  </p>
                </div>
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
          <span>새 스몰톡 시작</span>
        </button>
      </div>

      {/* 새 스레드 생성 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-[17px] font-bold text-[#1f1f1f] mb-3">새 대화 스레드 개설</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368] mb-1">대화 상대 (AI 파트너 페르소나)</label>
                <input
                  type="text"
                  placeholder="예: 마이클 (여행 가이드)"
                  value={newPartner}
                  onChange={(e) => setNewPartner(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e0e3e7] rounded-xl text-[14px] outline-none focus:border-[#1a73e8]"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368] mb-1">대화 주제 / 상황</label>
                <input
                  type="text"
                  placeholder="예: 공항에서 환승 비행기 찾기"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e0e3e7] rounded-xl text-[14px] outline-none focus:border-[#1a73e8]"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#5f6368] hover:bg-[#f0f4f9]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-[#1a73e8] text-white hover:bg-[#1557b0]"
                >
                  시작하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

