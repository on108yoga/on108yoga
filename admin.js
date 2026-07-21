// admin.js
console.log("admin.js 실행 (v12.15.0)");

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
    doc,
    getDoc,
    getDocs,
    collection,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";


// ==========================
// 관리자 권한 확인 및 초기화
// ==========================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("로그인이 필요합니다.");
        location.href = "login.html";
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
            alert("회원정보가 없습니다.");
            location.href = "index.html";
            return;
        }

        const data = userDoc.data();

        // 관리자 확인
        if (data.role !== "admin") {
            alert("관리자만 접근 가능합니다.");
            location.href = "index.html";
            return;
        }

        console.log("관리자 로그인 :", data.name);

        // ✅ 관리자 인증 완료 후 전체 회원 목록 불러오기 실행
        loadUserList();

    } catch (error) {
        console.error("권한 확인 실패:", error);
        alert("권한 확인 중 오류가 발생했습니다.");
        location.href = "index.html";
    }
});


// ==========================
// 전체 회원 목록 불러오기
// ==========================
async function loadUserList() {
    const userListContainer = document.getElementById("userList");
    if (!userListContainer) return;

    userListContainer.innerHTML = "<tr><td colspan='4'>회원 목록을 불러오는 중...</td></tr>";

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        userListContainer.innerHTML = ""; // 기존 목록 초기화

        if (querySnapshot.empty) {
            userListContainer.innerHTML = "<tr><td colspan='4'>가입된 회원이 없습니다.</td></tr>";
            return;
        }

        querySnapshot.forEach((userDoc) => {
            const userData = userDoc.data();
            const uid = userDoc.id;

            // 이름 및 이메일
            const name = userData.name || userData.displayName || "이름 없음";
            const email = userData.email || "이메일 없음";

            // 횟수권 통합 조회 (ticketCount 우선 > remCount > remainingCount)
            let ticketCount = 0;
            if (userData.ticketCount !== undefined) {
                ticketCount = userData.ticketCount;
            } else if (userData.remCount !== undefined) {
                ticketCount = userData.remCount;
            } else if (userData.remainingCount !== undefined) {
                ticketCount = userData.remainingCount;
            }

            // HTML 테이블 행 생성 (HTML 구조에 맞춰 조정 가능)
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${name}</td>
                <td>${email}</td>
                <td>
                    <input type="number" id="input-${uid}" value="${ticketCount}" style="width: 60px; text-align: center; padding: 4px; border: 1px solid #ccc; border-radius: 4px;" min="0"> 회
                </td>
                <td>
                    <button type="button" onclick="updateUserTicket('${uid}')" style="background:#3b82f6; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
                        저장
                    </button>
                </td>
            `;

            userListContainer.appendChild(tr);
        });

    } catch (error) {
        console.error("회원 목록 불러오기 실패:", error);
        userListContainer.innerHTML = "<tr><td colspan='4'>회원 목록을 불러오지 못했습니다.</td></tr>";
    }
}


// ==========================
// 회원 횟수 수정/충전 (예약 페이지와 연동 핵심)
// ==========================
window.updateUserTicket = async function(uid) {
    const inputEl = document.getElementById(`input-${uid}`);
    if (!inputEl) return;

    const newTicketCount = Number(inputEl.value);

    if (isNaN(newTicketCount) || newTicketCount < 0) {
        alert("올바른 횟수를 입력해 주세요.");
        return;
    }

    const ok = confirm(`해당 회원의 이용권을 [ ${newTicketCount}회 ]로 변경하시겠습니까?`);
    if (!ok) return;

    try {
        const userRef = doc(db, "users", uid);

        // ✨ 예약페이지와 완전 연동되도록 'ticketCount' 필드로 저장
        await updateDoc(userRef, {
            ticketCount: newTicketCount
        });

        alert("횟수가 성공적으로 수정되었습니다.");
        loadUserList(); // 목록 새로고침

    } catch (error) {
        console.error("횟수 수정 실패:", error);
        alert("횟수 수정 중 오류가 발생했습니다.");
    }
};


// ==========================
// 로그아웃
// ==========================
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.onclick = async () => {
        await signOut(auth);
        alert("로그아웃 되었습니다.");
        location.href = "index.html";
    };
}
