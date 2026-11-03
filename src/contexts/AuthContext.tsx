import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User, 
  CURRENT_APP_TARGET,
  ALLOWED_EMAILS,
  ALLOWED_DOMAINS
} from '../firebase';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  appTarget: 'family' | 'school';
  allowedEmails: string[];
  allowedDomains: string[];
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 이메일이 현재 환경(가족용/학교용)의 접근 허용 정책을 충족하는지 검사
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();

  // 1. 개별 허용 이메일 목록 일치 확인
  if (ALLOWED_EMAILS.includes(normalizedEmail)) {
    return true;
  }

  // 2. 허용 도메인 일치 확인 (예: uryeo-h.gne.go.kr)
  const emailDomain = normalizedEmail.split('@')[1];
  if (emailDomain && ALLOWED_DOMAINS.some((domain: string) => emailDomain === domain || emailDomain.endsWith('.' + domain))) {
    return true;
  }

  // 3. 만약 둘 다 비어있다면 (설정 누락 방지)
  if (ALLOWED_EMAILS.length === 0 && ALLOWED_DOMAINS.length === 0) {
    return true;
  }

  return false;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (isEmailAllowed(currentUser.email)) {
          setUser(currentUser);
          setAuthError(null);
        } else {
          // 허용되지 않은 계정은 즉시 로그아웃 처리
          await signOut(auth);
          setUser(null);
          const domainGuide = ALLOWED_DOMAINS.length > 0 ? `*@${ALLOWED_DOMAINS.join(', ')}` : '';
          const emailGuide = ALLOWED_EMAILS.join(', ');
          
          if (CURRENT_APP_TARGET === 'family') {
            setAuthError(`가족으로 등록된 계정(${emailGuide || '등록 이메일'})만 이용 가능합니다. 현재 계정: ${currentUser.email}`);
          } else {
            setAuthError(`학교 계정(${domainGuide || emailGuide})으로 로그인해 주세요. 현재 계정: ${currentUser.email}`);
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      const result = await signInWithPopup(auth, googleProvider);
      
      if (!isEmailAllowed(result.user.email)) {
        await signOut(auth);
        setUser(null);
        const domainGuide = ALLOWED_DOMAINS.length > 0 ? `*@${ALLOWED_DOMAINS.join(', ')}` : '';
        const emailGuide = ALLOWED_EMAILS.join(', ');
        
        if (CURRENT_APP_TARGET === 'family') {
          throw new Error(`가족으로 등록된 계정(${emailGuide})만 접근할 수 있습니다. (시도한 계정: ${result.user.email})`);
        } else {
          throw new Error(`학교 계정(${domainGuide || emailGuide})으로 로그인해 주세요. (시도한 계정: ${result.user.email})`);
        }
      }

      setUser(result.user);
    } catch (err: any) {
      console.error("Login failed:", err);
      // 구글 팝업 닫힘(auth/popup-closed-by-user)은 에러 배너를 크게 띄우지 않고 자연스럽게 넘김
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError(null);
      } else {
        setAuthError(err.message || '로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setAuthError(null);
    } catch (err: any) {
      console.error("Logout failed:", err);
    }
  };

  const clearError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        appTarget: CURRENT_APP_TARGET,
        allowedEmails: ALLOWED_EMAILS,
        allowedDomains: ALLOWED_DOMAINS,
        loginWithGoogle,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

