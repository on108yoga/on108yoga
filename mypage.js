import { db } from './firebase-config.js'; // 본인의 설정 파일 경로로 맞추세요
// getDoc 대신 실시간 연동을 위해 onSnapshot을 추가합니다.
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.15.0firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const auth = getAuth();

// [중요] 사용자가 로그인했는지 감지한 후 실시간 연동을 시작합니다.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Firebase Auth의 고유 UID 기준 연동
        const currentUserId = user.uid; 
        
        // 실시간 연동 시작
        initRealtimeMyPage(currentUserId);
    } else {
        alert("로그인이 만료되었거나 정보가 없습니다. 로그인 페이지로 이동합니다.");
        window.location.href = "index.html"; // 로그인 페이지 경로
    }
});

// 관리자 변경 사항을 실시간으로 감시하는 함수
function initRealtimeMyPage(userId) {
    const userDocRef = doc(db, 'users', userId);

    // onSnapshot은 데이터가 바뀌면 자동으로 콜백 함수를 실행합니다 (새로고침 필요 없음)
    onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();

            // 1. 회원 이름 반영
            const userNameElem = document.getElementById('user-name');
            if (userNameElem) userNameElem.innerText = data.name || "회원";

            // 2. 이용권 정보 맵핑 (관리자 필드명과 100% 일치 확인)
            const ticketNameElem = document.getElementById('ticket-name');
            const totalCountElem = document.getElementById('total-count');
            const remainingCountElem = document.getElementById('remaining-count');
            const startDateElem = document.getElementById('start-date');
            const endDateElem = document.getElementById('end-date');

            if (data.ticketType && data.ticketType !== "") {
                if (ticketNameElem) {
                    ticketNameElem.innerText = data.ticketType;
                    ticketNameElem.style.color = "var(--primary-color)";
                }
                if (totalCountElem) totalCountElem.innerText = `${data.totalCount || 0}회`;
                
                // remainingCount 필드 매칭 (reservation.js와 동일)
                const remCount = data.remainingCount ?? data.ticketCount ?? data.remCount ?? 0;
                if (remainingCountElem) remainingCountElem.innerText = `${remCount}회`;

                if (startDateElem) startDateElem.innerText = data.startDate || "-";
                if (endDateElem) endDateElem.innerText = data.endDate || "-";
            } else {
                // 관리자가 '이용권 리셋'을 눌러서 ticketType이 ""이 된 경우 처리
                if (ticketNameElem) {
                    ticketNameElem.innerText = "보유하신 이용권이 없습니다.";
                    ticketNameElem.style.color = "#6b7280";
                }
                if (totalCountElem) totalCountElem.innerText = "0회";
                if (remainingCountElem) remainingCountElem.innerText = "0회";
                if (startDateElem) startDateElem.innerText = "-";
                if (endDateElem) endDateElem.innerText = "-";
            }

            // 3. 취소 정책 실시간 반영 (A안 - 총 취소 횟수)
            const totalCancel = data.totalCancelLimit || data.totalCancel || 0;
            const remainingCancel = data.remainingCancelCount || data.remainingCancel || 0;

            const totalCancelElem = document.getElementById('total-cancel');
            const remainingCancelElem = document.getElementById('remaining-cancel');

            if (totalCancelElem) totalCancelElem.innerText = `${totalCancel}회`;
            if (remainingCancelElem) {
                remainingCancelElem.innerText = `${remainingCancel}회`;
                if (remainingCancel <= 0) {
                    remainingCancelElem.classList.add('danger');
                } else {
                    remainingCancelElem.classList.remove('danger');
                }
            }

            // 4. 취소 정책 실시간 반영 (B안 - 당일 취소 횟수)
            const totalTodayCancel = data.totalTodayCancelLimit || data.totalTodayCancel || 0;
            const remainingTodayCancel = data.remainingTodayCancelCount || data.remainingTodayCancel || 0;

            const totalTodayCancelElem = document.getElementById('total-today-cancel');
            const remainingTodayCancelElem = document.getElementById('remaining-today-cancel');

            if (totalTodayCancelElem) totalTodayCancelElem.innerText = `${totalTodayCancel}회`;
            if (remainingTodayCancelElem) {
                remainingTodayCancelElem.innerText = `${remainingTodayCancel}회`;
                if (remainingTodayCancel <= 0) {
                    remainingTodayCancelElem.classList.add('danger');
                } else {
                    remainingTodayCancelElem.classList.remove('danger');
                }
            }

        } else {
            // 🔥 오타 수정: console.error
            console.error("Firestore에 해당 유저 문서가 존재하지 않습니다.");
        }
    }, (error) => {
        console.error("실시간 데이터 연동 중 오류 발생:", error);
    });
}
