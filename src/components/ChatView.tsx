import React, { useState, useRef, useEffect } from 'react';
import { Thread, Message, RecommendationCard } from '../types';
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
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 스크롤 맨 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, recommendations]);

  // 입력 내용 변경 시 한글 여부 감지 및 추천 생성 (즉시 로컬 + 비동기 Groq/AI 추천)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    // 한글이 포함되어 있는지 검사
    const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(val);
    if (hasKorean && val.trim().length >= 2) {
      // 1. 즉각적인 로컬 추천 (지연시간 0ms)
      const instantRecs = aiService.generateRecommendations(val);
      if (instantRecs.length > 0) {
        setRecommendations(instantRecs);
      }

      // 2. 비동기 AI 추천 (Groq Llama 3.3 / Gemini)
      aiService.generateRecommendationsAsync(val).then((aiRecs) => {
        if (aiRecs && aiRecs.length > 0) {
          setRecommendations(aiRecs);
        }
      });
    } else {
      setRecommendations([]);
    }
  };

  // 텍스트 직접 전송
  const handleSend = (textToSend?: string, koreanDraft?: string) => {
    const finalMsg = textToSend || inputText;
    if (!finalMsg.trim()) return;

    onSendMessage(finalMsg.trim(), koreanDraft || (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(inputText) ? inputText : undefined), recommendations);
    setInputText('');
    setRecommendations([]);
  };

  // 추천 카드 클릭 시 해당 영문으로 즉시 전송
  const handleSelectRecommendation = (rec: RecommendationCard) => {
    handleSend(rec.english, inputText);
  };

  // 스마트 답장 칩 (Smart Reply Chips)
  const smartReplies = [
    "I'd love to! What time works?",
    "Sounds great, let me know the details.",
    "Actually, I'm a bit tied up today."
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full relative">
      {/* 1. 메시지 리스트 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-end gap-1.5 max-w-[85%]">
                {!isUser && (
                  <div
                    className="w-7 h-7 rounded-full text-[12px] font-bold flex items-center justify-center shrink-0 mb-1"
                    style={{ backgroundColor: activeThread.avatarBg, color: '#1f1f1f' }}
                  >
                    {activeThread.avatarText}
                  </div>
                )}

                <div
                  className={`relative px-4 py-2.5 rounded-2xl shadow-sm text-[14px] leading-relaxed ${
                    isUser
                      ? 'bg-[#1a73e8] text-white rounded-br-xs'
                      : 'bg-white text-[#1f1f1f] border border-[#e0e3e7] rounded-bl-xs'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* 한글 원문 초안이 있는 경우 표시 */}
                  {msg.koreanDraft && (
                    <div className="mt-1.5 pt-1.5 border-t border-white/20 text-[11px] opacity-90">
                      <span className="font-medium mr-1">원문 초안:</span>
                      {msg.koreanDraft}
                    </div>
                  )}
                </div>
              </div>

              {/* 유저 메시지의 경우 심화 분석 인스펙터 버튼 제공 */}
              {isUser && msg.analysis && (
                <div className="flex items-center gap-1.5 mt-1 mr-1">
                  <span className="text-[10px] text-[#5f6368]">
                    문법 {msg.analysis.grammarScore}점
                  </span>
                  <button
                    onClick={() => onSelectMessageForAnalysis(msg)}
                    className="flex items-center gap-0.5 text-[11px] text-[#00897b] font-semibold hover:underline"
                  >
                    <span className="material-symbols-outlined text-[14px]">insights</span>
                    심화 피드백 보기
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. 스마트 답장 칩 목록 */}
      <div className="px-3 py-1.5 bg-[#faf8ff] border-t border-[#e0e3e7] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-medium text-[#5f6368] shrink-0">빠른 답장:</span>
        {smartReplies.map((reply, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(reply)}
            className="px-3 py-1 rounded-full bg-white border border-[#c2e7ff] text-[#005bbf] text-[12px] font-medium whitespace-nowrap hover:bg-[#e8f0fe] active:scale-95 transition-all shadow-xs"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* 4. 실시간 한글 입력 AI 영작 변환 추천 카드 (시안 2 핵심 UX) */}
      {recommendations.length > 0 && (
        <div className="mx-3 mb-2 p-2.5 bg-white border border-[#c2e7ff] rounded-2xl shadow-lg animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-[#e0e3e7]">
            <span className="text-[12px] font-bold text-[#1a73e8] flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">magic_button</span>
              실시간 AI 영작 추천
            </span>
            <span className="text-[11px] text-[#5f6368]">클릭 시 즉시 전송</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                onClick={() => handleSelectRecommendation(rec)}
                className="p-2.5 bg-[#f8fafd] hover:bg-[#eef4ff] active:bg-[#e2edff] border border-[#dadce0] rounded-xl cursor-pointer transition-all text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    rec.tone === 'Casual' ? 'bg-[#feefe3] text-[#b06000]' :
                    rec.tone === 'Natural' ? 'bg-[#e6f4ea] text-[#137333]' :
                    'bg-[#e8f0fe] text-[#1a73e8]'
                  }`}>
                    {rec.tone}
                  </span>
                  <span className="text-[11px] text-[#5f6368]">{rec.koreanMeaning}</span>
                </div>
                <p className="text-[13px] font-semibold text-[#1f1f1f]">{rec.english}</p>
                {rec.grammarTip && (
                  <p className="text-[11px] text-[#5f6368] mt-1 italic">
                    💡 {rec.grammarTip}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. 하단 입력 바 */}
      <div className="p-3 bg-[#f0f4f9] border-t border-[#e0e3e7] flex items-center gap-2">
        <button
          onClick={() => setIsRecording(!isRecording)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
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
