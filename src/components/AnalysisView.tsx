import React, { useState } from 'react';
import { Message, SavedExpression } from '../types';

interface AnalysisViewProps {
  selectedMessage: Message | null;
  onSaveToArchive?: (exp: SavedExpression) => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  selectedMessage,
  onSaveToArchive
}) => {
  const [savedSuccess, setSavedSuccess] = useState(false);

  // 분석 데이터가 없는 경우 기본 안내
  if (!selectedMessage || !selectedMessage.analysis) {
    return (
      <div className="p-6 text-center text-[#5f6368] max-w-md mx-auto pt-16">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
          <span className="material-symbols-outlined text-[32px]">insights</span>
        </div>
        <h3 className="text-[16px] font-bold text-[#1f1f1f] mb-1">
          분석할 대화를 선택해 주세요
        </h3>
        <p className="text-[13px] text-[#5f6368] leading-relaxed">
          실시간 채팅 탭에서 내가 보낸 메시지 아래의 <br />
          <strong className="text-[#00897b] font-medium">"심화 피드백 보기"</strong>를 탭하면 문법, 뉘앙스, 추천 어휘 분석이 표시됩니다.
        </p>
      </div>
    );
  }

  const { analysis } = selectedMessage;

  const handleSaveExpression = (word: string, meaning: string) => {
    if (!onSaveToArchive) return;
    onSaveToArchive({
      id: `exp-${Date.now()}`,
      english: word,
      korean: meaning,
      exampleSentence: analysis.improvedVersion,
      tag: 'Inspector Saved',
      createdAt: Date.now()
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-24">
      {/* 알림 메시지 */}
      {savedSuccess && (
        <div className="p-3 bg-[#e6f4ea] text-[#137333] text-[13px] font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          표현 보관함에 성공적으로 저장되었습니다!
        </div>
      )}

      {/* 발화 원문 카드 */}
      <div className="p-4 bg-white border border-[#e0e3e7] rounded-2xl shadow-xs">
        <span className="text-[11px] font-bold text-[#5f6368] uppercase tracking-wider block mb-1">
          Analyzed User Speech (원문)
        </span>
        <p className="text-[15px] font-semibold text-[#1f1f1f] mb-1">
          "{selectedMessage.text}"
        </p>
        {selectedMessage.koreanDraft && (
          <p className="text-[12px] text-[#5f6368]">
            한글 초안: {selectedMessage.koreanDraft}
          </p>
        )}
      </div>

      {/* 점수 대시보드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 bg-gradient-to-br from-[#e8f0fe] to-white border border-[#c2e7ff] rounded-2xl">
          <span className="text-[11px] font-medium text-[#1a73e8] block mb-0.5">문법 정확도</span>
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold text-[#001d35] font-mono">{analysis.grammarScore}</span>
            <span className="text-[13px] text-[#5f6368]">/ 100</span>
          </div>
          <div className="w-full bg-[#c2e7ff] h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div className="bg-[#1a73e8] h-full rounded-full" style={{ width: `${analysis.grammarScore}%` }}></div>
          </div>
        </div>

        <div className="p-3.5 bg-gradient-to-br from-[#e6f4ea] to-white border border-[#ceead6] rounded-2xl">
          <span className="text-[11px] font-medium text-[#137333] block mb-0.5">유창성 지수</span>
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold text-[#0d652d] font-mono">{analysis.fluencyScore}</span>
            <span className="text-[13px] text-[#5f6368]">/ 100</span>
          </div>
          <div className="w-full bg-[#ceead6] h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div className="bg-[#188038] h-full rounded-full" style={{ width: `${analysis.fluencyScore}%` }}></div>
          </div>
        </div>
      </div>

      {/* 원어민 교정 추천 */}
      <div className="p-4 bg-white border border-[#e0e3e7] rounded-2xl shadow-xs">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="material-symbols-outlined text-[#1a73e8] text-[20px]">auto_fix_high</span>
          <h4 className="text-[14px] font-bold text-[#1f1f1f]">원어민식 더 자연스러운 제안</h4>
        </div>
        <p className="text-[14px] font-semibold text-[#1a73e8] bg-[#f8fafd] p-3 rounded-xl border border-[#c2e7ff] mb-2 leading-relaxed">
          {analysis.improvedVersion}
        </p>
        <p className="text-[12px] text-[#444746] leading-relaxed">
          {analysis.explanation}
        </p>
      </div>

      {/* 핵심 어휘 및 관용구 */}
      <div className="p-4 bg-white border border-[#e0e3e7] rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[14px] font-bold text-[#1f1f1f] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#795900] text-[20px]">local_library</span>
            핵심 어휘 & 관용구
          </h4>
          <span className="text-[11px] text-[#5f6368]">탭하여 보관함 저장</span>
        </div>

        <div className="space-y-2">
          {analysis.keyVocabulary.map((item, idx) => (
            <div
              key={idx}
              className="p-3 bg-[#faf8ff] rounded-xl border border-[#eaedff] flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[#1f1f1f]">{item.word}</span>
                  {item.phonetic && (
                    <span className="text-[11px] font-mono text-[#5f6368]">{item.phonetic}</span>
                  )}
                </div>
                <span className="text-[12px] text-[#444746]">{item.meaning}</span>
              </div>

              <button
                onClick={() => handleSaveExpression(item.word, item.meaning)}
                className="w-8 h-8 rounded-full bg-white border border-[#e0e3e7] text-[#1a73e8] flex items-center justify-center hover:bg-[#e8f0fe] active:scale-95 transition-all shadow-xs"
                title="보관함에 저장"
              >
                <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

