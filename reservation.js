// reservation.js
console.log("reservation.js 실행 (v12.15.0)");

import { auth, db } from "./firebase.js";

import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    getDoc,
    updateDoc,
    increment,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

let selectedDate = "";
let selectedTime = "";
let unsubscribeUser = null; // 실시간 감시 해제용


// 🗓️ 요일별 예약 가능 시간표 정의
const weeklySchedule = {
    0: [], // 일요일: 휴무
    1: ["09:30", "11:00", "18:00", "19:30"], // 월요일
    2: ["14:00", "15:30", "18:00", "19:30"], // 화요일
    3: ["09:30", "11:00", "18:00", "19:30"], // 수요일
    4: ["14:00", "15:30", "18:00", "19:30"], // 목요일
    5: ["09:30", "11:00", "18:00", "19:30"], // 금요일
    6: []  // 토요일: 휴무
};

const MAX_PEOPLE = 10;

const reserveBtn = document.getElementById("reserveBtn");

/*
================================
오늘 날짜 확인 유틸리티 (YYYY-MM-DD)
================================
*/
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/*
================================
인원 표시 초기화 유틸리티
================================
*/
function clearTimeCounts() {
    // 모든 count 스판 태그 초기화
    document.querySelectorAll("[id^='count']").forEach(el => {
        el.innerText = "0";
    });
}

/*
================================
사용자 프로필(성명 + 잔여 횟수) 실시간 불러오기
================================
*/
function listenUserProfile(user) {
    const nameElement = document.getElementById("myUserName");
    const countElement = document.getElementById("myTicketCount");
    if (!user) return;

    if (unsubscribeUser) unsubscribeUser();

    const userDocRef = doc(db, "users", user.uid);

    unsubscribeUser = onSnapshot(userDocRef, (userSnap) => {
        let userName = user.displayName || "회원";
        let remCount = 0;

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.name) userName = userData.name;

            if (userData.remainingCount !== undefined) {
                remCount = Number(userData.remainingCount);
            } else if (userData.ticketCount !== undefined) {
                remCount = Number(userData.ticketCount);
            } else if (userData.remCount !== undefined) {
                remCount = Number(userData.remCount);
            } else {
                remCount = 0;
            }
        }

        if (nameElement) nameElement.innerText = `${userName} 님`;
        if (countElement) countElement.innerText = `${remCount} 회`;
    }, (err) => {
        console.error("사용자 정보 로드 실패:", err);
        if (nameElement) nameElement.innerText = `${user.displayName || '회원'} 님`;
        if (countElement) countElement.innerText = "0 회";
    });
}

/*
================================
날짜 선택 (calendar.js에서 호출함)
================================
*/
window.setSelectedDate = function(date) {
    selectedDate = date;
    selectedTime = ""; // 날짜 변경 시 시간 선택 초기화
    console.log("선택 날짜:", selectedDate);

    const timeContainer = document.getElementById("timeButtons");
    const todayStr = getTodayString();

    // 🛑 주말 및 공휴일 체크
    if (isWeekendOrHoliday(selectedDate)) {
        alert("토요일, 일요일 및 공휴일은 휴무일이므로 예약이 불가능합니다.");
        if (timeContainer) {
            timeContainer.innerHTML = '<p style="color:#ef4444; font-size:14px; margin-top:10px;">휴무일입니다.</p>';
        }
        clearTimeCounts();
        selectedDate = "";
        return;
    }

    // 🛑 지난 날짜 체크
    if (selectedDate < todayStr) {
        alert("지난 날짜는 선택 또는 예약할 수 없습니다.");
        if (timeContainer) {
            timeContainer.innerHTML = '<p style="color:#9ca3af; font-size:14px; margin-top:10px;">지난 날짜는 예약할 수 없습니다.</p>';
        }
        clearTimeCounts();
        selectedDate = "";
        return;
    }

    // 💡 1. 월/수/금 또는 화/목 요일별 시간 버튼 생성
    renderTimeButtons(selectedDate);
    
    // 💡 2. 생성된 버튼 내부 span(#count0930 등)에 DB 인원 수 불러오기
    loadReservation();
};


