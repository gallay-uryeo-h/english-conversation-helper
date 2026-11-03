import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User, 
  CURRENT_APP_TARGET,
  ALLOWED_EMAILS as ENV_ALLOWED_EMAILS,
  ALLOWED_DOMAINS as ENV_ALLOWED_DOMAINS
} from '../firebase';
import { adminService, MASTER_ADMINS } from '../services/adminService';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  authError: string | null;
  appTarget: 'family' | 'school';
  allowedEmails: string[];
  allowedDomains: string[];
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  addAllowedEmails: (emails: string[]) => Promise<void>;
  removeAllowedEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dynamicEmails, setDynamicEmails] = useState<string[]>([...MASTER_ADMINS, ...ENV_ALLOWED_EMAILS]);
  const [dynamicDomains, setDynamicDomains] = useState<string[]>([...ENV_ALLOWED_DOMAINS]);

  // Firestore에서 관리자가 등록한 허용 계정 실시간 구독
  useEffect(() => {
    const unsubscribe = adminService.subscribeSettings((settings) => {
      setDynamicEmails(Array.from(new Set([
        ...MASTER_ADMINS,
        ...ENV_ALLOWED_EMAILS,
        ...(settings.allowedEmails || [])
      ])));
      setDynamicDomains(Array.from(new Set([
        ...ENV_ALLOWED_DOMAINS,
        ...(settings.allowedDomains || [])
      ])));
    });

    return () => unsubscribe();
  }, []);

  /**
   * 이메일이 접근 허용 정책을 충족하는지 검사
   */
  const checkEmailAllowed = (email: string | null | undefined): boolean => {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();

    // 1. 마스터 관리자 확인
    if (MASTER_ADMINS.includes(normalized)) return true;

    // 2. 환경변수 및 Firestore 허용 목록 확인
    if (dynamicEmails.includes(normalized)) return true;

    // 3. 학교/교육청 허용 도메인 확인 (예: uryeo-h.gne.go.kr)
    const emailDomain = normalized.split('@')[1];
    if (emailDomain && dynamicDomains.some((d: string) => emailDomain === d || emailDomain.endsWith('.' + d))) {
      return true;
    }

    return false;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (checkEmailAllowed(currentUser.email)) {
          setUser(currentUser);
          setAuthError(null);
        } else {
          // 허용되지 않은 계정은 즉시 로그아웃 처리
          await signOut(auth);
          setUser(null);
          
          if (CURRENT_APP_TARGET === 'family') {
            setAuthError(`등록된 가족 계정만 이용 가능합니다. (현재 계정: ${currentUser.email})`);
          } else {
            setAuthError(`학교 계정(*@uryeo-h.gne.go.kr)으로 로그인해 주세요. (현재 계정: ${currentUser.email})`);
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [dynamicEmails, dynamicDomains]);

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      const result = await signInWithPopup(auth, googleProvider);
      
      if (!checkEmailAllowed(result.user.email)) {
        await signOut(auth);
        setUser(null);
        
        if (CURRENT_APP_TARGET === 'family') {
          throw new Error(`등록된 가족 계정만 접근할 수 있습니다. (시도한 계정: ${result.user.email})`);
        } else {
          throw new Error(`학교 계정(*@uryeo-h.gne.go.kr)으로 로그인해 주세요. (시도한 계정: ${result.user.email})`);
        }
      }

      setUser(result.user);
    } catch (err: any) {
      console.error("Login failed:", err);
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

  const addAllowedEmails = async (emails: string[]) => {
    if (!user?.email) return;
    const updated = await adminService.addEmails(emails, user.email);
    setDynamicEmails(updated);
  };

  const removeAllowedEmail = async (email: string) => {
    if (!user?.email) return;
    const updated = await adminService.removeEmail(email, user.email);
    setDynamicEmails(updated);
  };

  const isAdmin = adminService.isMasterAdmin(user?.email);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        authError,
        appTarget: CURRENT_APP_TARGET,
        allowedEmails: dynamicEmails,
        allowedDomains: dynamicDomains,
        loginWithGoogle,
        logout,
        clearError,
        addAllowedEmails,
        removeAllowedEmail
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
