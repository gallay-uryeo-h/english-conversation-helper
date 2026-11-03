import React, { useState } from 'react';
import { Friend } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface FriendsViewProps {
  friends: Friend[];
  onStartChat: (friend: Friend) => void;
  onAddFriend: (friend: Friend) => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  friends,
  onStartChat,
  onAddFriend
}) => {
  const { user, appTarget } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // 새 친구 생성 폼 상태
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGreeting, setNewGreeting] = useState('');
  const [newCategory, setNewCategory] = useState<'daily' | 'business' | 'travel' | 'interview' | 'tutor'>('daily');

  const categories = [
    { id: 'all', label: '전체' },
    { id: 'daily', label: '일상 회화' },
    { id: 'business', label: '비즈니스' },
    { id: 'travel', label: '여행/롤플레잉' },
    { id: 'tutor', label: '초보자 튜터' }
  ];

  const filteredFriends = friends.filter((f) => {
    const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCreateFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const colors = ['#d0e1fb', '#f3e8fd', '#e8f0fe', '#feefe3', '#e6f4ea', '#fce8e6'];
    const randomBg = colors[Math.floor(Math.random() * colors.length)];

    const created: Friend = {
      id: `friend-custom-${Date.now()}`,
      name: newName.trim(),
      role: newRole.trim() || 'Custom Conversation Partner',
      description: newDesc.trim() || '나만의 맞춤형 회화 파트너',
      avatarBg: randomBg,
      avatarText: newName.trim().charAt(0).toUpperCase(),
      category: newCategory,
      greeting: newGreeting.trim() || `Hi! I'm ${newName.trim()}. Let's practice English together!`,
      badge: '사용자 지정'
    };

    onAddFriend(created);
    setShowAddModal(false);
    setNewName('');
    setNewRole('');
    setNewDesc('');
    setNewGreeting('');
  };

  return (
    <div className="flex-1 pb-24">
      {/* 1. 상단 내 프로필 카드 */}
      <div className="bg-gradient-to-b from-[#e8f0fe] to-[#f8fafd] p-4 border-b border-[#dadce0]">
        <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl shadow-sm border border-[#e0e3e7]">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#1a73e8] text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-inner">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || '내 프로필'} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>{(user?.displayName || user?.email || '나').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-[#1f1f1f] truncate">
                {user?.displayName || '영어 학습자'}
              </h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                appTarget === 'family' ? 'bg-[#e8f0fe] text-[#1967d2]' : 'bg-[#e6f4ea] text-[#137333]'
              }`}>
                {appTarget === 'family' ? '가족' : '학교'}
              </span>
            </div>
            <p className="text-[11px] text-[#5f6368] truncate mt-0.5">
              {user?.email}
            </p>
            <p className="text-[11px] text-[#1a73e8] font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">military_tech</span>
              매일 10분 실시간 영어 스몰톡 도전 중!
            </p>
          </div>
        </div>
      </div>

      {/* 2. 친구 검색 & 새 친구 추가 액션 바 */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747775] text-[18px]">
              search
            </span>
            <input 
              type="text"
              placeholder="회화 친구 이름 또는 분야 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#dadce0] rounded-xl text-xs placeholder-[#747775] focus:outline-none focus:border-[#1a73e8]"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="h-9 px-3 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-all active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            친구 추가
          </button>
        </div>

        {/* 카테고리 필터 칩 */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-[#001d35] text-white'
                  : 'bg-[#f1f3f4] text-[#444746] hover:bg-[#e3e3e3]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 회화 친구 목록 */}
      <div className="px-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-[#5f6368] font-medium px-1">
          <span>AI 회화 파트너 ({filteredFriends.length}명)</span>
          <span className="text-[11px]">대화하기를 누르면 1:1 채팅이 시작됩니다</span>
        </div>

        {filteredFriends.map((friend) => (
          <div 
            key={friend.id}
            className="bg-white rounded-2xl p-4 border border-[#e0e3e7] shadow-sm hover:shadow transition-shadow flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div 
                  className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-[16px] text-[#1f1f1f] shrink-0 shadow-sm"
                  style={{ backgroundColor: friend.avatarBg }}
                >
                  {friend.avatarText}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[14px] font-bold text-[#1f1f1f]">
                      {friend.name}
                    </h3>
                    {friend.badge && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#e8f0fe] text-[#1a73e8]">
                        {friend.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] font-medium text-[#444746] mt-0.5">
                    {friend.role}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onStartChat(friend)}
                className="px-3.5 py-1.5 bg-[#e8f0fe] hover:bg-[#d2e3fc] active:bg-[#c2e7ff] text-[#1a73e8] font-semibold text-xs rounded-xl flex items-center gap-1 transition-colors shrink-0 shadow-xs"
              >
                <span className="material-symbols-outlined text-[15px]">chat</span>
                대화하기
              </button>
            </div>

            <p className="text-[12px] text-[#5f6368] leading-relaxed bg-[#f8fafd] p-2.5 rounded-xl border border-[#edf2f7]">
              {friend.description}
            </p>

            {/* 첫인사 미리보기 */}
            <div className="flex items-start gap-1.5 text-[11px] text-[#444746] italic">
              <span className="material-symbols-outlined text-[14px] text-[#1a73e8] shrink-0 mt-0.5">format_quote</span>
              <span className="truncate">"{friend.greeting}"</span>
            </div>
          </div>
        ))}

        {filteredFriends.length === 0 && (
          <div className="py-16 text-center text-[#5f6368] space-y-2">
            <span className="material-symbols-outlined text-[36px] text-[#9aa0a6]">person_search</span>
            <p className="text-xs">조건에 맞는 회화 친구가 없습니다.</p>
          </div>
        )}
      </div>

      {/* 4. 새 친구 생성 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#e0e3e7]">
              <h3 className="text-[16px] font-bold text-[#1f1f1f] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1a73e8]">person_add</span>
                새 AI 회화 친구 만들기
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#5f6368]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateFriend} className="space-y-3.5 text-left">
              <div>
                <label className="text-[11px] font-semibold text-[#444746] block mb-1">
                  친구 이름 (영어/한국어) *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="예: David (카페 바리스타)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-xl text-xs focus:outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#444746] block mb-1">
                  역할 및 성향
                </label>
                <input 
                  type="text"
                  placeholder="예: Friendly London Barista"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-xl text-xs focus:outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#444746] block mb-1">
                  분야 (카테고리)
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-xl text-xs focus:outline-none focus:border-[#1a73e8] bg-white"
                >
                  <option value="daily">일상 회화</option>
                  <option value="business">비즈니스</option>
                  <option value="travel">여행/롤플레잉</option>
                  <option value="tutor">초보자 튜터</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#444746] block mb-1">
                  첫 인사말 (영문)
                </label>
                <input 
                  type="text"
                  placeholder="예: Welcome to our cafe! What can I get for you?"
                  value={newGreeting}
                  onChange={(e) => setNewGreeting(e.target.value)}
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-xl text-xs focus:outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#444746] block mb-1">
                  소개 설명
                </label>
                <textarea 
                  rows={2}
                  placeholder="예: 런던 카페에서 주문할 때 유용한 표현을 연습해볼 수 있는 친구"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-xl text-xs focus:outline-none focus:border-[#1a73e8] resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-[#f1f3f4] text-[#444746] font-semibold rounded-xl text-xs hover:bg-[#e3e3e3]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#1a73e8] text-white font-semibold rounded-xl text-xs hover:bg-[#1557b0] shadow-sm"
                >
                  친구 추가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
