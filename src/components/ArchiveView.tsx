import React, { useState, useEffect } from 'react';
import { SavedExpression, SavedScript, VocabularyCorpusItem, VocabularyContext } from '../types';
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
  const [subTab, setSubTab] = useState<'vocabulary' | 'favorites' | 'scripts'>('vocabulary');
  const [vocabularyItems, setVocabularyItems] = useState<VocabularyCorpusItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 검색 및 정렬
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'count' | 'alpha'>('latest');

  // 대화 예문 아코디언이 열려있는 단어 ID들
  const [expandedWordIds, setExpandedWordIds] = useState<Record<string, boolean>>({});

  // 직접 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEng, setNewEng] = useState('');
  const [newKor, setNewKor] = useState('');
  const [newEx, setNewEx] = useState('');

  // 음성 듣기 상태 (재생 중인 ID)
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // 복사 알림 토스트 상태
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 대화 목록에서 단어 중심 코퍼스 로드
  useEffect(() => {
    let isCancelled = false;
    const loadVocabulary = async () => {
      setLoading(true);
      try {
        const items = await storageService.getAllVocabularyItems();
        if (!isCancelled) {
          setVocabularyItems(items);
          // 기본적으로 첫 2개 단어는 대화 예문을 열어둠
          const initialExpanded: Record<string, boolean> = {};
          items.slice(0, 2).forEach(it => {
            initialExpanded[it.id] = true;
          });
          setExpandedWordIds(initialExpanded);
        }
      } catch (e) {
        console.warn("Failed to load vocabulary items:", e);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadVocabulary();
    return () => { isCancelled = true; };
  }, []);

  // Web Speech API 발음 듣기
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

  // 대화보기 아코디언 토글
  const handleToggleExpand = (wordId: string) => {
    setExpandedWordIds(prev => ({
      ...prev,
      [wordId]: !prev[wordId]
    }));
  };

  // 중요 보관함 북마크 토글
  const handleToggleBookmark = (item: VocabularyCorpusItem) => {
    const existing = expressions.find(e => 
      e.english.toLowerCase().trim() === item.phrase.toLowerCase().trim()
    );

    if (existing) {
      onDeleteExpression?.(existing.id);
    } else {
      const firstContext = item.contexts[0];
      onAddExpression?.({
        id: `exp-${Date.now()}`,
        english: item.phrase,
        korean: item.meaning,
        exampleSentence: firstContext ? firstContext.englishSentence : item.phrase,
        tag: '대화수집',
        partnerName: firstContext ? firstContext.partnerName : undefined,
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

  // 문장 내에서 키워드 하이라이트 렌더러
  const renderHighlightedSentence = (sentence: string, keyword: string) => {
    if (!keyword) return sentence;
    const parts = sentence.split(new RegExp(`(${keyword})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === keyword.toLowerCase() ? (
            <mark key={i} className="bg-[#fef7e0] text-[#b06000] font-bold px-1 py-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  // 단어 필터링 및 정렬
  const filteredVocabulary = vocabularyItems
    .filter((item) => {
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;
      return (
        item.phrase.toLowerCase().includes(q) ||
        item.meaning.toLowerCase().includes(q) ||
        item.contexts.some(c => 
          c.englishSentence.toLowerCase().includes(q) || 
          c.koreanTranslation.toLowerCase().includes(q)
        )
      );
    })
    .sort((a, b) => {
      if (sortBy === 'count') return b.usageCount - a.usageCount;
      if (sortBy === 'alpha') return a.phrase.localeCompare(b.phrase);
      return b.lastUsedAt - a.lastUsedAt;
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
          onClick={() => setSubTab('vocabulary')}
          className={`flex-1 py-2 rounded-xl text-[12px] sm:text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'vocabulary'
              ? 'bg-white text-[#1a73e8] shadow-sm'
              : 'text-[#5f6368] hover:text-[#1f1f1f]'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">auto_stories</span>
          <span>단어·표현 ({vocabularyItems.length})</span>
        </button>

        <button
          onClick={() => setSubTab('favorites')}
          className={`flex-1 py-2 rounded-xl text-[12px] sm:text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'favorites'
              ? 'bg-white text-[#1a73e8] shadow-sm'
              : 'text-[#5f6368] hover:text-[#1f1f1f]'
          }`}
        >
          <span className="material-symbols-outlined text-[17px] text-[#f29900]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
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

      {/* 2. 검색 및 정렬 컨트롤 */}
      {subTab !== 'scripts' && (
        <div className="space-y-2">
          {/* 검색창 */}
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-[#747775] text-[18px]">search</span>
            <input
              type="text"
              placeholder="단어(예: cozy) 또는 뜻 검색..."
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

          {/* 정렬 필터 칩 (단어·표현 탭일 때) */}
          {subTab === 'vocabulary' && vocabularyItems.length > 0 && (
            <div className="flex items-center justify-between px-1 text-[11px] text-[#5f6368]">
              <span>실제 대화 문맥 속에서 학습하는 나만의 코퍼스</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSortBy('latest')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    sortBy === 'latest' ? 'bg-[#1a73e8] text-white' : 'bg-[#f1f3f4] text-[#5f6368]'
                  }`}
                >
                  최신순
                </button>
                <button
                  onClick={() => setSortBy('count')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    sortBy === 'count' ? 'bg-[#1a73e8] text-white' : 'bg-[#f1f3f4] text-[#5f6368]'
                  }`}
                >
                  빈도순
                </button>
                <button
                  onClick={() => setSortBy('alpha')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    sortBy === 'alpha' ? 'bg-[#1a73e8] text-white' : 'bg-[#f1f3f4] text-[#5f6368]'
                  }`}
                >
                  A-Z
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. 단어·표현 사전 뷰 (단어 + 뜻 보기 + 대화 보기) */}
      {subTab === 'vocabulary' && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 text-center text-[#5f6368] space-y-2 bg-white rounded-2xl border border-[#e0e3e7] p-6">
              <div className="w-6 h-6 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-[13px]">대화 속 핵심 표현들을 정리하고 있습니다...</p>
            </div>
          ) : filteredVocabulary.length === 0 ? (
            <div className="py-16 text-center text-[#5f6368] space-y-3 bg-white rounded-2xl border border-[#e0e3e7] p-6">
              <span className="material-symbols-outlined text-[48px] text-[#bfc6dd]">menu_book</span>
              <p className="text-[14px] font-semibold text-[#1f1f1f]">
                {searchTerm ? '검색된 단어가 없습니다.' : '아직 수집된 단어와 표현이 없습니다.'}
              </p>
              <p className="text-[12px] text-[#747775] leading-relaxed max-w-xs mx-auto">
                친구 메뉴에서 AI 친구와 대화를 시작해 보세요! 나눈 대화 속 핵심 표현들이 뜻과 함께 이곳에 자동으로 누적됩니다.
              </p>
            </div>
          ) : (
            filteredVocabulary.map((item) => {
              const isExpanded = Boolean(expandedWordIds[item.id]);
              const isBookmarked = expressions.some(e => 
                e.english.toLowerCase().trim() === item.phrase.toLowerCase().trim()
              );

              return (
                <div
                  key={item.id}
                  className="bg-white border border-[#e0e3e7] rounded-2xl shadow-xs hover:border-[#c2e7ff] transition-all overflow-hidden"
                >
                  {/* 단어 카드 헤더: 표제어 + 발음 + 뜻 + 보관 + 횟수 배지 */}
                  <div className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* 표제어 (단어/숙어) */}
                        <h3 className="text-[18px] font-bold text-[#1f1f1f] tracking-tight truncate">
                          {item.phrase}
                        </h3>

                        {/* 단어 자체 발음 듣기 */}
                        <button
                          onClick={() => handlePlaySpeech(`word-${item.id}`, item.phrase)}
                          className={`p-1 rounded-full transition-all active:scale-90 ${
                            speakingId === `word-${item.id}` 
                              ? 'text-[#1a73e8] animate-pulse' 
                              : 'text-[#747775] hover:text-[#1a73e8]'
                          }`}
                          title="단어 발음 듣기"
                        >
                          <span className="material-symbols-outlined text-[18px] leading-none">
                            {speakingId === `word-${item.id}` ? 'graphic_eq' : 'volume_up'}
                          </span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* 사용 횟수 배지 */}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0f4f9] text-[#1a73e8]">
                          {item.usageCount}회 대화
                        </span>

                        {/* 중요 보관함 북마크 토글 */}
                        <button
                          onClick={() => handleToggleBookmark(item)}
                          className={`p-1 rounded-full transition-all active:scale-90 ${
                            isBookmarked ? 'text-[#f29900]' : 'text-[#dadce0] hover:text-[#f29900]'
                          }`}
                          title={isBookmarked ? "중요 보관함에서 해제" : "중요 보관함에 저장"}
                        >
                          <span 
                            className="material-symbols-outlined text-[20px] leading-none"
                            style={{ fontVariationSettings: isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            star
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* 뜻 보기 (직관적 노출) */}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[11px] font-bold text-[#1a73e8] shrink-0">뜻:</span>
                      <p className="text-[13px] text-[#202124] font-medium leading-snug">
                        {item.meaning || '한국어 의미 준비 중'}
                      </p>
                    </div>

                    {/* 대화보기 토글 버튼 */}
                    <div className="pt-1">
                      <button
                        onClick={() => handleToggleExpand(item.id)}
                        className="w-full py-1.5 px-3 bg-[#f8fafd] hover:bg-[#f0f4f9] active:bg-[#e8f0fe] rounded-xl text-[12px] font-semibold text-[#1a73e8] flex items-center justify-between transition-colors border border-[#edf0f5]"
                      >
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">chat</span>
                          대화보기 ({item.contexts.length}개의 실제 대화 문맥)
                        </span>
                        <span className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : 'rotate-0'
                        }`}>
                          expand_more
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 대화 문장들 아코디언 본체 (부드러운 전개) */}
                  <div className={`grid transition-all duration-200 ease-in-out border-t border-[#f1f3f4] bg-[#fbfcfd] ${
                    isExpanded 
                      ? 'grid-rows-[1fr] opacity-100 p-3' 
                      : 'grid-rows-[0fr] opacity-0 p-0 pointer-events-none'
                  }`}>
                    <div className="overflow-hidden space-y-2.5">
                      {item.contexts.map((ctx) => (
                        <div 
                          key={ctx.msgId}
                          className="p-2.5 bg-white rounded-xl border border-[#e0e3e7] shadow-2xs space-y-1.5"
                        >
                          {/* 파트너 & 시간 & 발화 주체 */}
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <div 
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                                style={{ backgroundColor: ctx.avatarBg, color: '#1f1f1f' }}
                              >
                                {ctx.avatarText}
                              </div>
                              <span className="font-semibold text-[#1f1f1f]">
                                {ctx.partnerName}와의 대화
                              </span>
                              <span className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                                ctx.sender === 'user' ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'bg-[#f1f3f4] text-[#5f6368]'
                              }`}>
                                {ctx.sender === 'user' ? '내가 말함' : '상대방'}
                              </span>
                            </div>

                            <span className="text-[#9aa0a6] text-[10px]">
                              {formatTime(ctx.timestamp)}
                            </span>
                          </div>

                          {/* 실제 대화 영문 문장 (키워드 하이라이트) & 문장 옆 스피커 아이콘 및 복사 버튼 */}
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] text-[#1f1f1f] leading-relaxed select-text flex-1">
                              "{renderHighlightedSentence(ctx.englishSentence, item.phrase)}"
                            </p>

                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                              {/* 문장 발음 듣기 스피커 아이콘 */}
                              <button
                                onClick={() => handlePlaySpeech(ctx.msgId, ctx.englishSentence)}
                                className={`p-1 rounded-full transition-all active:scale-90 ${
                                  speakingId === ctx.msgId 
                                    ? 'text-[#1a73e8] animate-pulse' 
                                    : 'text-[#747775] hover:text-[#1a73e8]'
                                }`}
                                title="문장 듣기"
                              >
                                <span className="material-symbols-outlined text-[18px] leading-none">
                                  {speakingId === ctx.msgId ? 'graphic_eq' : 'volume_up'}
                                </span>
                              </button>

                              {/* 바로 옆 복사 버튼 */}
                              <button
                                onClick={() => handleCopyText(ctx.msgId, ctx.englishSentence)}
                                className={`p-1 rounded-full transition-all active:scale-90 ${
                                  copiedId === ctx.msgId 
                                    ? 'text-[#188038]' 
                                    : 'text-[#747775] hover:text-[#1a73e8]'
                                }`}
                                title={copiedId === ctx.msgId ? "복사 완료" : "문장 복사"}
                              >
                                <span className="material-symbols-outlined text-[17px] leading-none">
                                  {copiedId === ctx.msgId ? 'done' : 'content_copy'}
                                </span>
                              </button>
                            </div>
                          </div>

                          {/* 해석보기 */}
                          {ctx.koreanTranslation && (
                            <div className="flex items-start gap-1 pt-0.5 text-[12px] text-[#444746] bg-[#f8fafd] p-1.5 rounded-lg border border-[#edf0f5]">
                              <span className="font-semibold text-[#1a73e8] shrink-0 text-[11px]">해석:</span>
                              <span className="leading-snug">{ctx.koreanTranslation}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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
                단어·표현 탭에서 마음에 드는 단어의 ⭐ 버튼을 누르거나, 상단의 '직접 추가'를 통해 나만의 표현을 등록해보세요.
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
                  <h4 className="text-[17px] font-bold text-[#1f1f1f] leading-snug">
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