/* 🗓️ 요일별 예약 가능 시간표 select 옵션 업데이트 (Select 사용 시) */
function renderTimeButtons(selectedDateStr) {
    const container = document.getElementById('timeButtons');
    if (!container || !selectedDateStr) return;

    // 1. 선택된 날짜의 요일 구하기 (KST 시차 문제 방지)
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    const selectedDateObj = new Date(year, month - 1, day);
    const dayOfWeek = selectedDateObj.getDay(); // 0: 일, 1: 월, ... 6: 토

    // 2. 해당 요일의 시간표 배열
    const availableTimes = weeklySchedule[dayOfWeek] || [];

    // 3. 기존 버튼 초기화
    container.innerHTML = '';
    selectedTime = ""; // 선택된 시간 초기화

    // 4. 휴무일 또는 수업이 없는 요일 처리
    if (availableTimes.length === 0) {
        container.innerHTML = `<p class="no-class-text" style="color:#9ca3af; font-size:14px; margin-top:10px;">해당 요일은 수업/예약이 없습니다.</p>`;
        return;
    }

    // 5. 시간대별 버튼 생성
    availableTimes.forEach(time => {
        const timeId = time.replace(":", ""); // 예: "09:30" -> "0930"

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'time-btn';
        button.dataset.time = time;
        button.innerHTML = `${time} (예약 <span id="count${timeId}">0</span> / ${MAX_PEOPLE}명)`;

        // 버튼 클릭 시 활성화 이벤트
        button.addEventListener('click', () => {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected', 'active'));
            button.classList.add('selected', 'active');
            selectedTime = time;
            console.log("선택된 시간:", selectedTime);
        });

        container.appendChild(button);
    });
}

/*
================================
주말 및 공휴일 체크 유틸리티
================================
*/
function isWeekendOrHoliday(dateStr) {
    if (!dateStr) return false;

    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const dayOfWeek = targetDate.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) return true;

    const monthDay = dateStr.slice(5);
    const fixedHolidays = [
        "01-01", "03-01", "05-05", "06-06",
        "08-15", "10-03", "10-09", "12-25"
    ];

    if (fixedHolidays.includes(monthDay)) return true;

    const variableHolidays = [
        "2026-02-16", "2026-02-17", "2026-02-18",
        "2026-05-24",
        "2026-09-24", "2026-09-25", "2026-09-26"
    ];

    if (variableHolidays.includes(dateStr)) return true;

    return false;
}

/*
================================
예약 인원 불러오기 (수정됨 🔥)
================================
*/
async function loadReservation() {
    if (!selectedDate) {
        console.warn("⚠️ selectedDate가 지정되지 않았습니다.");
        return;
    }

    clearTimeCounts();

    // 선택된 날짜의 요일(0~6) 계산 (Timezone 버그 방지)
    const [year, month, day] = selectedDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();

    // 해당 요일에 예약 가능한 시간 배열 가져오기
    const targetSchedule = weeklySchedule[dayOfWeek] || [];

    console.log(`🔍 [예약 현황 조회 시작] 날짜: "${selectedDate}" (요일: ${dayOfWeek})`);

    for (const time of targetSchedule) {
        try {
            const q = query(
                collection(db, "reservations"),
                where("date", "==", selectedDate),
                where("time", "==", time)
            );

            const snapshot = await getDocs(q);
            const count = snapshot.size;

            if (count > 0) {
                console.log(`✅ [매칭 성공] 시간: ${time} -> ${count}명 예약됨`);
            } else {
                console.log(`🔍 시간: ${time} -> 조회결과 0명`);
            }

            const id = "count" + time.replace(":", "");
            const element = document.getElementById(id);

            if (element) {
                element.innerText = count;
            } else {
                console.warn(`⚠️ HTML 요소를 찾을 수 없습니다: id="${id}"`);
            }
        } catch (error) {
            console.error(`🚨 [${time}] 예약 조회 중 오류 발생:`, error);
        }
    }
}

/*
================================
시간 선택 버튼 / Select 이벤트
================================
*/
// 1) 버튼 클릭 방식인 경우
document.querySelectorAll(".time-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".time-btn").forEach(b => {
            b.classList.remove("selected", "active");
        });

        btn.classList.add("selected", "active");
        selectedTime = btn.dataset.time;
    });
});

// 2) Select Dropdown 방식인 경우
const timeSelectEl = document.getElementById("res-time");
if (timeSelectEl) {
    timeSelectEl.addEventListener("change", (e) => {
        selectedTime = e.target.value;
    });
}

