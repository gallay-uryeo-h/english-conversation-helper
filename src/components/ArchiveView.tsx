import React, { useState, useEffect } from 'react';
import { SavedExpression, SavedScript, ConversationExpressionItem } from '../types';
import { storageService } from '../services/storageService';

interface ArchiveViewProps {
  expressions: SavedExpression[];
  scripts: SavedScript[];
  onAddExpression?: (exp: SavedExpression) => void;
  onDeleteExpression?: (id: string) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  expressions,
  scripts,
  onAddExpression,
  onDeleteExpression
}) => {
  const [subTab, setSubTab] = useState<'conversations' | 'favorites' | 'scripts'>('conversations');
  const [conversationExpressions, setConversationExpressions] = useState<ConversationExpressionItem[]>([]);
  const [loadingConv, setLoadingConv] = useState(false);
  
  // 검색 및 필터
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<string>('all');

  // 직접 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEng, setNewEng] = useState('');
  const [newKor, setNewKor] = useState('');
  const [newEx, setNewEx] = useState('');

  // 음성 듣기 상태 (재생 중인 ID)
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // 복사 알림 토스트 상태
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 대화 목록에서 자동 수집된 표현 로드
  useEffect(() => {
    let isCancelled = false;
    const loadConversationExpressions = async () => {
      setLoadingConv(true);
      try {
        const items = await storageService.getAllConversationExpressions();
        if (!isCancelled) {
          setConversationExpressions(items);
        }
      } catch (e) {
        console.warn("Failed to load conversation expressions:", e);
      } finally {
        if (!isCancelled) setLoadingConv(false);
      }
    };

    loadConversationExpressions();
    return () => { isCancelled = true; };
  }, []);

  // Web Speech API 원어민 발음 재생
  const handlePlaySpeech = (id: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.lang.startsWith('en') && (
      v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha')
    )) || voices.find(v => v.lang.startsWith('en'));

    if (naturalVoice) utterance.voice = naturalVoice;

    utterance.onstart = () => setSpeakingId(id);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    window.speechSynthesis.speak(utterance);
  };

  // 문장 클립보드 복사
  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // 중요 보관함 북마크 토글
  const handleToggleBookmark = (item: ConversationExpressionItem) => {
    const existing = expressions.find(e => e.exampleSentence === item.english || e.english === item.english);
    if (existing) {
      onDeleteExpression?.(existing.id);
    } else {
      const bestExpression = item.keyExpressions && item.keyExpressions.length > 0 
        ? item.keyExpressions[0].phrase 
        : item.english;
      const bestMeaning = item.keyExpressions && item.keyExpressions.length > 0 
        ? item.keyExpressions[0].meaning 
        : item.korean;

      onAddExpression?.({
        id: `exp-${Date.now()}`,
        english: bestExpression,
        korean: bestMeaning,
        exampleSentence: item.english,
        tag: item.partnerName,
        partnerName: item.partnerName,
        createdAt: Date.now()
      });
    }
  };

  // 직접 추가 폼 제출
  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEng.trim() || !newKor.trim()) return;

    onAddExpression?.({
      id: `exp-${Date.now()}`,
      english: newEng.trim(),
      korean: newKor.trim(),
      exampleSentence: newEx.trim() || newEng.trim(),
      tag: '직접등록',
      createdAt: Date.now()
    });

    setNewEng('');
    setNewKor('');
    setNewEx('');
    setShowAddModal(false);
  };

  // 고유한 대화 파트너 목록 추출 (필터 칩용)
  const uniquePartners = Array.from(new Set(conversationExpressions.map(c => c.partnerName)));

  // 대화 표현 필터링 (검색어 + 파트너)
  const filteredConversations = conversationExpressions.filter((item) => {
    const matchesPartner = selectedPartner === 'all' || item.partnerName === selectedPartner;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch = !q || 
      item.english.toLowerCase().includes(q) || 
      item.korean.toLowerCase().includes(q) ||
      (item.keyExpressions && item.keyExpressions.some(k => k.phrase.toLowerCase().includes(q) || k.meaning.toLowerCase().includes(q)));
    
    return matchesPartner && matchesSearch;
  });

  // 중요 보관함 필터링
  const filteredFavorites = expressions.filter((exp) => {
    const q = searchTerm.trim().toLowerCase();
    return !q || 
      exp.english.toLowerCase().includes(q) || 
      exp.korean.toLowerCase().includes(q) || 
      exp.exampleSentence.toLowerCase().includes(q);
  });

  // 시간 포맷 헬퍼
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-3 sm:p-4 space-y-3.5 max-w-md mx-auto pb-24">
      {/* 1. 상단 서브 탭 스위치 */}
      <div className="p-1 bg-[#eaedff] rounded-2xl flex items-center">
        <button
          onClick={() => setSubTab('conversations')}
          className={`flex-1 py-2 rounded-xl text-[12px] sm:text-[13px] font-semibold transition-all flex items-center justify-center gap-1 ${
            subTab === 'conversations'
              ? 'bg-white text-[#1a73e8] shadow-sm'
              : 'text-[#5f6368] hover:text-[#1f1f1f]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">forum</span>
          <span>대화 표현 ({conversationExpressions.length})</span>
        </button>

        <button
          onClick={() => setSubTab('favorites')}
          className={`flex-1 py-2 rounded-xl text-[12px] sm:text-[13px] font-semibold transition-all flex items-center justify-center gap-1 ${
            subTab === 'favorites'
              ? 'bg-white text-[#1a73e8] shadow-sm'
              : 'text-[#5f6368] hover:text-[#1f1f1f]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px] text-[#f29900]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          <span>중요 보관함 ({expressions.length})</span>
        </button>

        {scripts.length > 0 && (
          <button
            onClick={() => setSubTab('scripts')}
            className={`px-3 py-2 rounded-xl text-[12px] font-semibold transition-all ${
              subTab === 'scripts'
                ? 'bg-white text-[#1a73e8] shadow-sm'
                : 'text-[#5f6368] hover:text-[#1f1f1f]'
            }`}
          >
            대본
          </button>
        )}
      </div>

      {/* 2. 검색 바 & 친구 필터 칩 */}
      {subTab !== 'scripts' && (
        <div className="space-y-2">
          {/* 검색 입력창 */}
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-[#747775] text-[18px]">search</span>
            <input
              type="text"
              placeholder="영어 문장 또는 한글 해석 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-[#dadce0] rounded-xl text-[13px] outline-none focus:border-[#1a73e8] placeholder-[#747775]"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 text-[#9aa0a6] hover:text-[#444746]"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
              </button>
            )}
          </div>

          {/* 친구별 필터 칩 (대화 표현 탭인 경우) */}
          {subTab === 'conversations' && uniquePartners.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setSelectedPartner('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                  selectedPartner === 'all'
                    ? 'bg-[#1a73e8] text-white shadow-xs'
                    : 'bg-white text-[#5f6368] border border-[#dadce0] hover:bg-[#f1f3f4]'
                }`}
              >
                전체
              </button>
              {uniquePartners.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedPartner(name)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                    selectedPartner === name
                      ? 'bg-[#1a73e8] text-white shadow-xs'
                      : 'bg-white text-[#5f6368] border border-[#dadce0] hover:bg-[#f1f3f4]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. 대화 표현 모아보기 탭 (자동 수집) */}
      {subTab === 'conversations' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] font-medium text-[#5f6368]">
              대화 중 자동으로 해석과 함께 축적된 표현들
            </span>
            <span className="text-[11px] text-[#747775]">
              {filteredConversations.length}개 발견
            </span>
          </div>

          {loadingConv ? (
            <div className="py-16 text-center text-[#5f6368] space-y-2 bg-white rounded-2xl border border-[#e0e3e7] p-6">
              <div className="w-6 h-6 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-[13px]">대화 표현들을 정리하고 있습니다...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="py-16 text-center text-[#5f6368] space-y-3 bg-white rounded-2xl border border-[#e0e3e7] p-6">
              <span className="material-symbols-outlined text-[48px] text-[#bfc6dd]">chat_bubble_outline</span>
              <p className="text-[14px] font-semibold text-[#1f1f1f]">
                {searchTerm ? '검색된 대화 표현이 없습니다.' : '아직 수집된 대화 표현이 없습니다.'}
              </p>
              <p className="text-[12px] text-[#747775] leading-relaxed max-w-xs mx-auto">
                친구 메뉴에서 AI 친구와 스몰톡 대화를 나누면, 주고받은 유용한 문장과 핵심 표현이 이곳에 자동으로 정리됩니다!
              </p>
            </div>
          ) : (
            filteredConversations.map((item) => {
              const isBookmarked = expressions.some(e => e.exampleSentence === item.english || e.english === item.english);

              return (
                <div
                  key={item.id}
                  className="p-3.5 bg-white border border-[#e0e3e7] rounded-2xl shadow-xs hover:border-[#c2e7ff] transition-all space-y-2.5"
                >
                  {/* 카드 상단: 파트너 프로필 & 시간 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div 
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-2xs"
                        style={{ backgroundColor: item.avatarBg, color: '#1f1f1f' }}
                      >
                        {item.avatarText}
                      </div>
                      <span className="text-[12px] font-semibold text-[#1f1f1f] truncate">
                        {item.partnerName}와의 대화
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                        item.sender === 'user' ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'bg-[#f1f3f4] text-[#5f6368]'
                      }`}>
                        {item.sender === 'user' ? '내 발화' : '상대방'}
                      </span>
                    </div>

                    <span className="text-[11px] text-[#9aa0a6] shrink-0">
                      {formatTime(item.timestamp)}
                    </span>
                  </div>

                  {/* 영어 문장 본문 */}
                  <div className="space-y-1">
                    <p className="text-[15px] font-semibold text-[#1f1f1f] leading-snug">
                      {item.english}
                    </p>
                    {item.korean && (
                      <p className="text-[13px] text-[#3c4043] leading-relaxed font-normal">
                        {item.korean}
                      </p>
                    )}
                  </div>

                  {/* 핵심 표현 및 숙어 칩들 */}
                  {item.keyExpressions && item.keyExpressions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.keyExpressions.map((k, i) => (
                        <button
                          key={i}
                          onClick={() => handlePlaySpeech(`sub-${item.id}-${i}`, k.phrase)}
                          className="px-2 py-0.5 rounded-lg bg-[#f0f4f9] hover:bg-[#e2edff] text-[11px] font-medium text-[#1a73e8] inline-flex items-center gap-1 transition-all active:scale-95 text-left"
                          title="핵심 표현 발음 듣기"
                        >
                          <span className="font-bold">{k.phrase}</span>: {k.meaning}
                          <span className="material-symbols-outlined text-[12px] opacity-70">
                            {speakingId === `sub-${item.id}-${i}` ? 'volume_up' : 'volume_down'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 카드 하단 액션 버튼 바 */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#f1f3f4]">
                    <div className="flex items-center gap-1">
                      {/* 전체 문장 TTS 발음 듣기 */}
                      <button
                        onClick={() => handlePlaySpeech(item.id, item.english)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all active:scale-95 ${
                          speakingId === item.id 
                            ? 'bg-[#1a73e8] text-white animate-pulse' 
                            : 'bg-[#f1f3f4] text-[#444746] hover:bg-[#e8f0fe] hover:text-[#1a73e8]'
                        }`}
                        title="원어민 발음 듣기"
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {speakingId === item.id ? 'graphic_eq' : 'volume_up'}
                        </span>
                        <span>{speakingId === item.id ? '재생 중' : '발음 듣기'}</span>
                      </button>

                      {/* 문장 복사 */}
                      <button
                        onClick={() => handleCopyText(item.id, item.english)}
                        className="p-1 rounded-full text-[#747775] hover:text-[#1f1f1f] hover:bg-black/5 transition-colors"
                        title="영문 복사"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {copiedId === item.id ? 'done' : 'content_copy'}
                        </span>
                      </button>
                      {copiedId === item.id && (
                        <span className="text-[11px] text-[#188038] font-medium animate-fadeIn">
                          복사됨!
                        </span>
                      )}
                    </div>

                    {/* 북마크(중요 보관함 저장) 토글 버튼 */}
                    <button
                      onClick={() => handleToggleBookmark(item)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                        isBookmarked 
                          ? 'bg-[#fef7e0] text-[#b06000] border border-[#fce8b2]' 
                          : 'bg-white border border-[#dadce0] text-[#5f6368] hover:border-[#1a73e8] hover:text-[#1a73e8]'
                      }`}
                      title={isBookmarked ? "중요 보관함에서 해제" : "중요 보관함에 저장"}
                    >
                      <span 
                        className={`material-symbols-outlined text-[16px] ${isBookmarked ? 'text-[#f29900]' : 'text-[#747775]'}`}
                        style={{ fontVariationSettings: isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        star
                      </span>
                      <span>{isBookmarked ? '보관됨' : '보관'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. 중요 보관함 뷰 (나만의 핵심 단어장) */}
      {subTab === 'favorites' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] font-medium text-[#5f6368]">
              내가 별표한 핵심 표현 및 직접 등록한 단어장
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1 bg-[#1a73e8] text-white rounded-full text-[12px] font-semibold hover:bg-[#1557b0] flex items-center gap-1 shadow-xs transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              직접 추가
            </button>
          </div>

          {filteredFavorites.length === 0 ? (
            <div className="py-16 text-center text-[#5f6368] space-y-3 bg-white rounded-2xl border border-[#e0e3e7] p-6">
              <span className="material-symbols-outlined text-[48px] text-[#f29900]" style={{ fontVariationSettings: "'FILL' 0" }}>star</span>
              <p className="text-[14px] font-semibold text-[#1f1f1f]">
                {searchTerm ? '검색된 중요 표현이 없습니다.' : '아직 보관된 중요 표현이 없습니다.'}
              </p>
              <p className="text-[12px] text-[#747775] leading-relaxed max-w-xs mx-auto">
                대화 표현 탭에서 마음에 드는 문장의 ⭐ 보관 버튼을 누르거나, 상단의 '직접 추가'를 통해 나만의 표현을 등록해보세요.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-2 inline-flex items-center gap-1 px-4 py-2 bg-[#e8f0fe] text-[#1a73e8] rounded-xl text-xs font-semibold hover:bg-[#d2e3fc]"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                첫 표현 직접 등록하기
              </button>
            </div>
          ) : (
            filteredFavorites.map((exp) => (
              <div
                key={exp.id}
                className="p-3.5 bg-white border border-[#e0e3e7] rounded-2xl shadow-xs hover:border-[#c2e7ff] transition-all space-y-2 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fef7e0] text-[#b06000]">
                    {exp.tag || '중요표현'}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePlaySpeech(exp.id, exp.exampleSentence || exp.english)}
                      className={`p-1 rounded-full text-[#5f6368] hover:text-[#1a73e8] ${speakingId === exp.id ? 'text-[#1a73e8] animate-pulse' : ''}`}
                      title="발음 듣기"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {speakingId === exp.id ? 'graphic_eq' : 'volume_up'}
                      </span>
                    </button>
                    {onDeleteExpression && (
                      <button
                        onClick={() => onDeleteExpression(exp.id)}
                        className="text-[#9aa0a6] hover:text-[#d93025] transition-colors p-1"
                        title="표현 삭제"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-[16px] font-bold text-[#1f1f1f] leading-snug">
                    {exp.english}
                  </h4>
                  <p className="text-[13px] font-medium text-[#00897b] mt-0.5">
                    {exp.korean}
                  </p>
                </div>

                {exp.exampleSentence && (
                  <div className="p-2.5 bg-[#f8fafd] rounded-xl text-[12px] text-[#444746] leading-relaxed border border-[#edf0f5]">
                    <span className="font-semibold text-[#1f1f1f] block mb-0.5">예문:</span>
                    "{exp.exampleSentence}"
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 5. 콘텐츠 대본 뷰 (기존 호환성 유지) */}
      {subTab === 'scripts' && (
        <div className="space-y-4">
          {scripts.map((script) => (
            <div
              key={script.id}
              className="p-4 bg-white border border-[#e0e3e7] rounded-2xl shadow-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0f4f9] text-[#1a73e8]">
                  {script.level}
                </span>
                <span className="text-[11px] text-[#747775]">
                  대화 {script.dialogue.length}줄
                </span>
              </div>
              <h3 className="text-[16px] font-bold text-[#1f1f1f]">{script.title}</h3>
              <p className="text-[12px] text-[#5f6368]">{script.situation}</p>
            </div>
          ))}
        </div>
      )}

      {/* 직접 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-[16px] font-bold text-[#1f1f1f] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#1a73e8]">bookmark_add</span>
              새 회화 표현 등록
            </h3>

            <form onSubmit={handleAddCustom} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#5f6368] block mb-1">
                  영어 단어 또는 핵심 표현 *
                </label>
                <input
                  type="text"
                  placeholder="예: reach out to"
                  value={newEng}
                  onChange={(e) => setNewEng(e.target.value)}
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-xl text-[13px] outline-none focus:border-[#1a73e8]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#5f6368] block mb-1">
                  한국어 뜻 / 뉘앙스 *
                </label>
                <input
                  type="text"
                  placeholder="예: ~에게 연락을 취하다"
                  value={newKor}
                  onChange={(e) => setNewKor(e.target.value)}
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-xl text-[13px] outline-none focus:border-[#1a73e8]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#5f6368] block mb-1">
                  예문 문장 (선택)
                </label>
                <textarea
                  placeholder="예: Feel free to reach out to me anytime."
                  value={newEx}
                  onChange={(e) => setNewEx(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-xl text-[13px] outline-none focus:border-[#1a73e8] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold text-[#5f6368] hover:bg-black/5"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!newEng.trim() || !newKor.trim()}
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-[#1a73e8] text-white hover:bg-[#1557b0] disabled:opacity-50"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
