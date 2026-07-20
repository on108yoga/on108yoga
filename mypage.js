// Firebase 필요한 모듈 임포트 (본인 프로젝트 설정에 맞게 경로 확인)
import { db } from './firebase-config.js'; 
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 실제 구현 시에는 로그인된 회원의 UID 또는 저장된 문서 ID(phone 등)를 가져와야 합니다.
// 여기서는 예시로 데모용 active 유저 ID를 정의합니다.
const currentUserId = "01012345678"; // 혹은 auth.currentUser.uid;

async function loadMyPageData() {
    if (!currentUserId) {
        alert("로그인이 필요합니다.");
        return;
    }

    try {
        const userDocRef = doc(db, 'users', currentUserId);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
            const data = userSnap.data();

            // 1. 기본 인적 사항
            document.getElementById('user-name').innerText = data.name || "회원";

            // 2. 이용권 정보 맵핑
            if (data.ticketType) {
                document.getElementById('ticket-name').innerText = data.ticketType;
                document.getElementById('total-count').innerText = `${data.totalCount || 0}회`;
                document.getElementById('remaining-count').innerText = `${data.remainingCount || 0}회`;
                document.getElementById('start-date').innerText = data.startDate || "-";
                document.getElementById('end-date').innerText = data.endDate || "-";
            } else {
                document.getElementById('ticket-name').innerText = "보유하신 이용권이 없습니다.";
                document.getElementById('ticket-name').style.color = "#6b7280";
            }

            // 3. 취소 정책 (A안 - 총 취소 횟수)
            const totalCancel = data.totalCancelLimit || 0;
            const remainingCancel = data.remainingCancelCount || 0;
            document.getElementById('total-cancel').innerText = `${totalCancel}회`;
            document.getElementById('remaining-cancel').innerText = `${remainingCancel}회`;
            
            // 남은 횟수가 0이면 배지 색상을 붉게 변경 (UI 디테일)
            if(remainingCancel === 0) {
                document.getElementById('remaining-cancel').classList.add('danger');
            }

            // 4. 취소 정책 (B안 - 당일 취소 횟수)
            const totalTodayCancel = data.totalTodayCancelLimit || 0;
            const remainingTodayCancel = data.remainingTodayCancelCount || 0;
            document.getElementById('total-today-cancel').innerText = `${totalTodayCancel}회`;
            document.getElementById('remaining-today-cancel').innerText = `${remainingTodayCancel}회`;

            if(remainingTodayCancel > 0) {
                // 당일 취소 여유가 있으면 초록/파란 계열 배지로 유지하기 위해 danger 클래스 제거
                document.getElementById('remaining-today-cancel').classList.remove('danger');
            }

        } else {
            alert("회원 정보가 존재하지 않습니다.");
        }
    } catch (error) {
        console.error("마이페이지 로딩 오류:", error);
    }
}

// 페이지가 로드되면 데이터를 불러옵니다.
window.addEventListener('DOMContentLoaded', loadMyPageData);
