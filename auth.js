console.log("auth.js 실행");

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
// ✨ 커스텀 토스트 알림 함수 (alert 대체) - 모바일 최적화 적용
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
                max-width: 90%;       /* 🔥 모바일 화면 너비 초과 방지 */
                white-space: normal;  /* 🔥 좁은 화면에서 글자 줄바꿈 허용 */
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
    }, 2000); // 팝업 노출 시간 유지
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
            const user
