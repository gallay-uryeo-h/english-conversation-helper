import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { adminService, MASTER_ADMINS } from '../services/adminService';

interface AdminModalProps {
  onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ onClose }) => {
  const { allowedEmails, addAllowedEmails, removeAllowedEmail, appTarget } = useAuth();
  const [pasteText, setPasteText] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 텍스트 실시간 파싱 결과
  const detectedEmails = adminService.parseEmailsFromText(pasteText);
  // 이미 등록되어 있는 이메일 제외 신규 이메일만 카운트
  const newEmails = detectedEmails.filter(e => !allowedEmails.includes(e));

  const handleBatchAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmails.length === 0) return;

    try {
      setIsSubmitting(true);
      await addAllowedEmails(newEmails);
      setSuccessMsg(`총 ${newEmails.length}개의 계정이 성공적으로 등록되었습니다!`);
      setPasteText('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert("계정 등록 중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (confirm(`'${email}' 계정을 접근 허용 목록에서 삭제하시겠습니까?`)) {
      try {
        await removeAllowedEmail(email);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const filteredList = allowedEmails.filter(email => 
    email.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* 모달 상단 헤더 */}
        <div className="p-4 px-5 border-b border-[#e0e3e7] flex items-center justify-between bg-[#f8fafd]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#fef7e0] text-[#b06000] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[#1f1f1f]">접근 허용 계정 관리</h2>
              <p className="text-[11px] text-[#5f6368]">
                {appTarget === 'family' ? '🏡 가족 모드 화이트리스트' : '🏫 학교 모드 접속 관리'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-black/5"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* 모달 본문 (스크롤) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* 성공 알림 토스트 */}
          {successMsg && (
            <div className="p-3 bg-[#e6f4ea] border border-[#ceead6] text-[#137333] text-xs font-semibold rounded-2xl flex items-center gap-2 animate-fadeIn">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {successMsg}
            </div>
          )}

          {/* 1. 복사/붙여넣기 일괄 등록 영역 */}
          <div className="bg-[#f0f4f9] p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#1f1f1f] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#1a73e8]">content_paste</span>
                계정 복사·붙여넣기 일괄 등록
              </span>
              {detectedEmails.length > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#c2e7ff] text-[#001d35]">
                  {detectedEmails.length}개 감지됨
                </span>
              )}
            </div>

            <p className="text-[11px] text-[#5f6368] leading-relaxed">
              여러 계정을 엔터(줄바꿈), 쉼표(,), 공백 등 아무 형태로 복사해서 붙여넣으세요. 이메일만 자동으로 쏙 골라냅니다.
            </p>

            <textarea
              rows={3}
              placeholder="예시:&#10;family1@gmail.com, family2@gmail.com&#10;student1@gmail.com"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full p-2.5 bg-white border border-[#dadce0] rounded-xl text-xs font-mono placeholder:font-sans focus:outline-none focus:border-[#1a73e8] resize-none"
            />

            {/* 감지된 이메일 칩 미리보기 */}
            {detectedEmails.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-[#444746]">
                  <span>추가될 신규 이메일 ({newEmails.length}개):</span>
                </div>
                <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1 p-2 bg-white/70 rounded-xl border border-[#dadce0]">
                  {detectedEmails.map((em) => {
                    const isAlreadyAdded = allowedEmails.includes(em);
                    return (
                      <span 
                        key={em} 
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                          isAlreadyAdded 
                            ? 'bg-[#f1f3f4] text-[#80868b] line-through' 
                            : 'bg-[#e8f0fe] text-[#1a73e8] font-semibold'
                        }`}
                      >
                        {em}
                        {isAlreadyAdded && <span className="text-[9px] no-underline">(기등록)</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={handleBatchAdd}
              disabled={isSubmitting || newEmails.length === 0}
              className="w-full py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] active:scale-[0.99] disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  <span>{newEmails.length > 0 ? `${newEmails.length}개 계정 일괄 등록하기` : '계정 등록하기'}</span>
                </>
              )}
            </button>
          </div>

          {/* 2. 현재 등록된 계정 목록 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#1f1f1f] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#137333]">verified</span>
                현재 허용된 계정 ({allowedEmails.length}명)
              </span>
            </div>

            {/* 검색 필터 */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#747775]">
                search
              </span>
              <input 
                type="text"
                placeholder="등록된 계정 검색..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#f8fafd] border border-[#dadce0] rounded-xl text-xs outline-none focus:border-[#1a73e8]"
              />
            </div>

            {/* 목록 카드 리스트 */}
            <div className="divide-y divide-[#f1f3f4] border border-[#e0e3e7] rounded-2xl max-h-56 overflow-y-auto bg-white">
              {filteredList.map((email) => {
                const isMaster = MASTER_ADMINS.includes(email.toLowerCase());
                return (
                  <div key={email} className="p-2.5 px-3 flex items-center justify-between text-xs hover:bg-[#f8fafd]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[16px] text-[#5f6368]">
                        {isMaster ? 'shield_person' : 'person'}
                      </span>
                      <span className="font-mono text-[#1f1f1f] truncate font-medium">
                        {email}
                      </span>
                      {isMaster && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#fef7e0] text-[#b06000] shrink-0">
                          마스터 관리자
                        </span>
                      )}
                    </div>

                    {!isMaster ? (
                      <button
                        onClick={() => handleRemove(email)}
                        className="text-[#9aa0a6] hover:text-[#d93025] p-1 rounded-full hover:bg-black/5 transition-colors shrink-0"
                        title="계정 삭제"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    ) : (
                      <span className="material-symbols-outlined text-[16px] text-[#9aa0a6]" title="보호됨">
                        lock
                      </span>
                    )}
                  </div>
                );
              })}

              {filteredList.length === 0 && (
                <div className="py-6 text-center text-xs text-[#5f6368]">
                  일치하는 계정이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 모달 하단 닫기 */}
        <div className="p-3 px-5 border-t border-[#e0e3e7] bg-[#f8fafd] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#1f1f1f] hover:bg-black text-white text-xs font-semibold rounded-xl"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
