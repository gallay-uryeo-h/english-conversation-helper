import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp
} from "firebase/firestore";

// 환경별(family vs school) 동적 Firebase 설정
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCgn8GP3wBJX1x8vPWlMeAlvKIOmn1HGjE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "family-eb4f8.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "family-eb4f8",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "family-eb4f8.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "540772799272",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:540772799272:web:140a5b5b964fabbe6a761d"
};

// 현재 타깃 (family 또는 school)
export const CURRENT_APP_TARGET = import.meta.env.VITE_APP_TARGET || "family";

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/**
 * ⚠️ 중요: 다른 앱과 공유하는 프로젝트이므로 단일 루트 컬렉션만 사용합니다.
 * 루트 컬렉션: "english-conversation-helper"
 */
export const ROOT_COLLECTION_NAME = "english-conversation-helper";

// 단일 루트 컬렉션 하위의 서브컬렉션 또는 도큐먼트 헬퍼
export const getRootDocRef = (docId: string) => doc(db, ROOT_COLLECTION_NAME, docId);
export const getSubCollectionRef = (parentDocId: string, subCollection: string) => 
  collection(db, ROOT_COLLECTION_NAME, parentDocId, subCollection);

export {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
};
