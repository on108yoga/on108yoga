import { db } from './firebase-config.js'; // 본인의 설정 파일 경로로 맞추세요
// getDoc 대신 실시간 연동을 위해 onSnapshot을 추가합니다.
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const auth = getAuth();

// [중요] 사용자가 로그인했는지 감지한 후 실시간 연동을 시작합니다.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // 1. 관리자 페이지와 연동 규격을 맞춥니다.
        // 만약 관리자에서 문서 ID를 '전화번호'로 쓰고 있다면 user.uid 대신 회원의 전화번호 필드를 탐색해야 합니다.
        // 여기서는 기본적으로 Firebase Auth의 고유 UID를 기준으로 연동합니다.
        const currentUserId = user.uid; 
        
        // 실시간 연동 시작
        initRealtimeMyPage(currentUserId);
    } else {
        alert("로그인이 만료되었거나 정보가 없습니다. 로그인 페이지로 이동합니다.");
        window.location.href = "login.html"; // 로그인 페이지 경로에 맞게 수정
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
            document.getElementById('user-name').innerText = data.name || "회원";

            // 2. 이용권 정보 맵핑 (관리자 필드명과 100% 일치 확인)
            if (data.ticketType && data.ticketType !== "") {
                document.getElementById('ticket-name').innerText = data.ticketType;
                document.getElementById('ticket-name').style.color = "var(--primary-color)";
                document.getElementById('total-count').innerText = `${data.totalCount || 0}회`;
                document.getElementById('remaining-count').innerText = `${data.remainingCount || 0}회`;
                document.getElementById('start-date').innerText = data.startDate || "-";
                document.getElementById('end-date').innerText = data.endDate || "-";
            } else {
                // 관리자가 '이용권 리셋'을 눌러서 ticketType이 ""이 된 경우 처리
                document.getElementById('ticket-name').innerText = "보유하신 이용권이 없습니다.";
                document.getElementById('ticket-name').style.color = "#6b7280";
                document.getElementById('total-count').innerText = "0회";
                document.getElementById('remaining-count').innerText = "0회";
                document.getElementById('start-date').innerText = "-";
                document.getElementById('end-date').innerText = "-";
            }

            // 3. 취소 정책 실시간 반영 (A안 - 총 취소 횟수)
            const totalCancel = data.totalCancelLimit || 0;
            const remainingCancel = data.remainingCancelCount || 0;
            document.getElementById('total-cancel').innerText = `${totalCancel}회`;
            document.getElementById('remaining-cancel').innerText = `${remainingCancel}회`;
            
            if (remainingCancel === 0) {
                document.getElementById('remaining-cancel').classList.add('danger');
            } else {
                document.getElementById('remaining-cancel').classList.remove('danger');
            }

            // 4. 취소 정책 실시간 반영 (B안 - 당일 취소 횟수)
            const totalTodayCancel = data.totalTodayCancelLimit || 0;
            const remainingTodayCancel = data.remainingTodayCancelCount || 0;
            document.getElementById('total-today-cancel').innerText = `${totalTodayCancel}회`;
            document.getElementById('remaining-today-cancel').innerText = `${remainingTodayCancel}회`;

            if (remainingTodayCancel === 0) {
                document.getElementById('remaining-today-cancel').classList.add('danger');
            } else {
                document.getElementById('remaining-today-cancel').classList.remove('danger');
            }

        } else {
            console.error("Firestore에 해당 유저 문서가 존재하지 않습니다.");
        }
    }, (error) => {
        console.error("실시간 데이터 연동 중 오류 발생:", error);
    });
}
