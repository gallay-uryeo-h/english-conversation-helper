import { 
  db, 
  ROOT_COLLECTION_NAME, 
  doc, 
  getDoc, 
  setDoc,
  onSnapshot
} from '../firebase';

export const MASTER_ADMINS = [
  'gallay850902@gmail.com',
  'gallay@uryeo-h.gne.go.kr'
];

export interface AdminSettings {
  allowedEmails: string[];
  allowedDomains: string[];
  updatedAt?: number;
  updatedBy?: string;
}

const ADMIN_DOC_ID = "admin_settings";

export const adminService = {
  // 관리자 여부 확인
  isMasterAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    return MASTER_ADMINS.includes(email.trim().toLowerCase());
  },

  // 텍스트에서 이메일 목록 일괄 추출 (쉼표, 줄바꿈, 공백 등 모두 지원)
  parseEmailsFromText(text: string): string[] {
    if (!text) return [];
    // 정규식을 통해 텍스트 내의 모든 이메일 패턴 추출
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    const normalized = matches
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    // 중복 제거
    return Array.from(new Set(normalized));
  },

  // Firestore에서 허용 계정 및 도메인 불러오기
  async getSettings(): Promise<AdminSettings> {
    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, ADMIN_DOC_ID);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as AdminSettings;
        return {
          allowedEmails: data.allowedEmails || [],
          allowedDomains: data.allowedDomains || []
        };
      }
      // 최초 기본값 등록
      const initial: AdminSettings = {
        allowedEmails: [...MASTER_ADMINS],
        allowedDomains: ['uryeo-h.gne.go.kr']
      };
      await setDoc(docRef, initial);
      return initial;
    } catch (e) {
      console.warn("Firestore admin settings fetch error, fallback to local:", e);
      const local = localStorage.getItem('app_admin_settings');
      if (local) return JSON.parse(local);
      return { allowedEmails: [...MASTER_ADMINS], allowedDomains: ['uryeo-h.gne.go.kr'] };
    }
  },

  // 실시간 설정 구독
  subscribeSettings(callback: (settings: AdminSettings) => void) {
    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, ADMIN_DOC_ID);
      return onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as AdminSettings;
          callback({
            allowedEmails: data.allowedEmails || [],
            allowedDomains: data.allowedDomains || []
          });
        }
      });
    } catch (e) {
      console.warn("Admin subscribe failed:", e);
      return () => {};
    }
  },

  // 여러 이메일 일괄 추가
  async addEmails(newEmails: string[], updatedBy: string): Promise<string[]> {
    const current = await this.getSettings();
    const merged = Array.from(new Set([
      ...current.allowedEmails,
      ...newEmails.map(e => e.trim().toLowerCase())
    ]));

    const updated: AdminSettings = {
      ...current,
      allowedEmails: merged,
      updatedAt: Date.now(),
      updatedBy
    };

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, ADMIN_DOC_ID);
      await setDoc(docRef, updated);
    } catch (e) {
      console.warn("Admin save error:", e);
      localStorage.setItem('app_admin_settings', JSON.stringify(updated));
    }

    return merged;
  },

  // 이메일 삭제
  async removeEmail(emailToRemove: string, updatedBy: string): Promise<string[]> {
    const current = await this.getSettings();
    const target = emailToRemove.trim().toLowerCase();

    // 마스터 관리자는 삭제 불가 보호
    if (MASTER_ADMINS.includes(target)) {
      throw new Error("마스터 관리자 계정은 삭제할 수 없습니다.");
    }

    const filtered = current.allowedEmails.filter(e => e !== target);
    const updated: AdminSettings = {
      ...current,
      allowedEmails: filtered,
      updatedAt: Date.now(),
      updatedBy
    };

    try {
      const docRef = doc(db, ROOT_COLLECTION_NAME, ADMIN_DOC_ID);
      await setDoc(docRef, updated);
    } catch (e) {
      localStorage.setItem('app_admin_settings', JSON.stringify(updated));
    }

    return filtered;
  }
};
