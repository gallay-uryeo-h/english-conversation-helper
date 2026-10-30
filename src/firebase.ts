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

// 사용자 지정 Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyAodFwVZvSAlMxppnODM4VVR5fSjfkhvi4",
  authDomain: "studio-2726051254-c02c9.firebaseapp.com",
  projectId: "studio-2726051254-c02c9",
  storageBucket: "studio-2726051254-c02c9.firebasestorage.app",
  messagingSenderId: "58367223801",
  appId: "1:58367223801:web:817b230c96124a828dff28"
};

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

