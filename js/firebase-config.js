import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { 
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCu8an6nozgp1NYLs7QqjRZou3gEegdG8s",
  authDomain: "wifa-trainer-gruen.firebaseapp.com",
  projectId: "wifa-trainer-gruen",
  storageBucket: "wifa-trainer-gruen.firebasestorage.app",
  messagingSenderId: "561836344573",
  appId: "1:561836344573:web:23c2cc88c74a9e8f11aa94"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'de';
const db = getFirestore(app);

function getReturnUrl() {
  // Verwende lokal die aktuelle Origin, sonst die GitHub-Pages-URL
  try {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return window.location.origin;
    }
  } catch (e) {}
  return 'https://beckersabine082-art.github.io/wifa-trainer-gruen/';
}

export {
  auth,
  db,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  getReturnUrl
};
