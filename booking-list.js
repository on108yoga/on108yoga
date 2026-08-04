import { db, auth } from "./firebase.js";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// 오늘 날짜 기본값 세팅 (YYYY-MM-DD)
document.addEventListener("DOMContentLoaded", () => {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById("searchDate");
    if (dateInput) {
        dateInput.value = today;
        loadAdminReservations(today);
    }

    document.getElementById("loadBtn")?.addEventListener("click", () => {
        loadAdminReservations(dateInput.value);
    });
});

// 관리자용 특정 날짜 예약 목록 조회 함수
async function loadAdminReservations(selectedDate) {
    const container = document.getElementById("reservationContainer");
    if (!container) return;

    container.innerHTML = "<p class='empty-msg'>예약 내역을 불러오는 중...</p>";

    try {
        // 1. 해당 날짜의 예약 전체 조회
        const q = query(
            collection(db, "reservations"),
            where("date", "==", selectedDate)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `<p class='empty-msg'>${selectedDate}에는 예약된 수업이 없습니다.</p>`;
            return;
        }

        // 2. 시간대별로 데이터 정리 (그룹핑)
        const groupedByTime = {};

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const time = data.time;

            if (!groupedByTime[time]) {
                groupedByTime[time] = [];
            }
            groupedByTime[time].push({
                id: docSnap.id,
                ...data
            });
        });

        // 3. 시간순 정렬
        const sortedTimes = Object.keys(groupedByTime).sort();

        container.innerHTML = ""; // 기존 내용 초기화

        // 4. 시간대별 카드 UI 생성
        sortedTimes.forEach(time => {
            const members = groupedByTime[time];

            const card = document.createElement("div");
            card.className = "time-slot-card";

            let membersHtml = "";
            members.forEach((m, idx) => {
                membersHtml += `
                    <li class="member-item">
                        <div>
                            <strong>${idx + 1}. ${m.name || '회원'}</strong> 
                            <span style="font-size: 12px; color: #6b7280; margin-left: 8px;">(UID: ${m.uid.substring(0, 6)}...)</span>
                        </div>
                    </li>
                `;
            });

            card.innerHTML = `
                <div class="slot-header">
                    <span>⏰ ${time} 수업</span>
                    <span>총 ${members.length}명 예약</span>
                </div>
                <ul class="member-list">
                    ${membersHtml}
                </ul>
            `;

            container.appendChild(card);
        });

    } catch (error) {
        console.error("관리자 예약 조회 오류:", error);
        container.innerHTML = "<p class='empty-msg' style='color:red;'>예약 목록을 불러오지 못했습니다.</p>";
    }
}

// 관리자 페이지 접근 권한 체크 예시
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("로그인이 필요합니다.");
        location.href = "./index.html";
        return;
    }

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists() || userSnap.data().role !== "admin") {
        alert("관리자만 접근할 수 있는 페이지입니다.");
        location.href = "./index.html";
    }
});
