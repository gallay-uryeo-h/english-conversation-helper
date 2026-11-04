import React, { useState, useRef, useEffect } from 'react';
import { Thread, Message, RecommendationCard, MessageTranslation } from '../types';
import { aiService } from '../services/aiService';

interface ChatViewProps {
  activeThread: Thread;
  messages: Message[];
  onSendMessage: (text: string, koreanDraft?: string, recommendations?: RecommendationCard[]) => void;
  onSelectMessageForAnalysis: (message: Message) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  activeThread,
  messages,
  onSendMessage,
  onSelectMessageForAnalysis
}) => {
  const [inputText, setInputText] = useState('');
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // 말풍선 한국어 해석 아코디언 펼침 여부 상태 (0ms 즉시 토글)
  const [expandedMsgIds, setExpandedMsgIds] = useState<Record<string, boolean>>({});
  // 레거시 메시지 등 translation이 누락된 경우에만 보조 캐시
  const [fallbackTranslations, setFallbackTranslations] = useState<Record<string, MessageTranslation>>({});

  // AI 빠른 답장 칩 상태
  const [smartReplies, setSmartReplies] = useState<string[]>([
    "Sounds great, what time works?",
    "I'd love to! Tell me more.",
    "Actually, I'm a bit tied up right now."
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);
  const latestInputRef = useRef<string>('');

  // 스크롤 맨 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, recommendations, expandedMsgIds]);

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

  // 한글 입력 디바운스 (400ms 시차를 두어 API 과도 호출 및 Rate Limit 방지)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    latestInputRef.current = val;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(val);
    if (!hasKorean || val.trim().length < 2) {
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

  // 텍스트 직접 전송 (0ms 즉시 전송)
  const handleSend = (textToSend?: string, koreanDraft?: string) => {
    const finalMsg = textToSend || inputText;
    if (!finalMsg.trim()) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    onSendMessage(
      finalMsg.trim(), 
      koreanDraft || (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(inputText) ? inputText : undefined), 
      recommendations
    );
    setInputText('');
    setRecommendations([]);
    setIsDebouncing(false);
  };

  // 추천 카드 클릭 시 해당 영문으로 즉시 전송
  const handleSelectRecommendation = (rec: RecommendationCard) => {
    handleSend(rec.english, inputText);
  };

  // 말풍선 한국어 해석('한') 토글: 이미 사전 일괄 생성되어 있어 0ms 즉시 펼침/닫힘
  const handleToggleTranslation = async (msgId: string, englishText: string, currentTranslation?: MessageTranslation) => {
    // 1. 이미 열려 있으면 닫기
    if (expandedMsgIds[msgId]) {
      setExpandedMsgIds(prev => ({ ...prev, [msgId]: false }));
      return;
    }

    // 2. 사전 생성된 데이터로 즉시 열기 (0ms 딜레이)
    setExpandedMsgIds(prev => ({ ...prev, [msgId]: true }));

    // 3. 레거시 메시지 등 translation이 누락된 경우에만 백그라운드 보조 로드
    if (!currentTranslation && !fallbackTranslations[msgId]) {
      try {
        const data = await aiService.translateMessageAsync(englishText);
        setFallbackTranslations(prev => ({ ...prev, [msgId]: data }));
      } catch (e) {
        console.warn("Fallback translation error:", e);
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full relative">
      {/* 1. 메시지 리스트 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isExpanded = Boolean(expandedMsgIds[msg.id]);
          const translationData = msg.translation || fallbackTranslations[msg.id];

          return (
            <div
              key={msg.id}
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
                  <p className="whitespace-pre-wrap select-text">{msg.text}</p>

                  {/* 한글 원문 초안이 있는 경우 표시 */}
                  {msg.koreanDraft && (
                    <div className="mt-1.5 pt-1.5 border-t border-white/20 text-[11px] opacity-90">
                      <span className="font-semibold mr-1">한글 초안:</span>
                      {msg.koreanDraft}
                    </div>
                  )}

                  {/* 말풍선 하단: 심플한 '한' 한국어 토글 아이콘 버튼 */}
                  <div className={`mt-2 pt-1.5 border-t flex items-center justify-between gap-2 ${
                    isUser ? 'border-white/20' : 'border-[#f1f3f4]'
                  }`}>
                    <button
                      type="button"
                      onClick={() => handleToggleTranslation(msg.id, msg.text, msg.translation)}
                      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold transition-all active:scale-95 ${
                        isUser 
                          ? 'bg-white/20 text-white hover:bg-white/30 border border-white/25' 
                          : 'bg-[#f0f4f9] text-[#1a73e8] hover:bg-[#e2edff] border border-[#d2e3fc]'
                      }`}
                      title={isExpanded ? '한국어 해석 접기' : '한국어 해석 보기'}
                    >
                      <span className="font-bold text-[11px] tracking-tight">한</span>
                      <span className="material-symbols-outlined text-[13px] leading-none">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>

                    {isUser && msg.analysis && (
                      <button
                        onClick={() => onSelectMessageForAnalysis(msg)}
                        className="inline-flex items-center gap-0.5 text-[11px] text-white font-medium hover:underline opacity-90"
                      >
                        <span className="material-symbols-outlined text-[13px]">insights</span>
                        피드백 ({msg.analysis.grammarScore}점)
                      </button>
                    )}
                  </div>

                  {/* 미니멀 한국어 해석 & 핵심표현 아코디언 본체 (이미 생성되어 있어 0ms 즉시 표시) */}
                  {isExpanded && (
                    <div className={`mt-2 p-2.5 rounded-xl text-left space-y-1.5 text-[12px] animate-in fade-in-50 duration-150 ${
                      isUser 
                        ? 'bg-white/15 text-white border border-white/20' 
                        : 'bg-[#f8fafd] text-[#1f1f1f] border border-[#dadce0]'
                    }`}>
                      {/* 한국어 번역 */}
                      <div>
                        <p className="leading-snug font-medium">
                          {translationData?.translation || '한국어 해석을 준비하고 있습니다...'}
                        </p>
                      </div>

                      {/* 핵심 표현 및 숙어 */}
                      {translationData?.keyExpressions && translationData.keyExpressions.length > 0 && (
                        <div className={`pt-1.5 border-t ${isUser ? 'border-white/15' : 'border-[#e0e3e7]'}`}>
                          <div className="space-y-1">
                            {translationData.keyExpressions.map((exp, i) => (
                              <div key={i} className="flex items-start gap-1 text-[11px]">
                                <span className={`font-semibold shrink-0 px-1.5 py-0.2 rounded border ${
                                  isUser 
                                    ? 'bg-white/20 text-white border-white/30' 
                                    : 'bg-[#e8f0fe] text-[#1a73e8] border-[#c2e7ff]'
                                }`}>
                                  {exp.phrase}
                                </span>
                                <span className={isUser ? 'text-white/90' : 'text-[#444746]'}>
                                  : {exp.meaning}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 2. AI 스마트 빠른 답장 칩 목록 */}
      <div className="px-3 py-1.5 bg-[#f8fafd] border-t border-[#e0e3e7] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-semibold text-[#5f6368] shrink-0 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px] text-[#1a73e8]">bolt</span>
          빠른 답장:
        </span>
        {smartReplies.map((reply, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(reply)}
            className="px-3 py-1 rounded-full bg-white border border-[#c2e7ff] text-[#005bbf] text-[12px] font-medium whitespace-nowrap hover:bg-[#e8f0fe] active:scale-95 transition-all shadow-xs shrink-0"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* 3. 디바운스 로딩 인디케이터 */}
      {isDebouncing && (
        <div className="mx-3 mb-1 px-3 py-1 bg-[#e8f0fe] text-[#1a73e8] text-[11px] rounded-lg flex items-center gap-1.5 animate-pulse">
          <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
          <span>Gemini 3.5 영작 추천 생성 중...</span>
        </div>
      )}

      {/* 4. 실시간 한글 입력 영작 추천 카드 (심플 & 미니멀) */}
      {recommendations.length > 0 && (
        <div className="mx-3 mb-2 p-1.5 bg-white border border-[#dadce0] rounded-2xl shadow-md space-y-1 animate-in slide-in-from-bottom-2 duration-150">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
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

      {/* 5. 하단 입력 바 */}
      <div className="p-3 bg-[#f0f4f9] border-t border-[#e0e3e7] flex items-center gap-2">
        <button
          onClick={() => setIsRecording(!isRecording)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
            isRecording 
              ? 'bg-[#d93025] text-white animate-pulse' 
              : 'bg-white text-[#444746] hover:bg-black/5 border border-[#dadce0]'
          }`}
          title="음성 입력"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isRecording ? 'mic' : 'mic_none'}
          </span>
        </button>

        <input
          type="text"
          placeholder="한글 초안이나 영어 메시지를 입력하세요..."
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSend();
            }
          }}
          className="flex-1 px-4 py-2.5 bg-white border border-[#dadce0] rounded-full text-[14px] outline-none focus:border-[#1a73e8] placeholder-[#747775]"
        />

        <button
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
