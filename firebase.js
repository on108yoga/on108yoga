// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKdaTk43A3Hp00b7gURWl7fejoAYzOkBI",
  authDomain: "on108-yoga.firebaseapp.com",
  projectId: "on108-yoga",
  storageBucket: "on108-yoga.firebasestorage.app",
  messagingSenderId: "852225153853",
  appId: "1:852225153853:web:e61f918ff4e0dacfac4354"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Authentication
export const auth = getAuth(app);

// Firestore
export const db = getFirestore(app);
