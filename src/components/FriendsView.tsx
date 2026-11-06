import React, { useState } from 'react';
import { Friend, GroupMember, Thread } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface FriendsViewProps {
  friends: Friend[];
  groupMembers: GroupMember[];
  threads: Thread[];
  onStartChat: (friend: Friend, forceNew?: boolean) => void;
  onAddFriend: (friend: Friend) => void;
  onDeleteFriend?: (friendId: string) => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  friends,
  groupMembers,
  threads,
  onStartChat,
  onAddFriend,
  onDeleteFriend
}) => {
  const { user, appTarget } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  // 친구 상세 정보 및 삭제 모달 상태
  const [selectedFriendForInfo, setSelectedFriendForInfo] = useState<Friend | null>(null);

  const isFamily = appTarget === 'family';
  const groupTitle = isFamily ? '가족 그룹' : '학교 그룹';

  // 내 계정을 제외한 그룹 멤버 목록
  const otherGroupMembers = groupMembers.filter(m => 
    !m.isAi && m.email.toLowerCase() !== (user?.email || '').toLowerCase()
  );

  // 모달 내 검색 필터링된 멤버
  const filteredModalMembers = otherGroupMembers.filter(m => 
    m.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(modalSearch.toLowerCase())
  );

  // 메인 화면 친구 검색 필터링
  const filteredFriends = friends.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.email && f.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectMember = (member: GroupMember) => {
    const friendObj: Friend = {
      id: member.id,
      name: member.name,
      email: member.email,
      photoURL: member.photoURL,
      avatarBg: member.avatarBg,
      avatarText: member.avatarText,
      isAi: false
    };

    onAddFriend(friendObj);
    setShowMemberModal(false);
    onStartChat(friendObj);
  };

  return (
    <div className="flex-1 pb-24">
      {/* 1. 상단 내 프로필 & 그룹 정보 카드 */}
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
                {user?.displayName || user?.email?.split('@')[0]}
              </h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                isFamily ? 'bg-[#e8f0fe] text-[#1967d2]' : 'bg-[#e6f4ea] text-[#137333]'
              }`}>
                {groupTitle}
              </span>
            </div>
            <p className="text-[11px] text-[#5f6368] truncate mt-0.5">
              {user?.email}
            </p>
            <p className="text-[11px] text-[#1a73e8] font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">group</span>
              우리 {groupTitle} 등록 멤버: {groupMembers.length - 1}명
            </p>
          </div>
        </div>
      </div>

      {/* 2. 검색 및 그룹 멤버에서 친구 추가 버튼 */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747775] text-[18px]">
              search
            </span>
            <input 
              type="text"
              placeholder="친구 이름 또는 이메일 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#dadce0] rounded-xl text-xs placeholder-[#747775] focus:outline-none focus:border-[#1a73e8]"
            />
          </div>

          <button
            onClick={() => setShowMemberModal(true)}
            className="h-9 px-3 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-all active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            그룹 멤버 추가
          </button>
        </div>
      </div>

      {/* 3. 친구 리스트 */}
      <div className="px-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-[#5f6368] font-medium px-1">
          <span>나의 친구 ({filteredFriends.length}명)</span>
          <span className="text-[11px]">프로필을 누르면 정보 확인 및 삭제할 수 있습니다</span>
        </div>

        {filteredFriends.map((friend) => {
          const friendThreads = threads.filter(t => 
            friend.email && t.partnerEmail 
              ? t.partnerEmail.toLowerCase() === friend.email.toLowerCase()
              : t.partnerName === friend.name
          );
          const unreadCount = friendThreads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);

          return (
            <div 
              key={friend.id}
              onClick={() => onStartChat(friend, false)}
              className="bg-white rounded-2xl p-3.5 border border-[#e0e3e7] shadow-sm hover:shadow hover:border-[#1a73e8]/30 transition-all flex items-center justify-between gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* 친구 원형 버튼 (누르면 정보 팝업 및 삭제) */}
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFriendForInfo(friend);
                  }}
                  className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-bold text-[16px] text-[#1f1f1f] shrink-0 shadow-xs cursor-pointer hover:ring-2 hover:ring-[#1a73e8] active:scale-95 transition-all"
                  style={{ backgroundColor: friend.avatarBg }}
                  title={`${friend.name} 정보 및 관리`}
                >
                  {friend.photoURL ? (
                    <img src={friend.photoURL} alt={friend.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{friend.avatarText}</span>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-[14px] font-bold text-[#1f1f1f] truncate group-hover:text-[#1a73e8] transition-colors">
                      {friend.name}
                    </h3>
                    {unreadCount > 0 && (
                      <span className="bg-[#d93025] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-xs animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {friend.isAi && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#c2e7ff] text-[#001d35]">
                        AI
                      </span>
                    )}
                  </div>
                  {friend.email ? (
                    <p className="text-[11px] text-[#5f6368] truncate mt-0.5">
                      {friend.email}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#5f6368] truncate mt-0.5">
                      회화 연습 AI 코치
                    </p>
                  )}
                </div>
              </div>

              {/* 우측 액션 버튼: 실제 친구는 원클릭 '대화하기', AI는 이어하기/새 대화 */}
              {!friend.isAi ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartChat(friend, false);
                  }}
                  className="px-3.5 py-1.5 bg-[#e8f0fe] hover:bg-[#d2e3fc] active:bg-[#c2e7ff] text-[#1a73e8] font-bold text-xs rounded-xl flex items-center gap-1 transition-all shrink-0 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[15px]">chat</span>
                  대화하기
                </button>
              ) : (
                friendThreads.length > 0 ? (
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onStartChat(friend, false)}
                      className="px-2.5 py-1.5 bg-[#f0f4f9] hover:bg-[#e2e7ff] text-[#1f1f1f] font-semibold text-xs rounded-xl flex items-center gap-1 transition-colors shadow-xs"
                      title="기존 최근 대화방 이어하기"
                    >
                      <span className="material-symbols-outlined text-[15px]">forum</span>
                      <span>이어하기</span>
                    </button>
                    <button
                      onClick={() => onStartChat(friend, true)}
                      className="px-2.5 py-1.5 bg-[#e8f0fe] hover:bg-[#d2e3fc] text-[#1a73e8] font-semibold text-xs rounded-xl flex items-center gap-1 transition-colors shadow-xs"
                      title="새 대화방(스레드) 개설"
                    >
                      <span className="material-symbols-outlined text-[15px]">add</span>
                      <span>새 대화</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartChat(friend, true);
                    }}
                    className="px-3.5 py-1.5 bg-[#e8f0fe] hover:bg-[#d2e3fc] active:bg-[#c2e7ff] text-[#1a73e8] font-semibold text-xs rounded-xl flex items-center gap-1 transition-colors shrink-0 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">chat</span>
                    대화하기
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* 4. 그룹 멤버 목록에서 찾기 모달 (복잡한 양식 없음!) */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            
            {/* 모달 상단 */}
            <div className="flex items-center justify-between pb-2 border-b border-[#e0e3e7]">
              <div>
                <h3 className="text-[16px] font-bold text-[#1f1f1f] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#1a73e8]">group</span>
                  우리 {groupTitle} 멤버 목록
                </h3>
                <p className="text-[11px] text-[#5f6368] mt-0.5">
                  대화하고 싶은 구성원을 선택하세요
                </p>
              </div>
              <button 
                onClick={() => setShowMemberModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-black/5"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* 멤버 검색창 */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747775] text-[16px]">
                search
              </span>
              <input 
                type="text"
                placeholder="이름 또는 이메일 검색..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-xs outline-none focus:border-[#1a73e8]"
              />
            </div>

            {/* 멤버 목록 리스트 */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredModalMembers.map((member) => {
                const isAlreadyFriend = friends.some(f => f.email && f.email.toLowerCase() === member.email.toLowerCase());

                return (
                  <div 
                    key={member.id}
                    className="p-3 bg-white border border-[#e0e3e7] hover:border-[#1a73e8]/40 rounded-2xl flex items-center justify-between gap-2.5 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center font-bold text-xs text-[#1f1f1f] shrink-0"
                        style={{ backgroundColor: member.avatarBg }}
                      >
                        {member.photoURL ? (
                          <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{member.avatarText}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#1f1f1f] truncate">
                          {member.name}
                        </p>
                        <p className="text-[11px] text-[#5f6368] truncate font-mono">
                          {member.email}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectMember(member)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                        isAlreadyFriend 
                          ? 'bg-[#f1f3f4] text-[#1f1f1f] hover:bg-[#e3e3e3]' 
                          : 'bg-[#1a73e8] text-white hover:bg-[#1557b0] shadow-xs'
                      }`}
                    >
                      {isAlreadyFriend ? '대화하기' : '선택'}
                    </button>
                  </div>
                );
              })}

              {filteredModalMembers.length === 0 && (
                <div className="py-12 text-center text-xs text-[#5f6368] space-y-2">
                  <span className="material-symbols-outlined text-[32px] text-[#9aa0a6]">person_search</span>
                  <p>일치하는 그룹 멤버가 없습니다.</p>
                  <p className="text-[11px] text-[#80868b]">
                    우측 상단 프로필 메뉴 &gt; [계정 관리]에서<br />새 멤버 이메일을 등록할 수 있습니다.
                  </p>
                </div>
              )}
            </div>

            {/* 하단 닫기 */}
            <div className="pt-2 border-t border-[#e0e3e7] flex justify-end">
              <button
                onClick={() => setShowMemberModal(false)}
                className="w-full py-2 bg-[#f1f3f4] text-[#444746] rounded-xl text-xs font-semibold hover:bg-[#e3e3e3]"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 친구 원형 버튼 클릭 시 나타나는 간단한 정보 및 삭제 팝업 */}
      {selectedFriendForInfo && (
        <div 
          onClick={() => setSelectedFriendForInfo(null)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-150"
          >
            {/* 원형 아바타 */}
            <div 
              className="w-20 h-20 rounded-full mx-auto overflow-hidden flex items-center justify-center font-bold text-2xl text-[#1f1f1f] shadow-sm ring-4 ring-black/5"
              style={{ backgroundColor: selectedFriendForInfo.avatarBg }}
            >
              {selectedFriendForInfo.photoURL ? (
                <img 
                  src={selectedFriendForInfo.photoURL} 
                  alt={selectedFriendForInfo.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{selectedFriendForInfo.avatarText}</span>
              )}
            </div>

            {/* 친구 기본 정보 */}
            <div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <h3 className="text-[17px] font-bold text-[#1f1f1f]">
                  {selectedFriendForInfo.name}
                </h3>
                {selectedFriendForInfo.isAi && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#c2e7ff] text-[#001d35]">
                    AI 파트너
                  </span>
                )}
              </div>
              {selectedFriendForInfo.email && (
                <p className="text-[12px] text-[#5f6368] font-mono break-all">
                  {selectedFriendForInfo.email}
                </p>
              )}
              <p className="text-[12px] text-[#1a73e8] font-medium mt-1.5">
                대화방: {threads.filter(t => t.partnerName === selectedFriendForInfo.name).length}개
              </p>
            </div>

            {/* 작업 버튼: 대화하기, 삭제, 닫기 */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  const target = selectedFriendForInfo;
                  setSelectedFriendForInfo(null);
                  onStartChat(target, false);
                }}
                className="w-full py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[17px]">chat</span>
                대화 시작하기
              </button>

              {onDeleteFriend && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`'${selectedFriendForInfo.name}'님을 친구 목록에서 삭제하시겠습니까?`)) {
                      onDeleteFriend(selectedFriendForInfo.id);
                      setSelectedFriendForInfo(null);
                    }
                  }}
                  className="w-full py-2 text-[#d93025] hover:bg-[#fce8e6] rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">person_remove</span>
                  친구 삭제
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedFriendForInfo(null)}
                className="w-full py-2 text-[#5f6368] hover:bg-[#f0f4f9] rounded-xl text-[12px] font-medium transition-colors"
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
