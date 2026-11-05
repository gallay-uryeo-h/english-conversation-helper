import React, { useState, useRef, useEffect } from 'react';
import { Thread, Message, RecommendationCard, MessageTranslation } from '../types';
import { aiService, SmartReplyItem, DEFAULT_SMART_REPLIES } from '../services/aiService';

interface ChatViewProps {
  activeThread: Thread;
  messages: Message[];
  onSendMessage: (text: string, koreanDraft?: string, recommendations?: RecommendationCard[], precomputedTranslation?: MessageTranslation) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  activeThread,
  messages,
  onSendMessage
}) => {
  const [inputText, setInputText] = useState('');
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [isDebouncing, setIsDebouncing] = useState(false);

  // 말풍선 한국어 해석 아코디언 펼침 여부 상태 (0ms 즉시 토글)
  const [expandedMsgIds, setExpandedMsgIds] = useState<Record<string, boolean>>({});
  // 레거시 메시지 등 translation이 누락된 경우에만 보조 캐시
  const [fallbackTranslations, setFallbackTranslations] = useState<Record<string, MessageTranslation>>({});

  // AI 빠른 답장 칩 상태 (사전 로드된 번역 포함)
  const [smartReplies, setSmartReplies] = useState<SmartReplyItem[]>(DEFAULT_SMART_REPLIES);

  // Web Speech API 현재 재생 중인 메시지 ID
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  // 아코디언 열기 전의 스크롤 위치를 메시지별로 저장 (닫을 때 원래 위치 복귀용)
  const prevScrollTopsRef = useRef<Record<string, number>>({});

  // 컴포넌트 언마운트 시 재생 중이던 음성 취소
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);
  const latestInputRef = useRef<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isInputFocusedRef = useRef<boolean>(false);

  // 버튼/아코디언/칩 조작 시 하단 입력창 포커스 및 모바일 키패드가 내려가지 않도록 유지
  const handlePreventBlur = (e: React.MouseEvent | React.PointerEvent) => {
    if (isInputFocusedRef.current || document.activeElement === inputRef.current) {
      e.preventDefault();
      setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 0);
    }
  };

  // 스마트 스크롤 제어:
  // - 대화가 적을 때는 상단 버블이 위로 사라지지 않고 빈 공간(empty space)만 축소
  // - 대화가 컨테이너 높이를 넘칠 때만 마지막 버블이 입력창 바로 위에 붙도록 스크롤
  const scrollToBottom = (smooth = true) => {
    if (!scrollContainerRef.current) return;
    const { scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollHeight > clientHeight) {
      scrollContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    } else {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  // 신규 메시지 수신 및 추천 카드 변경 시 스크롤 동기화
  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, recommendations.length]);

  // 모바일 가상 키보드(visualViewport) 대응: 윈도우 스크롤 억제 및 채팅창 높이 맞춤
  useEffect(() => {
    const handleViewportChange = () => {
      window.scrollTo(0, 0);
      scrollToBottom(false);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
    };
  }, []);

  // 입력창 포커스 시 브라우저의 기본 페이지 스크롤 억제 및 대화 영역 보정
  const handleInputFocus = () => {
    setTimeout(() => {
      window.scrollTo(0, 0);
      scrollToBottom(true);
    }, 120);
  };

  // 대화 맥락이 바뀔 때 AI 스마트 답장 생성
  useEffect(() => {
    let isCancelled = false;
    const fetchSmartReplies = async () => {
      if (messages.length === 0) return;
      try {
        const replies = await aiService.generateSmartRepliesAsync(messages, activeThread.partnerName);
        if (!isCancelled && replies && replies.length > 0) {
          setSmartReplies(replies);
        }
      } catch (e) {
        console.warn("Smart replies fetch error:", e);
      }
    };

    fetchSmartReplies();
    return () => { isCancelled = true; };
  }, [messages.length, activeThread.partnerName]);

  // 한글 또는 영어 입력 디바운스 (400ms 시차를 두어 API 과도 호출 및 Rate Limit 방지)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    latestInputRef.current = val;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = val.trim();
    if (trimmed.length < 2) {
      setRecommendations([]);
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);

    debounceTimerRef.current = setTimeout(async () => {
      const currentVal = latestInputRef.current.trim();
      if (!currentVal) {
        setRecommendations([]);
        setIsDebouncing(false);
        return;
      }

      try {
        const aiRecs = await aiService.generateRecommendationsAsync(currentVal);
        if (latestInputRef.current.trim() === currentVal) {
          setRecommendations(aiRecs || []);
        }
      } catch (err) {
        console.warn("Debounced recommendation error:", err);
      } finally {
        setIsDebouncing(false);
      }
    }, 400);
  };

  // 텍스트 직접 전송 (추천 카드 선택 또는 엔터 시 스마트 자동 영작 정제)
  const handleSend = async (textToSend?: string, koreanDraft?: string, precomputedTranslation?: MessageTranslation) => {
    let candidateText = textToSend;
    let candidateDraft = koreanDraft;

    // 텍스트박스에서 엔터/전송 버튼을 누른 경우 (textToSend 미지정)
    if (!candidateText && inputText.trim()) {
      const rawInput = inputText.trim();
      if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(rawInput)) {
        candidateDraft = rawInput;
      }

      // 1. 이미 추천 카드가 나와 있는 경우 -> 'Natural' 카드(없으면 첫 번째 카드) 영문으로 자동 채택
      if (recommendations.length > 0) {
        const naturalCard = recommendations.find(r => r.tone === 'Natural') || recommendations[0];
        candidateText = naturalCard.english;
      } 
      // 2. 아직 추천 카드가 뜨기 전(초고속 엔터)인 경우 -> 즉시 1회 추천 생성하여 정제
      else {
        try {
          setIsDebouncing(true);
          const recs = await aiService.generateRecommendationsAsync(rawInput);
          if (recs && recs.length > 0) {
            const naturalCard = recs.find(r => r.tone === 'Natural') || recs[0];
            candidateText = naturalCard.english;
          }
        } catch (err) {
          console.warn("Instant recommendation error on send:", err);
        } finally {
          setIsDebouncing(false);
        }
      }

      // 3. 만약 추천 생성 실패 시 fallback
      if (!candidateText) {
        candidateText = rawInput;
      }
    }

    const finalMsg = candidateText || inputText;
    if (!finalMsg.trim()) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    onSendMessage(
      finalMsg.trim(), 
      candidateDraft || (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(inputText) ? inputText : undefined), 
      recommendations,
      precomputedTranslation
    );
    setInputText('');
    setRecommendations([]);
    setIsDebouncing(false);
  };

  // 추천 카드 클릭 시 해당 영문으로 즉시 전송
  const handleSelectRecommendation = (rec: RecommendationCard) => {
    handleSend(rec.english, inputText);
  };

  // 말풍선 한국어 해석('한') 토글:
  // - 말풍선과 하단 사이 공간(여백)이 있으면 공간을 채우며 자연스럽게 전개
  // - 하단 빠른답장/입력창 뒤로 겹쳐 들어가지 않도록 부드럽게 스크롤을 추적
  // - 닫을 때도 열기 전 원래 스크롤 위치로 매끄럽게 복귀
  const handleToggleTranslation = async (msgId: string, englishText: string, currentTranslation?: MessageTranslation) => {
    const isCurrentlyExpanded = Boolean(expandedMsgIds[msgId]);

    // 1. 이미 열려 있는 경우 -> 닫기 및 열기 전 원래 스크롤 위치로 복귀
    if (isCurrentlyExpanded) {
      setExpandedMsgIds(prev => ({ ...prev, [msgId]: false }));

      const savedTop = prevScrollTopsRef.current[msgId];
      if (savedTop !== undefined && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: savedTop,
          behavior: 'smooth'
        });
        // 닫힘 애니메이션(200ms) 완료 시점에 최종 미세 보정
        setTimeout(() => {
          if (scrollContainerRef.current && scrollContainerRef.current.scrollTop > savedTop) {
            scrollContainerRef.current.scrollTo({
              top: savedTop,
              behavior: 'smooth'
            });
          }
        }, 220);
        delete prevScrollTopsRef.current[msgId];
      }
      return;
    }

    // 2. 열기: 현재 스크롤 위치 보존 후 아코디언 전개
    if (scrollContainerRef.current) {
      prevScrollTopsRef.current[msgId] = scrollContainerRef.current.scrollTop;
    }
    setExpandedMsgIds(prev => ({ ...prev, [msgId]: true }));

    // 3. 200ms 애니메이션 진행 중 실시간으로 하단 빠른답장 바와의 충돌 감지 및 스마트 스크롤
    // 말풍선 아래 빈 공간이 있으면 그대로 공간을 채우고,
    // 하단 빠른답장 바 뒤로 파묻히려는 오버플로우가 발생할 때만 딱 그만큼 스크롤을 부드럽게 밀어올림
    const startTime = performance.now();
    const duration = 250;

    const followScroll = () => {
      const container = scrollContainerRef.current;
      const msgEl = document.getElementById(`chat-msg-${msgId}`);
      if (container && msgEl) {
        const containerRect = container.getBoundingClientRect();
        const msgRect = msgEl.getBoundingClientRect();

        // 말풍선 하단이 컨테이너 하단 경계(빠른 답장 바 윗선)를 침범하는지 체크 (여유 패딩 8px)
        const overflow = (msgRect.bottom + 8) - containerRect.bottom;
        if (overflow > 0) {
          container.scrollTop += overflow;
        }
      }

      if (performance.now() - startTime < duration) {
        requestAnimationFrame(followScroll);
      }
    };

    requestAnimationFrame(followScroll);

    // 4. 레거시 메시지 등 translation이 누락된 경우에만 백그라운드 보조 로드
    if (!currentTranslation && !fallbackTranslations[msgId]) {
      try {
        const data = await aiService.translateMessageAsync(englishText);
        setFallbackTranslations(prev => ({ ...prev, [msgId]: data }));
      } catch (e) {
        console.warn("Fallback translation error:", e);
      }
    }
  };

  // Web Speech API를 활용한 영어 문장 음성 듣기 (TTS)
  const handlePlaySpeech = (msgId: string, englishText: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('현재 브라우저에서는 Web Speech API를 지원하지 않습니다.');
      return;
    }

    // 1. 이미 동일 문장이 재생 중인 경우 중단 (토글 제어)
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    // 2. 이전 음성 취소 후 새로 발화
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(englishText);
    utterance.lang = 'en-US';
    utterance.rate = 0.95; // 학습자에게 가장 적합한 명료한 발음 속도
    utterance.pitch = 1.0;

    // 브라우저에 설치된 자연스러운 영어 음성 우선 탐색
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.lang.startsWith('en') && (
      v.name.includes('Google') || 
      v.name.includes('Natural') || 
      v.name.includes('Samantha') || 
      v.name.includes('Daniel')
    )) || voices.find(v => v.lang.startsWith('en'));

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => setSpeakingMsgId(msgId);
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col h-full flex-1 min-h-0 w-full relative overflow-hidden">
      {/* 1. 메시지 리스트 영역 (스마트 스크롤 & 키보드 빈공간 축소) */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3.5 overscroll-contain flex flex-col"
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#747775] my-auto">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-3 shadow-xs ring-1 ring-black/5"
              style={{ backgroundColor: activeThread.avatarBg, color: '#1f1f1f' }}
            >
              {activeThread.avatarText}
            </div>
            <p className="font-bold text-[16px] text-[#1f1f1f] mb-1">{activeThread.partnerName}</p>
            <p className="text-[13px] text-[#5f6368] leading-relaxed max-w-xs">
              한글로 생각하신 문장이나 영어로 편하게 첫 대화를 시작해보세요!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isExpanded = Boolean(expandedMsgIds[msg.id]);
          const translationData = msg.translation || fallbackTranslations[msg.id];

          return (
            <div
              key={msg.id}
              id={`chat-msg-${msg.id}`}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-start gap-2 max-w-[88%]">
                {!isUser && (
                  <div
                    className="w-8 h-8 rounded-full text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-xs"
                    style={{ backgroundColor: activeThread.avatarBg, color: '#1f1f1f' }}
                  >
                    {activeThread.avatarText}
                  </div>
                )}

                <div
                  className={`relative px-4 py-2.5 rounded-2xl shadow-xs text-[14px] leading-relaxed transition-all ${
                    isUser
                      ? 'bg-[#1a73e8] text-white rounded-tr-xs'
                      : 'bg-white text-[#1f1f1f] border border-[#e0e3e7] rounded-tl-xs'
                  }`}
                >
                  {/* 문장 텍스트 및 문장 끝 미니멀 음성 듣기(TTS) & '한' 인라인 토글 버튼 (배경색 없음) */}
                  <p className="whitespace-pre-wrap select-text leading-relaxed">
                    <span>{msg.text}</span>

                    {/* Speech API 원어민 발음 듣기 버튼 */}
                    <button
                      type="button"
                      onMouseDown={handlePreventBlur}
                      onPointerDown={handlePreventBlur}
                      onClick={() => handlePlaySpeech(msg.id, msg.text)}
                      className={`inline-flex items-center justify-center align-middle ml-1.5 p-0.5 transition-all duration-150 active:scale-90 cursor-pointer select-none ${
                        speakingMsgId === msg.id 
                          ? (isUser ? 'text-white animate-pulse' : 'text-[#1a73e8] animate-pulse')
                          : (isUser ? 'text-white/70 hover:text-white' : 'text-[#747775] hover:text-[#1a73e8]')
                      }`}
                      title={speakingMsgId === msg.id ? "음성 재생 중지" : "원어민 발음 듣기"}
                    >
                      <span className="material-symbols-outlined text-[16px] leading-none">
                        {speakingMsgId === msg.id ? 'graphic_eq' : 'volume_up'}
                      </span>
                    </button>

                    {/* 한국어 해석 아코디언 토글 버튼 */}
                    <button
                      type="button"
                      onMouseDown={handlePreventBlur}
                      onPointerDown={handlePreventBlur}
                      onClick={() => handleToggleTranslation(msg.id, msg.text, msg.translation)}
                      className={`inline-flex items-center justify-center align-middle ml-1 p-0.5 transition-all duration-150 active:scale-95 cursor-pointer select-none gap-0.5 ${
                        isUser 
                          ? (isExpanded ? 'text-white font-bold' : 'text-white/70 hover:text-white')
                          : (isExpanded ? 'text-[#1a73e8] font-bold' : 'text-[#747775] hover:text-[#1a73e8]')
                      }`}
                      title={isExpanded ? '한국어 해석 접기' : '한국어 해석 보기'}
                    >
                      <span className="text-[11px] font-bold tracking-tight leading-none">한</span>
                      <span className={`material-symbols-outlined text-[13px] leading-none transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : 'rotate-0'
                      }`}>
                        expand_more
                      </span>
                    </button>
                  </p>

                  {/* 미니멀 한국어 해석 & 핵심 표현 아코디언 본체 (사용자/AI 동일한 정갈한 서식) */}
                  <div className={`grid transition-all duration-200 ease-in-out ${
                    isExpanded 
                      ? 'grid-rows-[1fr] opacity-100 mt-2' 
                      : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
                  }`}>
                    <div className="overflow-hidden">
                      <div className={`pt-2 border-t text-left space-y-1.5 text-[12px] ${
                        isUser ? 'border-white/20 text-white/95' : 'border-[#e0e3e7] text-[#1f1f1f]'
                      }`}>
                        {/* 정식 한국어 해석 */}
                        <p className="leading-snug">
                          {translationData?.translation || '한국어 해석을 준비하고 있습니다...'}
                        </p>

                        {/* 핵심 어휘 및 관용구 */}
                        {translationData?.keyExpressions && translationData.keyExpressions.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {translationData.keyExpressions.map((exp, i) => (
                              <span
                                key={i}
                                onMouseDown={handlePreventBlur}
                                onPointerDown={handlePreventBlur}
                                onClick={() => handlePlaySpeech(`ke-${i}-${msg.id}`, exp.phrase)}
                                className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer inline-flex items-center gap-1 active:scale-95 transition-all ${
                                  isUser 
                                    ? 'bg-white/15 text-white hover:bg-white/25' 
                                    : 'bg-[#f0f4f9] text-[#1a73e8] hover:bg-[#e2edff]'
                                }`}
                                title="핵심 표현 발음 듣기"
                              >
                                <strong className="font-semibold">{exp.phrase}</strong>: {exp.meaning}
                                <span className="material-symbols-outlined text-[11px] opacity-70">
                                  {speakingMsgId === `ke-${i}-${msg.id}` ? 'volume_up' : 'volume_down'}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }))}
      </div>

      {/* 2. AI 스마트 빠른 답장 칩 목록 (사전 번역 탑재, 대화가 있을 때만 표시) */}
      {messages.length > 0 && smartReplies.length > 0 && (
        <div className="px-3 py-1.5 bg-[#f8fafd] border-t border-[#e0e3e7] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[11px] font-semibold text-[#5f6368] shrink-0 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-[#1a73e8]">bolt</span>
            빠른 답장:
          </span>
          {smartReplies.map((item, idx) => (
            <button
              key={idx}
              onMouseDown={handlePreventBlur}
              onPointerDown={handlePreventBlur}
              onClick={() => handleSend(item.reply, undefined, item.translation)}
              className="px-3 py-1 rounded-full bg-white border border-[#c2e7ff] text-[#005bbf] text-[12px] font-medium whitespace-nowrap hover:bg-[#e8f0fe] active:scale-95 transition-all shadow-xs shrink-0"
            >
              {item.reply}
            </button>
          ))}
        </div>
      )}

      {/* 3. 디바운스 로딩 인디케이터 */}
      {isDebouncing && (
        <div className="mx-3 mb-1 px-3 py-1 bg-[#e8f0fe] text-[#1a73e8] text-[11px] rounded-lg flex items-center gap-1.5 animate-pulse shrink-0">
          <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
          <span>Gemini 3.5 표현 추천 중...</span>
        </div>
      )}

      {/* 4. 실시간 표현 추천 카드 (심플 & 미니멀) */}
      {recommendations.length > 0 && (
        <div className="mx-3 mb-2 p-1.5 bg-white border border-[#dadce0] rounded-2xl shadow-md space-y-1 animate-in slide-in-from-bottom-2 duration-150 shrink-0">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              onMouseDown={handlePreventBlur}
              onPointerDown={handlePreventBlur}
              onClick={() => handleSelectRecommendation(rec)}
              className="px-3 py-2 bg-[#f8fafd] hover:bg-[#eef4ff] active:bg-[#e2edff] rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-2.5 text-left group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  rec.tone === 'Polite' ? 'bg-[#e8f0fe] text-[#1a73e8]' :
                  rec.tone === 'Natural' ? 'bg-[#e6f4ea] text-[#137333]' :
                  'bg-[#feefe3] text-[#b06000]'
                }`}>
                  {rec.tone}
                </span>
                <p className="text-[13px] text-[#1f1f1f] font-medium leading-snug group-hover:text-[#1a73e8] transition-colors">
                  {rec.english}
                </p>
              </div>

              <span className="material-symbols-outlined text-[16px] text-[#9aa0a6] group-hover:text-[#1a73e8] shrink-0">
                arrow_upward
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 5. 하단 입력 바 (안전영역 대응 및 키보드 밀림 방지 - 시원하게 확장된 텍스트박스) */}
      <div className="p-3 bg-[#f0f4f9] border-t border-[#e0e3e7] flex items-center gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input
          ref={inputRef}
          type="text"
          placeholder="한글 초안이나 영어 메시지를 입력하세요..."
          value={inputText}
          onChange={handleInputChange}
          onFocus={() => {
            isInputFocusedRef.current = true;
            handleInputFocus();
          }}
          onBlur={() => {
            setTimeout(() => {
              if (document.activeElement !== inputRef.current) {
                isInputFocusedRef.current = false;
              }
            }, 100);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSend();
            }
          }}
          className="flex-1 px-4 py-2.5 bg-white border border-[#dadce0] rounded-full text-[14px] outline-none focus:border-[#1a73e8] placeholder-[#747775]"
        />

        <button
          onMouseDown={handlePreventBlur}
          onPointerDown={handlePreventBlur}
          onClick={() => handleSend()}
          disabled={!inputText.trim()}
          className="w-10 h-10 rounded-full bg-[#1a73e8] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#1557b0] active:scale-95 transition-all shadow-sm shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
      </div>
    </div>
  );
};
