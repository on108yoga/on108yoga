import { db, auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

// KST 날짜 변환 함수
function getTodayKST() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const dateKST = new Date(now.getTime() - offset);
    return dateKST.toISOString().split('T')[0];
}

// 특정 날짜 기준 주간(일~토) 7일 날짜 배열 구하기
function getWeekDates(startDateStr) {
    const curr = new Date(startDateStr);
    const dayOfWeek = curr.getDay(); // 0(일) ~ 6(토)
    
    // 주 시작일(일요일) 구하기
    const sunday = new Date(curr);
    sunday.setDate(curr.getDate() - dayOfWeek);

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        weekDates.push(`${yyyy}-${mm}-${dd}`);
    }
    return weekDates;
}

document.addEventListener("DOMContentLoaded", () => {
    const today = getTodayKST();
    const dateInput = document.getElementById("startDate");
    
    if (dateInput) {
        dateInput.value = today;
        loadWeeklyReservations(today);
    }

    document.getElementById("loadBtn")?.addEventListener("click", () => {
        if (dateInput && dateInput.value) {
            loadWeeklyReservations(dateInput.value);
        }
    });
});

// 주간 예약 목록 데이터 가져오기
async function loadWeeklyReservations(baseDateStr) {
    const container = document.getElementById("weeklyReservationContainer");
    const weekRangeText = document.getElementById("weekRangeText");
    if (!container) return;

    container.innerHTML = "<p class='empty-msg'>1주일 예약 내역을 불러오는 중...</p>";

    const weekDates = getWeekDates(baseDateStr); // [일, 월, 화, 수, 목, 금, 토]
    if (weekRangeText) {
        weekRangeText.innerText = `(${weekDates[0]} ~ ${weekDates[6]})`;
    }

    try {
        // 1. 7일 치 예약 데이터 한 번에 조회
        const q = query(
            collection(db, "reservations"),
            where("date", "in", weekDates)
        );
        const snapshot = await getDocs(q);

        // 2. [날짜][시간] 형태로 맵 구조 생성
        const reservationMap = {};
        weekDates.forEach(d => { reservationMap[d] = {}; });

        // 회원 정보 수집 (중복 유저 조회 최소화)
        const uidsToFetch = new Set();
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.date && reservationMap[data.date]) {
                const time = data.time || "시간 미지정";
                if (!reservationMap[data.date][time]) {
                    reservationMap[data.date][time] = [];
                }
                reservationMap[data.date][time].push(data);
                if (data.uid) uidsToFetch.add(data.uid);
            }
        });

        // 3. 회원별 사용/남은 횟수 정보 캐싱
        const userCache = {};
        for (const uid of uidsToFetch) {
            try {
                const uSnap = await getDoc(doc(db, "users", uid));
                if (uSnap.exists()) {
                    const uData = uSnap.data();
                    userCache[uid] = {
                        usedCount: uData.usedCount ?? uData.usedTickets ?? uData.used ?? 0,
                        remainingCount: uData.remainingCount ?? uData.ticketCount ?? uData.remCount ?? 0
                    };
                }
            } catch (e) {
                console.error(`UID(${uid}) 가져오기 실패:`, e);
            }
        }

        container.innerHTML = ""; // 초기화

        // 4. 일~토 7개 컬럼 화면에 생성
        weekDates.forEach((dateStr, index) => {
            const dayCol = document.createElement("div");
            dayCol.className = "day-column";

            const dayName = DAY_NAMES[index];
            const dateShort = dateStr.substring(5); // MM-DD

            let timesHtml = "";
            const timesObj = reservationMap[dateStr];
            const sortedTimes = Object.keys(timesObj).sort();

            if (sortedTimes.length === 0) {
                timesHtml = `<p style="font-size:12px; color:#9ca3af; text-align:center; margin-top:20px;">예약 없음</p>`;
            } else {
                sortedTimes.forEach(time => {
                    const members = timesObj[time];
                    let memberListHtml = "";

                    members.forEach((m, idx) => {
                        const name = m.userName || m.name || '회원';
                        const userInfo = userCache[m.uid] || { usedCount: 0, remainingCount: 0 };

                        memberListHtml += `
                            <li>
                                <strong>${idx + 1}. ${name}</strong>
                                <div class="count-badge">(${userInfo.usedCount}회 / ${userInfo.remainingCount}회)</div>
                            </li>
                        `;
                    });

                    timesHtml += `
                        <div class="time-slot">
                            <div class="time-title">⏰ ${time} (${members.length}명)</div>
                            <ul class="member-item-list">
                                ${memberListHtml}
                            </ul>
                        </div>
                    `;
                });
            }

            dayCol.innerHTML = `
                <div class="day-header">
                    <span>${dayName}요일</span>
                    <span class="date-sub">${dateShort}</span>
                </div>
                ${timesHtml}
            `;

            container.appendChild(dayCol);
        });

    } catch (error) {
        console.error("주간 예약 조회 오류:", error);
        container.innerHTML = "<p class='empty-msg' style='color:red;'>주간 예약 내역을 불러오지 못했습니다.</p>";
    }
}

// 권한 체크
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
    }
});