/*
================================
예약하기
================================
*/
if (reserveBtn) {
    reserveBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) {
            alert("로그인 후 이용해 주세요.");
            location.href = "index.html";
            return;
        }

        if (!selectedDate) {
            alert("날짜를 선택해 주세요.");
            return;
        }

        if (isWeekendOrHoliday(selectedDate)) {
            alert("토요일, 일요일 및 공휴일은 예약이 불가능합니다.");
            return;
        }

        const todayStr = getTodayString();
        if (selectedDate < todayStr) {
            alert("지난 날짜에는 예약할 수 없습니다.");
            return;
        }

        if (!selectedTime) {
            alert("시간을 선택해 주세요.");
            return;
        }

        try {
            const userDocRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userDocRef);

            if (!userSnap.exists()) {
                alert("회원 정보가 존재하지 않습니다.");
                return;
            }

            const userData = userSnap.data();
            let userName = userData.name || user.displayName || "회원";
            
            let countFieldName = "remainingCount";
            let remCount = 0;

            if (userData.remainingCount !== undefined) {
                remCount = Number(userData.remainingCount);
                countFieldName = "remainingCount";
            } else if (userData.ticketCount !== undefined) {
                remCount = Number(userData.ticketCount);
                countFieldName = "ticketCount";
            } else if (userData.remCount !== undefined) {
                remCount = Number(userData.remCount);
                countFieldName = "remCount";
            }

            if (remCount <= 0) {
                alert(`⚠️ 남은 이용권 횟수가 없습니다. (잔여: ${remCount}회)\n이용권을 충전 후 다시 시도해주세요.`);
                return;
            }

            const duplicateQuery = query(
                collection(db, "reservations"),
                where("uid", "==", user.uid),
                where("date", "==", selectedDate),
                where("time", "==", selectedTime)
            );
            const duplicateSnapshot = await getDocs(duplicateQuery);

            if (!duplicateSnapshot.empty) {
                alert("이미 같은 시간대에 예약한 내역이 있습니다.");
                return;
            }

            const countQuery = query(
                collection(db, "reservations"),
                where("date", "==", selectedDate),
                where("time", "==", selectedTime)
            );
            const countSnapshot = await getDocs(countQuery);

            if (countSnapshot.size >= MAX_PEOPLE) {
                alert("해당 시간대의 예약이 마감되었습니다.");
                return;
            }

            await addDoc(collection(db, "reservations"), {
                uid: user.uid,
                name: userName,
                date: selectedDate,
                time: selectedTime,
                createdAt: serverTimestamp()
            });

            await updateDoc(userDocRef, {
                [countFieldName]: increment(-1)
            });

            alert(`🎉 예약이 완료되었습니다!`);

            loadReservation();
            loadMyReservation();

        } catch (err) {
            console.error("예약 오류:", err);
            alert("예약 처리 중 오류가 발생했습니다.");
        }
    });
}

/*
================================
예약 취소
================================
*/
window.cancelReservation = async function(id) {
    const ok = confirm("예약을 취소하시겠습니까?");
    if (!ok) return;

    try {
        await deleteDoc(doc(db, "reservations", id));

        if (auth.currentUser) {
            const userDocRef = doc(db, "users", auth.currentUser.uid);
            const userSnap = await getDoc(userDocRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                
                let countFieldName = "remainingCount";
                if (userData.remainingCount === undefined) {
                    if (userData.ticketCount !== undefined) countFieldName = "ticketCount";
                    else if (userData.remCount !== undefined) countFieldName = "remCount";
                }

                await updateDoc(userDocRef, {
                    [countFieldName]: increment(1)
                });
            }
        }

        alert("예약이 취소되었습니다.");

        loadReservation();
        loadMyReservation();

    } catch (err) {
        console.error("취소 오류:", err);
        alert("예약 취소 중 오류가 발생했습니다.");
    }
};

/*
================================
내 예약 불러오기
================================
*/
async function loadMyReservation() {
    if (!auth.currentUser) return;

    const box = document.getElementById("myReservations");
    if (!box) return;

    box.innerHTML = "<h3 style='margin-top:20px;'>내 예약 목록</h3>";

    const q = query(
        collection(db, "reservations"),
        where("uid", "==", auth.currentUser.uid)
    );

    const snapshot = await getDocs(q);
    
    const now = new Date();
    const todayStr = getTodayString();
    const currentHoursMinutes = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let count = 0;

    snapshot.forEach(item => {
        const data = item.data();

        const isFutureDate = data.date > todayStr;
        const isTodayUpcoming = (data.date === todayStr && data.time >= currentHoursMinutes);

        if (isFutureDate || isTodayUpcoming) {
            count++;
            box.innerHTML += `
                <div class="my-reservation" style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding:8px 12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px;">
                    <span style="font-size:14px; color:#374151;">🗓️ ${data.date} (${data.time})</span>
                    <button type="button" onclick="cancelReservation('${item.id}')" style="background:#fee2e2; color:#ef4444; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">
                        취소
                    </button>
                </div>
            `;
        }
    });

    if (count === 0) {
        box.innerHTML += "<p style='color:#9ca3af; font-size:13px; margin-top:8px;'>예약된 내역이 없습니다.</p>";
    }
}

/*
================================
로그인 상태 변경 감지
================================
*/
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadMyReservation();
        listenUserProfile(user);
    } else {
        if (unsubscribeUser) unsubscribeUser();
    }
});
