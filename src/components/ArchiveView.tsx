import React, { useState } from 'react';
import { SavedExpression, SavedScript } from '../types';

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
  const [subTab, setSubTab] = useState<'expressions' | 'scripts'>('expressions');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEng, setNewEng] = useState('');
  const [newKor, setNewKor] = useState('');
  const [newEx, setNewEx] = useState('');
  const [newSit, setNewSit] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEng.trim() || !newKor.trim()) return;

    onAddExpression?.({
      id: `exp-${Date.now()}`,
      english: newEng.trim(),
      korean: newKor.trim(),
      exampleSentence: newEx.trim() || newEng.trim(),
      situation: newSit.trim() || '직접 등록한 표현',
      tag: 'Custom',
      createdAt: Date.now()
    });

    setNewEng('');
    setNewKor('');
    setNewEx('');
    setNewSit('');
    setShowAddModal(false);
  };

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-24">
      {/* 서브 탭 스위치 */}
      <div className="p-1 bg-[#eaedff] rounded-2xl flex items-center">
        <button
          onClick={() => setSubTab('expressions')}
          className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all ${subTab === 'expressions'
              ? 'bg-white text-[#1a73e8] shadow-sm'
              : 'text-[#5f6368] hover:text-[#1f1f1f]'
            }`}
        >
          회화 표현 보관함 ({expressions.length})
        </button>
        <button
          onClick={() => setSubTab('scripts')}
          className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all ${subTab === 'scripts'
              ? 'bg-white text-[#1a73e8] shadow-sm'
              : 'text-[#5f6368] hover:text-[#1f1f1f]'
            }`}
        >
          콘텐츠 대본 ({scripts.length})
        </button>
      </div>

      {/* 1. 표현 보관함 뷰 */}
      {subTab === 'expressions' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] font-medium text-[#5f6368]">
              스몰톡 중 수집한 문장 및 이디엄
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1 bg-[#1a73e8] text-white rounded-full text-[12px] font-semibold hover:bg-[#1557b0] flex items-center gap-1 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              직접 추가
            </button>
          </div>

          {expressions.length === 0 ? (
            <div className="py-16 text-center text-[#5f6368] space-y-3 bg-white rounded-2xl border border-[#e0e3e7] p-6">
              <span className="material-symbols-outlined text-[48px] text-[#bfc6dd]">bookmark_border</span>
              <p className="text-[14px] font-medium text-[#1f1f1f]">아직 저장된 표현이 없습니다.</p>
              <p className="text-[12px] text-[#747775]">
                AI 친구와 대화 중 마음에 드는 표현이나 추천 카드를 북마크하여 나만의 영어 단어장을 만들어보세요.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-2 inline-flex items-center gap-1 px-4 py-2 bg-[#e8f0fe] text-[#1a73e8] rounded-xl text-xs font-semibold hover:bg-[#d2e3fc]"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                첫 표현 등록하기
              </button>
            </div>
          ) : (
            expressions.map((exp) => (
              <div
                key={exp.id}
                className="p-4 bg-white border border-[#e0e3e7] rounded-2xl shadow-xs hover:border-[#c2e7ff] transition-all relative group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0f4f9] text-[#1a73e8]">
                    {exp.tag}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#5f6368]">{exp.situation}</span>
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

                <h4 className="text-[16px] font-bold text-[#1f1f1f] mb-1">
                  {exp.english}
                </h4>
                <p className="text-[13px] font-medium text-[#00897b] mb-2">
                  {exp.korean}
                </p>

                <div className="p-2.5 bg-[#faf8ff] rounded-xl text-[12px] text-[#444746] leading-relaxed border-l-2 border-[#1a73e8]">
                  <span className="font-semibold text-[#1f1f1f] block mb-0.5">예문:</span>
                  "{exp.exampleSentence}"
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. 대본 보관함 뷰 */}
      {subTab === 'scripts' && (
        <div className="space-y-4">
          {scripts.length === 0 ? (
            <div className="py-16 text-center text-[#5f6368] space-y-3 bg-white rounded-2xl border border-[#e0e3e7] p-6">
              <span className="material-symbols-outlined text-[48px] text-[#bfc6dd]">menu_book</span>
              <p className="text-[14px] font-medium text-[#1f1f1f]">보관된 대본이 없습니다.</p>
              <p className="text-[12px] text-[#747775]">
                언어 인스펙터 분석에서 생성된 롤플레잉 대본이 여기에 저장됩니다.
              </p>
            </div>
          ) : (
            scripts.map((script) => (
              <div
                key={script.id}
                className="p-4 bg-white border border-[#e0e3e7] rounded-2xl shadow-xs space-y-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e8f0fe] text-[#1a73e8]">
                      {script.level}
                    </span>
                    <span className="text-[11px] text-[#5f6368] truncate">{script.situation}</span>
                  </div>
                  <h4 className="text-[16px] font-bold text-[#1f1f1f]">
                    {script.title}
                  </h4>
                  <p className="text-[11px] text-[#00897b] font-medium mt-0.5">
                    핵심 타겟 표현: {script.targetExpression}
                  </p>
                </div>

                {/* 대본 라인 목록 */}
                <div className="space-y-2 pt-2 border-t border-[#f0f4f9]">
                  {script.dialogue.map((line, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl text-[13px] ${line.isUser
                          ? 'bg-[#e8f0fe] border border-[#c2e7ff] ml-3'
                          : 'bg-[#f8fafd] border border-[#e0e3e7] mr-3'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-bold text-[#1a73e8]">
                          {line.speaker}
                        </span>
                      </div>
                      <p className="font-semibold text-[#1f1f1f]">{line.english}</p>
                      <p className="text-[11px] text-[#5f6368] mt-0.5">{line.korean}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 새 표현 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-[17px] font-bold text-[#1f1f1f] mb-3">회화 표현 직접 등록</h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368] mb-1">영어 표현 *</label>
                <input
                  type="text"
                  placeholder="예: turn my day around"
                  value={newEng}
                  onChange={(e) => setNewEng(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e0e3e7] rounded-xl text-[14px] outline-none focus:border-[#1a73e8]"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368] mb-1">한국어 의미 *</label>
                <input
                  type="text"
                  placeholder="예: 기분/상황을 좋게 반전시키다"
                  value={newKor}
                  onChange={(e) => setNewKor(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e0e3e7] rounded-xl text-[14px] outline-none focus:border-[#1a73e8]"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368] mb-1">활용 예문</label>
                <input
                  type="text"
                  placeholder="예: A cup of coffee turned my day around."
                  value={newEx}
                  onChange={(e) => setNewEx(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e0e3e7] rounded-xl text-[14px] outline-none focus:border-[#1a73e8]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#5f6368] mb-1">상황 / 뉘앙스</label>
                <input
                  type="text"
                  placeholder="예: 기분 전환, 일상 감정 표현"
                  value={newSit}
                  onChange={(e) => setNewSit(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e0e3e7] rounded-xl text-[14px] outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#5f6368] hover:bg-[#f0f4f9]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-[#1a73e8] text-white hover:bg-[#1557b0]"
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
