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
            alert("전화번호를 정확히 입력해주세요. (예: 01012345678)");
            return;
        }

        const email = `${phone}@yoga.local`;
        const password = document.getElementById("password").value;

        try {
            /* 가입 성공 */
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            // Firestore에 기본 정보 저장 (ticketCount: 4회 기본 제공)
            await setDoc(
                doc(db, "users", userCredential.user.uid),
                {
                    name: name,
                    phone: phone,
                    email: email,
                    role: "member",
                    ticketCount: 4 // ✨ [추가] 회원가입 시 기본 잔여 횟수 4회 부여
                }
            );

            alert("🎉 회원가입이 완료되었습니다.");
            window.location.href = "index.html";

        } catch (error) {
            switch (error.code) {
                case "auth/email-already-in-use":
                    alert("이미 가입된 전화번호입니다.");
                    break;
                case "auth/weak-password":
                    alert("비밀번호는 6자 이상이어야 합니다.");
                    break;
                case "auth/invalid-email":
                    alert("전화번호 형식이 올바르지 않습니다.");
                    break;
                default:
                    console.log(error);
                    alert("회원가입에 실패했습니다.");
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
            alert("✅ 로그인 되었습니다.");
            location.href = "index.html";
        } catch (error) {
            if (error.code === "auth/invalid-credential") {
                alert("전화번호 또는 비밀번호가 올바르지 않습니다.");
            } else {
                console.log(error);
                alert("로그인에 실패했습니다.");
            }
        }
    });
}


// =================
// 로그아웃
// =================
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        alert("로그아웃 되었습니다.");
        location.href = "index.html";
    });
}


// =================
// 로그인 상태 확인 & 프로필/잔여횟수 UI 연동
// =================
onAuthStateChanged(auth, async (user) => {
    const userInfo = document.getElementById("userInfo");
    const loginLink = document.getElementById("loginLink");
    const signupLink = document.getElementById("signupLink");
    const reservationLink = document.getElementById("reservationLink");
    const memberManageLink = document.getElementById("memberManageLink");
    const logoutBtn = document.getElementById("logoutBtn");

    // reservation.html 페이지 상단 카드 요소
    const myUserNameEl = document.getElementById("myUserName");
    const myTicketCountEl = document.getElementById("myTicketCount");

    if (user) {
        console.log("로그인 UID:", user.uid);

        let userName = user.email;
        let role = "member";
        let ticketCount = 4; // 기본값 4회

        try {
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                userName = userData.name || "회원";
                role = userData.role || "member";

                // 기존 유저 데이터에 ticketCount가 없는 경우 4회로 자동 생성/보정
                if (userData.ticketCount === undefined) {
                    await updateDoc(userRef, { ticketCount: 4 });
                    ticketCount = 4;
                } else {
                    ticketCount = userData.ticketCount;
                }

                console.log("Firestore 이름:", userName, "권한:", role, "잔여 횟수:", ticketCount);
            }
        } catch (error) {
            console.log("사용자 정보 불러오기 실패", error);
        }

        // 상단 네비게이션 표시
        if (userInfo) {
            userInfo.style.display = "inline";
            userInfo.innerHTML = `👋 ${userName}님`;
        }

        // ✨ [추가] reservation.html 프로필 카드 요소에 이름 및 잔여 횟수 반영
        if (myUserNameEl) {
            myUserNameEl.innerText = `${userName} 님`;
        }
        if (myTicketCountEl) {
            myTicketCountEl.innerText = `${ticketCount} 회`;
        }

        if (loginLink) loginLink.style.display = "none";
        if (signupLink) signupLink.style.display = "none";
        if (reservationLink) reservationLink.style.display = "inline";
        if (logoutBtn) logoutBtn.style.display = "inline";

        // 관리자 메뉴 처리
        if (role === "admin") {
            if (memberManageLink) memberManageLink.style.display = "inline";
        } else {
            if (memberManageLink) memberManageLink.style.display = "none";
        }

        const guestMenu = document.getElementById("guestMenu");
        const memberMenu = document.getElementById("memberMenu");

        if (guestMenu) guestMenu.style.display = "none";
        if (memberMenu) memberMenu.style.display = "flex";

    } else {
        // 비로그인 상태일 때 초기화
        if (userInfo) userInfo.style.display = "none";
        if (loginLink) loginLink.style.display = "inline";
        if (signupLink) signupLink.style.display = "inline";
        if (reservationLink) reservationLink.style.display = "none";
        if (memberManageLink) memberManageLink.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "none";

        if (myUserNameEl) myUserNameEl.innerText = "- 님";
        if (myTicketCountEl) myTicketCountEl.innerText = "- 회";
    }
});
