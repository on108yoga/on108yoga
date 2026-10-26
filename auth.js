Console.log("auth.js 실행");

import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";


// ==========================================
// ✨ 커스텀 토스트 알림 함수 (alert 대체)
// ==========================================
function showToast(message) {
    if (!document.getElementById("toast-style")) {
        const style = document.createElement("style");
        style.id = "toast-style";
        style.innerHTML = `
            .custom-toast {
                position: fixed;
                bottom: 40px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background-color: #3f4e43;
                color: #ffffff;
                padding: 14px 24px;
                border-radius: 30px;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 8px 20px rgba(0,0,0,0.18);
                z-index: 9999;
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                pointer-events: none;
                text-align: center;
                min-width: 220px;
                white-space: nowrap;
            }
            .custom-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        `;
        document.head.appendChild(style);
    }

    const existingToast = document.querySelector(".custom-toast");
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.className = "custom-toast";
    toast.innerText = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("show");
    }, 10);

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2000);
}


// =================
// 회원가입
// =================
const signupForm = document.getElementById("signupForm");

if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value;
        const phone = document.getElementById("phone").value.replace(/-/g, "").trim();

        if (!/^010\d{8}$/.test(phone)) {
            showToast("전화번호를 정확히 입력해주세요. (예: 01012345678)");
            return;
        }

        const email = `${phone}@yoga.local`;
        const password = document.getElementById("password").value;

        try {
            // 1. Firebase Auth 계정 생성
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            // 2. Firestore 문서 ID를 전화번호(phone)로 저장하여 다른 기능들과 연동
            await setDoc(
                doc(db, "users", phone),
                {
                    uid: userCredential.user.uid,
                    name: name,
                    phone: phone,
                    email: email,
                    password: password, 
                    role: "member",
                    ticketCount: 0,
                    createdAt: new Date()
                }
            );

            showToast("🎉 회원가입이 완료되었습니다.");
            
            setTimeout(() => {
                window.location.href = "index.html";
            }, 1000);

        } catch (error) {
            switch (error.code) {
                case "auth/email-already-in-use":
                    showToast("이미 가입된 전화번호입니다.");
                    break;
                case "auth/weak-password":
                    showToast("비밀번호는 6자 이상이어야 합니다.");
                    break;
                case "auth/invalid-email":
                    showToast("전화번호 형식이 올바르지 않습니다.");
                    break;
                default:
                    console.log(error);
                    showToast("회원가입에 실패했습니다.");
            }
        }
    });
}


// =================
// 로그인 (Firestore 직접 조회 방식)
// =================
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const phone = document.getElementById("phone").value.replace(/[^0-9]/g, "").trim();
        const password = document.getElementById("password").value.trim();

        try {
            // Firestore의 users 컬렉션에서 전화번호(문서 ID)로
