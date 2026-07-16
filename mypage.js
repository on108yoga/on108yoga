import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// DOM 요소 정의
const userNameEl = document.getElementById("user-name");
const userPhoneEl = document.getElementById("user-phone");
const ticketSection = document.getElementById("ticket-section");
const noTicketSection = document.getElementById("no-ticket-section");

const ticketTitleEl = document.getElementById("ticket-title");
const remainingCountEl = document.getElementById("remaining-count");
const totalCountEl = document.getElementById("total-count");
const startDateEl = document.getElementById("start-date");
const endDateEl = document.getElementById("end-date");
const ticketStatusEl = document.getElementById("ticket-status");

// 1. 로그인한 사용자 세션 모니터링
onAuthStateChanged(auth, (user) => {
    if (user) {
        // 로그인된 상태라면 Firestore에서 해당 유저의 문서를 실시간 구독(onSnapshot)합니다.
        const userDocRef = doc(db, "users", user.uid);
        
        onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                renderMyPage(userData);
            } else {
                alert("가입 정보가 유효하지 않습니다. 고객센터에 문의해 주세요.");
                location.href = "index.html";
            }
        });
    } else {
        // 로그인하지 않은 사용자는 로그인 페이지로 튕겨냅니다.
        alert("로그인이 필요한 페이지입니다.");
        location.href = "index.html"; // 본인의 로그인 화면 주소로 맞춰주세요.
    }
});

// 2. 화면에 회원의 이용권 데이터 반영하기
function renderMyPage(user) {
    // 기본 개인정보 노출
    userNameEl.innerText = `${user.name} 회원님`;
    userPhoneEl.innerText = formatPhone(user.phone);

    // 이용권 존재 유무에 따른 분기 처리
    if (user.ticketType && user.totalCount > 0) {
        noTicketSection.style.display = "none";
        ticketSection.style.display = "block";

        ticketTitleEl.innerText = user.ticketType;
        remainingCountEl.innerText = user.remainingCount;
        totalCountEl.innerText = `/ ${user.totalCount}회`;
        startDateEl.innerText = user.startDate;
        endDateEl.innerText = user.endDate;

        // 이용 기간 및 남은 횟수 상태 판별
        const todayStr = new Date().toISOString().split("T")[0];
        if (user.endDate < todayStr) {
            ticketStatusEl.innerText = "기간 만료";
            ticketStatusEl.style.color = "#ef4444"; // 빨간색
        } else if (user.remainingCount <= 0) {
            ticketStatusEl.innerText = "횟수 소진 완료";
            ticketStatusEl.style.color = "#ef4444";
        } else {
            ticketStatusEl.innerText = "이용중";
            ticketStatusEl.style.color = "#10b981"; // 초록색
        }
    } else {
        // 이용권 정보가 없는 회원일 경우
        ticketSection.style.display = "none";
        noTicketSection.style.display = "block";
    }
}

// 전화번호 포맷팅 가이드
function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = ('' + phone).replace(/\D/g, '');
    if (cleaned.length === 11) {
        return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    return phone;
}
