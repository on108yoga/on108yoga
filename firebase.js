// firebase.js

import { initializeApp } from 
"https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";


import { getAuth } from 
"https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";


import { getFirestore } from 
"https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";


// Firebase 설정
const firebaseConfig = {

  apiKey: "여기에 Firebase API KEY",
  authDomain: "여기에 authDomain",
  projectId: "여기에 projectId",
  storageBucket: "여기에 storageBucket",
  messagingSenderId: "여기에 messagingSenderId",
  appId: "여기에 appId"

};


// Firebase 초기화
const app = initializeApp(firebaseConfig);


// Authentication
export const auth = getAuth(app);


// Firestore
export const db = getFirestore(app);
