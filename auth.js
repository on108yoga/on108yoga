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
    getDoc,
    updateDoc
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
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            await setDoc(
                doc(db, "users", userCredential.user.uid),
                {
                    name: name,
                    phone: phone,
                    email: email,
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
// 로그인
// =================
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const phone = document.getElementById("phone").value.replace(/-/g, "").trim();
        const email = `${phone}@yoga.local`;
        const password = document.getElementById("password").value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            showToast("✅ 로그인 되었습니다.");
            
            setTimeout(() => {
                location.href = "index.html";
            }, 1000);

        } catch (error) {
            if (error.code === "auth/invalid-credential") {
                showToast("전화번호 또는 비밀번호가 올바르지 않습니다.");
            } else {
                console.log(error);
                showToast("로그인에 실패했습니다.");
            }
        }
    });
}


// =================
// 로그아웃
// =================
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault(); // a 태그 기본 동작(페이지 상단 이동 등) 방지
        await signOut(auth);
        showToast("로그아웃 되었습니다.");
        
        setTimeout(() => {
            location.href = "index.html";
        }, 1000);
    });
}


// =================
// 로그인 상태 확인 & 프로필/잔여횟수/메뉴 UI 연동
// =================
onAuthStateChanged(auth, async (user) => {
    const userInfo = document.getElementById("userInfo");
    const guestMenu = document.getElementById("guestMenu");
    const memberMenu = document.getElementById("memberMenu");

    // reservation.html / mypage.html 등 프로필 카드 요소
    const myUserNameEl = document.getElementById("myUserName");
    const myTicketCountEl = document.getElementById("myTicketCount");

    // 관리자 전용 메뉴 일괄 선택 (bookingListLink, memberManageLink 포함)
    const adminOnlyElements = document.querySelectorAll(".admin-only");

    if (user) {
        console.log("로그인 UID:", user.uid);

        let userName = user.email;
        let role = "member";
        let ticketCount = 0;

        try {
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                userName = userData.name || "회원";
                role = userData.role || "member";

                if (userData.ticketCount === undefined) {
                    await updateDoc(userRef, { ticketCount: 0 });
                    ticketCount = 0;
                } else {
                    ticketCount = userData.ticketCount;
                }

                console.log("Firestore 이름:", userName, "권한:", role, "잔여 횟수:", ticketCount);
            }
        } catch (error) {
            console.log("사용자 정보 불러오기 실패", error);
        }

        // 1. 게스트/회원 메뉴 스위칭
        if (guestMenu) guestMenu.style.display = "none";
        if (memberMenu) memberMenu.style.display = "flex";

        // 2. 사용자 정보 표시
        if (userInfo) {
            userInfo.style.display = "inline";
            userInfo.innerHTML = `👋 ${userName}님`;
        }
        if (myUserNameEl) myUserNameEl.innerText = `${userName} 님`;
        if (myTicketCountEl) myTicketCountEl.innerText = `${ticketCount} 회`;

        // 3. 관리자 전용 메뉴 표시 제어 (bookingListLink + memberManageLink 일괄 제어)
        if (role === "admin") {
            adminOnlyElements.forEach(el => el.style.display = "inline-block");
        } else {
            adminOnlyElements.forEach(el => el.style.display = "none");
        }

    } else {
        // 비로그인 (로그아웃) 상태일 때 초기화
        if (guestMenu) guestMenu.style.display = "flex";
        if (memberMenu) memberMenu.style.display = "none";

        if (userInfo) userInfo.style.display = "none";
        if (myUserNameEl) myUserNameEl.innerText = "- 님";
        if (myTicketCountEl) myTicketCountEl.innerText = "- 회";

        adminOnlyElements.forEach(el => el.style.display = "none");
    }
});
