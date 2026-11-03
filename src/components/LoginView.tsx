import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export const LoginView: React.FC = () => {
  const { loginWithGoogle, loading, authError, clearError, appTarget, allowedEmails, allowedDomains } = useAuth();

  const isFamily = appTarget === 'family';
  const targetTitle = isFamily ? '가족 전용 모드' : '학교 전용 모드';
  const targetBadgeBg = isFamily ? 'bg-[#e8f0fe] text-[#1967d2]' : 'bg-[#e6f4ea] text-[#137333]';

  return (
    <div className="min-h-screen bg-[#f8fafd] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-[#e0e3e7] p-8 flex flex-col items-center text-center">
        
        {/* 앱 아이콘 */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#1a73e8] to-[#669df6] flex items-center justify-center shadow-md mb-4 text-white">
          <span className="material-symbols-outlined text-[34px]">chat_bubble</span>
        </div>

        {/* 타깃 뱃지 */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 ${targetBadgeBg}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
          {targetTitle}
        </div>

        {/* 타이틀 및 소개 */}
        <h1 className="text-2xl font-bold text-[#1f1f1f] mb-1">
          AI 영어회화 도우미
        </h1>
        <p className="text-[13px] text-[#5f6368] mb-6 leading-relaxed">
          실시간 한영 추천과 인스펙터로 완성하는<br />
          스마트한 영어 스몰톡 파트너
        </p>

        {/* 접근 제한 안내 카드 */}
        <div className="w-full bg-[#f1f3f4] rounded-2xl p-3.5 mb-6 text-left">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#3c4043] mb-1">
            <span className="material-symbols-outlined text-[16px] text-[#1a73e8]">lock</span>
            접근 권한 안내
          </div>
          <p className="text-[12px] text-[#5f6368] leading-normal">
            {isFamily ? (
              <>
                사전 등록된 <span className="font-semibold text-[#1a73e8]">가족 구글 계정</span>으로만 로그인할 수 있습니다.
              </>
            ) : (
              <>
                우려 고등학교 <span className="font-semibold text-[#137333]">학교 구글 계정</span>
                <span className="block font-mono text-[11px] text-[#1f1f1f] mt-0.5 bg-white/70 px-1.5 py-0.5 rounded border border-[#dadce0]">
                  {allowedDomains.length > 0 ? `*@${allowedDomains.join(', ')}` : allowedEmails.join(', ')}
                </span>
                계정으로만 로그인할 수 있습니다.
              </>
            )}
          </p>
        </div>

        {/* 에러 메시지 알림 배너 */}
        {authError && (
          <div className="w-full bg-[#fce8e6] border border-[#f5c2c7] rounded-2xl p-3.5 mb-5 text-left flex items-start gap-2.5 animate-fadeIn">
            <span className="material-symbols-outlined text-[#d93025] text-[20px] shrink-0 mt-0.5">error</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#b3261e] mb-0.5">
                접근이 제한되었습니다
              </p>
              <p className="text-[11px] text-[#5f6368] break-words leading-tight">
                {authError}
              </p>
              <button 
                onClick={clearError}
                className="text-[11px] font-semibold text-[#1a73e8] hover:underline mt-1.5"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 구글 로그인 버튼 */}
        <button
          onClick={loginWithGoogle}
          disabled={loading}
          className="w-full h-12 bg-white hover:bg-[#f8fafd] active:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] rounded-full font-medium text-[14px] flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              {/* Google G Logo SVG */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Google 계정으로 시작하기</span>
            </>
          )}
        </button>

        {/* 보안 안내 푸터 */}
        <p className="text-[11px] text-[#80868b] mt-6 flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-[13px]">verified_user</span>
          안전한 Google OAuth 인증 보호
        </p>
      </div>
    </div>
  );
};

