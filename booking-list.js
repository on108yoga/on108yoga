import { db, auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ─── [1] 한국 표준시(KST YYYY-MM-DD) 반환 함수 ───
function getTodayKST() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const dateKST = new Date(now.getTime() - offset);
    return dateKST.toISOString().split('T')[0];
}

// ─── [2] DOM 로드 완료 후 초기화 ───
document.addEventListener("DOMContentLoaded", () => {
    // 1. 날짜별 예약 현황 초기화
    const today = getTodayKST();
    const dateInput = document.getElementById("searchDate");
    
    if (dateInput) {
        dateInput.value = today;
        loadAdminReservations(today);
    }

    document.getElementById("loadBtn")?.addEventListener("click", () => {
        if (dateInput) {
            loadAdminReservations(dateInput.value);
        }
    });

    // 2. 실시간 최근 수강신청 데이터 감시
    initRecentReservations();
});

// ─── [3] 실시간 최근 수강신청 표(최신 5건) 출력 ───
function initRecentReservations() {
    const recentTbody = document.getElementById('recentTbody');
    if (!recentTbody) return;

    // 최신순(timestamp 내림차순)으로 상위 5개 실시간 수신
    const q = query(
        collection(db, 'event_reservations'), 
        orderBy('timestamp', 'desc'), 
        limit(5)
    );
    
    onSnapshot(q, (snapshot) => {
        recentTbody.innerHTML = '';
        
        if (snapshot.empty) {
            recentTbody.innerHTML = `<tr><td colspan="4" class="empty-msg">최근 신청 건이 없습니다.</td></tr>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const statusBadge = item.status === 'approved' 
                ? `<span class="badge badge-approved">승인</span>` 
                : `<span class="badge badge-pending">대기중</span>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.createdAt || '-'}</td>
                <td>${item.phone || item.name || '미입력'}</td>
                <td style="font-weight:500; color:#517e73;">${item.actualTicket || item.eventOption || '-'}</td>
                <td>${statusBadge}</td>
            `;
            recentTbody.appendChild(tr);
        });
    }, (error) => {
        console.error("최근 신청 내역 수신 실패:", error);
        recentTbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="color:red;">데이터를 불러오지 못했습니다.</td></tr>`;
    });
}

// ─── [4] 관리자용 특정 날짜 수업 예약 목록 조회 ───
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

        // 2. 시간대별로 데이터 그룹핑
        const groupedByTime = {};

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const time = data.time || "시간 미지정";

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
        for (const time of sortedTimes) {
            const members = groupedByTime[time];

            const card = document.createElement("div");
            card.className = "time-slot-card";

            let membersHtml = "";

            // 회원의 최신 정보(사용/남은 횟수) 조회
            for (let idx = 0; idx < members.length; idx++) {
                const m = members[idx];
                let usedCount = 0;
                let remainingCount = 0;

                if (m.uid) {
                    try {
                        const userSnap = await getDoc(doc(db, "users", m.uid));
                        if (userSnap.exists()) {
                            const uData = userSnap.data();
                            
                            // 사용 횟수 필드 체크
                            usedCount = uData.usedCount ?? uData.usedTickets ?? uData.used ?? 0;
                            
                            // 남은 횟수 필드 체크
                            remainingCount = uData.remainingCount ?? uData.ticketCount ?? uData.remCount ?? 0;
                        }
                    } catch (e) {
                        console.error(`회원(${m.uid}) 정보 조회 실패:`, e);
                    }
                }

                const name = m.userName || m.name || '회원';
                const phoneText = m.phone ? ` / 📞 ${m.phone}` : "";

                membersHtml += `
                    <li class="member-item">
                        <div>
                            <strong>${idx + 1}. ${name}</strong> 
                            <span style="font-size: 13px; color: #2563eb; font-weight: 600; margin-left: 6px;">
                                (${usedCount}회 사용 / ${remainingCount}회 남음)
                            </span>
                            <span style="font-size: 12px; color: #6b7280; margin-left: 8px;">
                                ${phoneText} (UID: ${m.uid ? m.uid.substring(0, 6) : '---'}...)
                            </span>
                        </div>
                    </li>
                `;
            }

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
        }

    } catch (error) {
        console.error("관리자 예약 조회 오류:", error);
        container.innerHTML = "<p class='empty-msg' style='color:red;'>예약 목록을 불러오지 못했습니다.</p>";
    }
}

// ─── [5] 관리자 접근 권한 검증 ───
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("로그인이 필요합니다.");
        location.href = "./index.html";
        return;
    }

    try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists() || userSnap.data().role !== "admin") {
            alert("관리자만 접근할 수 있는 페이지입니다.");
            location.href = "./index.html";
        }
    } catch (err) {
        console.error("권한 체크 실패:", err);
        alert("권한 확인 중 오류가 발생했습니다.");
        location.href = "./index.html";
    }
});
