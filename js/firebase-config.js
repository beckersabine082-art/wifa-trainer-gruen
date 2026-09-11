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
  collection,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  updateDoc,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import {
  getStorage,
  ref,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js';

import {firebasePublicConfig as firebaseConfig} from './firebase-public-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'de';
const db = getFirestore(app);
const storage = getStorage(app);

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
  storage,
  ref,
  getDownloadURL,
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
  collection,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  updateDoc,
  query,
  orderBy,
  getReturnUrl
};
