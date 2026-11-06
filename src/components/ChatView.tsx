import React, { useState, useRef, useEffect } from 'react';
import { Thread, Message, RecommendationCard, MessageTranslation } from '../types';
import { aiService, SmartReplyItem, DEFAULT_SMART_REPLIES } from '../services/aiService';
import { useAuth } from '../contexts/AuthContext';
import { storageService } from '../services/storageService';

// 로컬 스토리지 기반 스마트 빠른 답장 영구 캐시 (대화방 재입장 시 0ms 즉시 복원)
const getCachedSmartReplies = (threadId: string, lastMsgText: string): SmartReplyItem[] | null => {
  try {
    const raw = localStorage.getItem(`sr_${threadId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.lastMsgText === lastMsgText && Array.isArray(parsed.replies) && parsed.replies.length > 0) {
        return parsed.replies;
      }
    }
  } catch (e) {}
  return null;
};

const setCachedSmartReplies = (threadId: string, lastMsgText: string, replies: SmartReplyItem[]) => {
  try {
    localStorage.setItem(`sr_${threadId}`, JSON.stringify({ lastMsgText, replies, timestamp: Date.now() }));
  } catch (e) {}
};

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
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 상대방 타이핑 상태 및 상대방 마지막 읽은 시각 ('1' 마커 소멸용)
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [partnerLastReadTime, setPartnerLastReadTime] = useState<number>(0);
  const lastTypingPingRef = useRef<number>(0);

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

  // 컴포넌트 언마운트 시 재생 중이던 음성 취소 및 타이핑 상태 해제
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (activeThread.partnerEmail && activeThread.id.startsWith('dm_') && user?.email) {
        storageService.setTypingStatus(activeThread.id, user.email, false);
      }
    };
  }, [activeThread.id, activeThread.partnerEmail, user?.email]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);
  const latestInputRef = useRef<string>('');
  const recommendationSeqRef = useRef<number>(0);
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
  // - 컨테이너 크기 변화(빠른답장 바, 추천창, 키보드) 및 내용 높이 증가 시 완벽하게 바닥으로 보정
  const scrollToBottom = (smooth = true) => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;

    requestAnimationFrame(() => {
      const { scrollHeight, clientHeight } = el;
      if (scrollHeight > clientHeight) {
        el.scrollTo({
          top: scrollHeight - clientHeight + 40,
          behavior: smooth ? 'smooth' : 'auto'
        });
      } else {
        el.scrollTop = 0;
      }
      bottomAnchorRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    });
  };

  // 컨테이너 크기 변화 실시간 감지 (하단 빠른답장 바 등장, 키보드 오픈, 추천 카드 노출 등)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    let isFirst = true;
    const ro = new ResizeObserver(() => {
      if (isFirst) {
        isFirst = false;
        return;
      }
      scrollToBottom(false);
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

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

  // 1:1 DM 대화방 상대방 타이핑 상태 실시간 구독
  useEffect(() => {
    if (!activeThread.partnerEmail || !activeThread.id.startsWith('dm_')) {
      setIsPartnerTyping(false);
      return;
    }
    const unsub = storageService.subscribeToTypingStatus(
      activeThread.id,
      activeThread.partnerEmail,
      (typing) => {
        setIsPartnerTyping(typing);
        if (typing) scrollToBottom(true);
      }
    );
    return () => unsub();
  }, [activeThread.id, activeThread.partnerEmail]);

  // 1:1 DM 대화방 상대방 읽음 시각 구독 ('1' 마커 즉시 소멸 연동)
  useEffect(() => {
    if (!activeThread.partnerEmail || !activeThread.id.startsWith('dm_')) return;
    const unsub = storageService.subscribeToThreadReadStatus(
      activeThread.id,
      activeThread.partnerEmail,
      (ts) => setPartnerLastReadTime(ts)
    );
    return () => unsub();
  }, [activeThread.id, activeThread.partnerEmail]);

  // 대화방 입장 및 신규 메시지 수신 시 내 읽음 시각 최신화 (상대방 화면의 '1' 즉시 제거)
  useEffect(() => {
    if (activeThread.id.startsWith('dm_') && user?.email) {
      storageService.updateThreadReadTimestamp(activeThread.id, user.email);
    }
  }, [activeThread.id, messages.length, user?.email]);

  // 대화 시간 포맷 헬퍼 (카카오톡 스타일 오전/오후 HH:MM)
  const formatMessageTime = (timestamp?: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours < 12 ? '오전' : '오후';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${period} ${displayHours}:${displayMinutes}`;
  };

  // 입력창 포커스 시 브라우저의 기본 페이지 스크롤 억제 및 대화 영역 보정
  const handleInputFocus = () => {
    setTimeout(() => {
      window.scrollTo(0, 0);
      scrollToBottom(true);
    }, 120);
  };

  // 마지막 메시지 정보 추적 (내 턴 여부 및 빠른 답장 연동)
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  // 신규 메시지 수신, 비동기 번역/핵심어휘 도착, 빠른 답장/추천창/타이핑 상태 변화 시 스크롤 동기화
  useEffect(() => {
    scrollToBottom(true);
  }, [
    messages.length, 
    recommendations.length, 
    smartReplies.length, 
    isPartnerTyping, 
    lastMessage?.id,
    lastMessage?.translation?.translation,
    (lastMessage?.translation?.keyExpressions || []).length
  ]);

  // 대화 맥락이 바뀔 때 또는 대화방 재진입 시 상대방 마지막 말에 대한 빠른 답장 로드
  useEffect(() => {
    let isCancelled = false;
    if (!lastMessage || lastMessage.sender === 'user') {
      // 내가 말을 보낸 직후: 빠른 답장 즉시 클리어
      setSmartReplies([]);
      return;
    }

    // 1. 이전 발화의 잔여 답장이 찰나에 보이지 않도록 즉시 클리어
    setSmartReplies([]);

    // 2. 로컬 캐시에 기존 저장된 답장이 있는 경우 0ms 즉시 복원
    const cached = getCachedSmartReplies(activeThread.id, lastMessage.text);
    if (cached) {
      setSmartReplies(cached);
      return;
    }

    // 3. 비동기 생성 (맥락 기반 스마트 빠른 답장)
    const fetchSmartReplies = async () => {
      try {
        const replies = await aiService.generateSmartRepliesAsync(messages, activeThread.partnerName);
        if (!isCancelled && replies && replies.length > 0) {
          setSmartReplies(replies);
          setCachedSmartReplies(activeThread.id, lastMessage.text, replies);
        }
      } catch (e) {
        console.warn("Smart replies fetch error:", e);
      }
    };

    fetchSmartReplies();
    return () => { isCancelled = true; };
  }, [activeThread.id, lastMessage?.id, lastMessage?.text]);

  // 한글 또는 영어 입력 디바운스 (400ms 시차를 두어 API 과도 호출 및 Rate Limit 방지)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    latestInputRef.current = val;

    // 상대방에게 '... 입력 중' 상태 실시간 전달 (2초 단위 디바운스)
    if (activeThread.partnerEmail && activeThread.id.startsWith('dm_') && user?.email) {
      const now = Date.now();
      if (val.trim()) {
        if (now - lastTypingPingRef.current > 2000) {
          lastTypingPingRef.current = now;
          storageService.setTypingStatus(activeThread.id, user.email, true);
        }
      } else {
        storageService.setTypingStatus(activeThread.id, user.email, false);
      }
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = val.trim();
    if (trimmed.length < 2) {
      recommendationSeqRef.current++;
      setRecommendations([]);
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);
    const thisSeq = ++recommendationSeqRef.current;

    debounceTimerRef.current = setTimeout(async () => {
      const currentVal = latestInputRef.current.trim();
      if (!currentVal || recommendationSeqRef.current !== thisSeq) {
        if (recommendationSeqRef.current === thisSeq) {
          setRecommendations([]);
          setIsDebouncing(false);
        }
        return;
      }

      try {
        const aiRecs = await aiService.generateRecommendationsAsync(currentVal);
        // 최신 시퀀스이고 입력값도 여전히 일치할 때만 세팅 (전송 후 늦게 도착한 비동기 응답 덮어쓰기 완전 차단)
        if (recommendationSeqRef.current === thisSeq && latestInputRef.current.trim() === currentVal) {
          setRecommendations(aiRecs || []);
        }
      } catch (err) {
        console.warn("Debounced recommendation error:", err);
      } finally {
        if (recommendationSeqRef.current === thisSeq) {
          setIsDebouncing(false);
        }
      }
    }, 400);
  };

  // 텍스트 직접 전송 (추천 카드 선택 또는 엔터 시 스마트 자동 영작 정제 및 중복 전송 방지)
  const handleSend = async (textToSend?: string, koreanDraft?: string, precomputedTranslation?: MessageTranslation) => {
    if (isSending) return;

    // 1. 전송 시작 즉시 대기 중인 모든 비동기 추천 요청 무효화 및 팝업/타이머 즉시 클리어
    recommendationSeqRef.current++;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const rawInput = inputText.trim();
    latestInputRef.current = '';
    setRecommendations([]);
    setIsDebouncing(false);

    let candidateText = textToSend;
    let candidateDraft = koreanDraft;

    // 텍스트박스에서 엔터/전송 버튼을 누른 경우 (textToSend 미지정)
    if (!candidateText && rawInput) {
      setIsSending(true);
      const isKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(rawInput);
      if (isKorean) {
        candidateDraft = rawInput;
      }

      try {
        // [한글/영문 공통]: AI 추천 카드가 있으면 더 자연스러운 원어민 표현(Natural)으로 다듬어서 전송
        // A. 이미 추천 카드가 나와 있는 경우 -> 'Natural' 카드(없으면 첫 번째 카드) 영문으로 자동 채택
        if (recommendations.length > 0) {
          const naturalCard = recommendations.find(r => r.tone === 'Natural') || recommendations[0];
          candidateText = naturalCard.english;
        } 
        // B. 아직 추천 카드가 뜨기 전(초고속 엔터/전송)인 경우 -> 즉시 1회 추천 생성하여 정제
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

        // C. 만약 추천 생성 실패 시 fallback (사용자 입력 원문)
        if (!candidateText) {
          candidateText = rawInput;
        }
      } catch (err) {
        console.warn("Send handling error:", err);
        candidateText = rawInput;
      }
    }

    const finalMsg = candidateText || rawInput;
    if (!finalMsg.trim()) {
      setIsSending(false);
      return;
    }

    try {
      setIsSending(true);
      if (activeThread.partnerEmail && activeThread.id.startsWith('dm_') && user?.email) {
        storageService.setTypingStatus(activeThread.id, user.email, false);
      }

      // 한글 초안이 있고 precomputedTranslation이 없으면, 초안 한글을 0ms 즉시 초동 번역 객체로 제공
      const initialTranslation: MessageTranslation | undefined = precomputedTranslation || (candidateDraft ? {
        translation: candidateDraft,
        keyExpressions: []
      } : undefined);

      onSendMessage(
        finalMsg.trim(), 
        candidateDraft, 
        recommendations,
        initialTranslation
      );
      setInputText('');
      setRecommendations([]);
      setIsDebouncing(false);
      latestInputRef.current = '';

      // 전송 후 입력창 포커스 재유지
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } finally {
      // 아주 짧은 딜레이 후 전송 상태 해제 (중복 연타 방지)
      setTimeout(() => {
        setIsSending(false);
      }, 250);
    }
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
      {/* 1. 메시지 리스트 영역 (스마트 스크롤 & 대화 터치 시 자연스러운 키패드 닫힘) */}
      <div 
        ref={scrollContainerRef}
        onTouchStart={() => {
          if (document.activeElement === inputRef.current) {
            inputRef.current?.blur();
            isInputFocusedRef.current = false;
          }
        }}
        className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-6 space-y-3.5 overscroll-contain flex flex-col"
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
              <div className="flex items-end gap-1.5 max-w-[88%]">
                {/* 상대방 메시지 아바타 (좌측 상단 정렬) */}
                {!isUser && (
                  <div
                    className="w-8 h-8 rounded-full text-[12px] font-bold flex items-center justify-center shrink-0 self-start mt-0.5 shadow-xs"
                    style={{ backgroundColor: activeThread.avatarBg, color: '#1f1f1f' }}
                  >
                    {activeThread.avatarText}
                  </div>
                )}

                {/* 내 메시지일 때: 좌측 하단에 카카오톡 스타일 '1' (안 읽음) 및 전송 시간 */}
                {isUser && (
                  <div className="flex flex-col items-end justify-end shrink-0 select-none pb-0.5 text-right">
                    {/* 1:1 대화방이고 상대방이 아직 해당 메시지 시각 이후로 읽지 않은 경우 노란색 '1' */}
                    {activeThread.partnerEmail && (!partnerLastReadTime || partnerLastReadTime < msg.timestamp) && (
                      <span className="text-[11px] font-bold text-[#f29900] leading-none mb-1 mr-0.5" title="상대방 미확인">
                        1
                      </span>
                    )}
                    <span className="text-[10px] text-[#747775] leading-none font-normal">
                      {formatMessageTime(msg.timestamp)}
                    </span>
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

                    {/* Speech API 원어민 발음 듣기 버튼 (키패드 불필요한 재팝업 방지) */}
                    <button
                      type="button"
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

                    {/* 한국어 해석 아코디언 토글 버튼 (키패드 불필요한 재팝업 방지) */}
                    <button
                      type="button"
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

                        {/* 핵심 어휘 및 관용구 (1개 표현당 1줄 독립 미니 행 구조 - 라인브레이크 엉킴 방지) */}
                        {translationData?.keyExpressions && translationData.keyExpressions.length > 0 && (
                          <div className="space-y-1 pt-1">
                            {translationData.keyExpressions.map((exp, i) => (
                              <div
                                key={i}
                                onClick={() => handlePlaySpeech(`ke-${i}-${msg.id}`, exp.phrase)}
                                className={`px-2 py-1.5 rounded-lg cursor-pointer flex items-center justify-between gap-2 active:scale-98 transition-all ${
                                  isUser 
                                    ? 'bg-white/15 hover:bg-white/25 text-white' 
                                    : 'bg-[#f0f4f9] hover:bg-[#e2edff] text-[#1f1f1f]'
                                }`}
                                title="핵심 표현 발음 듣기"
                              >
                                <div className="flex items-baseline gap-1.5 min-w-0 flex-1 leading-snug">
                                  {/* 영어 표제어: 절대 줄바꿈되지 않고 굵게 고정 */}
                                  <span className={`text-[11px] font-bold shrink-0 ${
                                    isUser ? 'text-white' : 'text-[#1a73e8]'
                                  }`}>
                                    {exp.phrase}
                                  </span>
                                  <span className="opacity-40 text-[10px] shrink-0">·</span>
                                  {/* 한글 뜻: 단어 단위로 자연스럽게 줄바꿈 */}
                                  <span className="text-[11px] opacity-90 break-keep">
                                    {exp.meaning}
                                  </span>
                                </div>

                                {/* 우측 스피커 아이콘 */}
                                <span className={`material-symbols-outlined text-[13px] shrink-0 ${
                                  speakingMsgId === `ke-${i}-${msg.id}` ? 'animate-pulse' : 'opacity-70'
                                }`}>
                                  {speakingMsgId === `ke-${i}-${msg.id}` ? 'graphic_eq' : 'volume_up'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 상대방 메시지일 때: 우측 하단에 전송 시간 */}
                {!isUser && (
                  <div className="flex flex-col justify-end shrink-0 select-none pb-0.5">
                    <span className="text-[10px] text-[#747775] leading-none font-normal">
                      {formatMessageTime(msg.timestamp)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        }))}

        {/* 상대방 타이핑 중 실시간 인디케이터 말풍선 */}
        {isPartnerTyping && (
          <div className="flex items-center gap-2 max-w-[88%] animate-in fade-in duration-200">
            <div
              className="w-8 h-8 rounded-full text-[12px] font-bold flex items-center justify-center shrink-0 self-start mt-0.5 shadow-xs"
              style={{ backgroundColor: activeThread.avatarBg, color: '#1f1f1f' }}
            >
              {activeThread.avatarText}
            </div>
            <div className="bg-white text-[#5f6368] border border-[#e0e3e7] rounded-2xl rounded-tl-xs px-3.5 py-2 text-[12px] flex items-center gap-2 shadow-xs">
              <span className="font-medium text-[#1f1f1f]">{activeThread.partnerName}님이 입력 중</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#1a73e8] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-[#1a73e8] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-[#1a73e8] rounded-full animate-bounce"></span>
              </span>
            </div>
          </div>
        )}

        {/* 하단 스크롤 안전 앵커 및 쾌적한 여백 */}
        <div ref={bottomAnchorRef} className="h-3 shrink-0 select-none pointer-events-none" />
      </div>

      {/* 2. AI 스마트 빠른 답장 칩 목록 (내 턴일 때만 표시: 상대방 발화 직후 & 내가 입력 중이지 않을 때) */}
      {(() => {
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        const isMyTurn = Boolean(lastMessage && lastMessage.sender !== 'user');

        if (!isMyTurn || smartReplies.length === 0 || inputText.trim().length > 0) return null;

        return (
          <div className="px-3 py-1.5 bg-[#f8fafd] border-t border-[#e0e3e7] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 animate-in fade-in duration-200">
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
                className="px-3 py-1.5 rounded-full bg-white border border-[#c2e7ff] text-[#005bbf] text-[12px] font-medium whitespace-nowrap hover:bg-[#e8f0fe] active:scale-95 transition-all shadow-xs shrink-0 flex items-center gap-1.5 group"
              >
                <span className="font-semibold">{item.reply}</span>
                {item.translation?.translation && item.translation.translation !== item.reply && (
                  <span className="text-[10px] text-[#5f6368] group-hover:text-[#1a73e8] border-l border-[#d2e3fc] pl-1.5 max-w-[150px] truncate">
                    {item.translation.translation}
                  </span>
                )}
              </button>
            ))}
          </div>
        );
      })()}

      {/* 3. 디바운스 로딩 인디케이터 */}
      {isDebouncing && (
        <div className="mx-3 mb-1 px-3 py-1 bg-[#e8f0fe] text-[#1a73e8] text-[11px] rounded-lg flex items-center gap-1.5 animate-pulse shrink-0">
          <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
          <span>Gemini 3.5 표현 추천 중...</span>
        </div>
      )}

      {/* 4. 실시간 표현 추천 카드 (심플 & 미니멀) */}
      {recommendations.length > 0 && (
        <div className="mx-3 mb-2 p-2 bg-white border border-[#dadce0] rounded-2xl shadow-md space-y-1 animate-in slide-in-from-bottom-2 duration-150 shrink-0">
          <div className="flex items-center justify-between px-1.5 py-0.5 border-b border-[#f0f4f9] pb-1 mb-1">
            <span className="text-[11px] font-semibold text-[#5f6368] flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-[#1a73e8]">auto_awesome</span>
              AI 추천 표현 (선택 또는 Enter로 전송):
            </span>
            <button
              onMouseDown={handlePreventBlur}
              onPointerDown={handlePreventBlur}
              onClick={() => {
                recommendationSeqRef.current++;
                setRecommendations([]);
              }}
              className="text-[#747775] hover:text-[#1f1f1f] p-0.5 rounded-full hover:bg-[#f0f4f9] transition-colors flex items-center justify-center"
              title="추천 닫기 (ESC)"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
            </button>
          </div>
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

              <span className="material-symbols-outlined text-[16px] text-[#9aa0a6] group-hover:text-[#1a73e8] shrink-0" title="이 표현으로 전송">
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
          disabled={isSending}
          placeholder={isSending ? "자연스러운 영어로 정제하여 전송 중..." : "한국어 또는 영어로 입력하세요..."}
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
            if (e.key === 'Escape') {
              recommendationSeqRef.current++;
              setRecommendations([]);
              return;
            }
            if (e.key === 'Enter' && !isSending) {
              if (e.nativeEvent.isComposing) return;
              handleSend();
            }
          }}
          className={`flex-1 px-4 py-2.5 bg-white border border-[#dadce0] rounded-full text-[14px] outline-none focus:border-[#1a73e8] placeholder-[#747775] transition-all ${
            isSending ? 'opacity-70 bg-[#f8fafd] cursor-not-allowed' : ''
          }`}
        />

        <button
          onMouseDown={handlePreventBlur}
          onPointerDown={handlePreventBlur}
          onClick={() => handleSend()}
          disabled={!inputText.trim() || isSending}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 ${
            isSending 
              ? 'bg-[#1a73e8] text-white cursor-not-allowed opacity-85' 
              : 'bg-[#1a73e8] text-white disabled:opacity-40 hover:bg-[#1557b0] active:scale-95'
          }`}
          title={isSending ? "영작 정제 및 전송 중..." : "전송"}
        >
          {isSending ? (
            <span className="material-symbols-outlined text-[19px] animate-spin">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined text-[20px]">
              send
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
