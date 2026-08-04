// reservation.js
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
    runTransaction,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

let selectedDate = "";
let selectedTime = "";
let unsubscribeUser = null;

const MAX_PEOPLE = 10;
const DEFAULT_INITIAL_TICKETS = 4; // 신규 회원 기본 부여 횟수

// 수업시간표 수정가능란
const weeklySchedule = {
    0: [],
    1: ["교정하타 (09:30)", "힐링빈야사 (11:00)", "힐링빈야사 (18:00)", "교정하타 (19:30)"],
    2: ["교정하타 (14:00)", "힐링빈야사 (15:30)", "교정하타 (18:00)", "힐링빈야사 (19:30)"],
    3: ["힐링빈야사 (09:30)", "교정하타 (11:00)", "힐링빈야사 (18:00)", "교정하타 (19:30)"],
    4: ["힐링빈야사 (14:00)", "교정하타 (15:30)", "교정하타 (18:00)", "힐링빈야사 (19:30)"],
    5: ["교정하타 (09:30)", "힐링빈야사 (11:00)", "힐링빈야사 (18:00)", "교정하타 (19:30)"],
    6: []
};

// 1. 오늘 날짜 구하기 (YYYY-MM-DD)
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 2. 현재 시간 구하기 (HH:MM)
function getCurrentTimeString() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// 3. 사용자 프로필 & 잔여 횟수 실시간 바인딩
function listenUserProfile(user) {
    if (!user) return;
    if (unsubscribeUser) unsubscribeUser();

    const nameElement = document.getElementById("myUserName");
    const countElement = document.getElementById("myTicketCount");

    const userDocRef = doc(db, "users", user.uid);
    unsubscribeUser = onSnapshot(userDocRef, (userSnap) => {
        let userName = user.displayName || "회원";
        let remCount = DEFAULT_INITIAL_TICKETS;

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.name) userName = userData.name;

            if (userData.remainingCount !== undefined) remCount = Number(userData.remainingCount);
            else if (userData.ticketCount !== undefined) remCount = Number(userData.ticketCount);
            else if (userData.remCount !== undefined) remCount = Number(userData.remCount);
        }

        if (nameElement) nameElement.innerText = `${userName} 님`;
        if (countElement) countElement.innerText = `${remCount} 회`;
    }, (err) => {
        console.error("사용자 정보 수신 실패:", err);
    });
}

// 4. 날짜 선택 (calendar.js에서 호출)
window.setSelectedDate = function(date) {
    selectedDate = date;
    selectedTime = "";
    
    const dateDisplay = document.getElementById("selectedDate");
    if (dateDisplay) dateDisplay.innerText = date;

    renderTimeButtons(selectedDate);
    loadReservationCounts();
};

// 5. 시간 버튼 랜더링 (지난 시간 회색 비활성화)
function renderTimeButtons(selectedDateStr) {
    const container = document.getElementById('timeButtons');
    if (!container || !selectedDateStr) return;

    const [year, month, day] = selectedDateStr.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const availableTimes = weeklySchedule[dayOfWeek] || [];

    container.innerHTML = '';

    if (availableTimes.length === 0) {
        container.innerHTML = `<p style="color:#9ca3af; font-size:14px;">해당 요일은 수업이 없습니다.</p>`;
        return;
    }

    const todayStr = getTodayString();
    const currentTimeStr = getCurrentTimeString();

    availableTimes.forEach(time => {
        const timeId = time.replace(":", "");
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'time-btn';
        button.dataset.time = time;
        button.innerHTML = `${time} (예약 <span id="count${timeId}">0</span> / ${MAX_PEOPLE}명)`;

        const formattedTime = time.length === 4 ? `0${time}` : time;
        const isPast = (selectedDateStr === todayStr && formattedTime <= currentTimeStr);

        if (isPast) {
            button.classList.add('disabled');
            button.disabled = true;
            button.style.cssText = "background-color: #e5e7eb; color: #9ca3af; border-color: #d1d5db; cursor: not-allowed; opacity: 0.7;";
        } else {
            button.addEventListener('click', () => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected', 'active'));
                button.classList.add('selected', 'active');
                selectedTime = time;
            });
        }

        container.appendChild(button);
    });
}

// 6. 타임별 인원 수 표시
async function loadReservationCounts() {
    if (!selectedDate) return;

    const [year, month, day] = selectedDate.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const targetSchedule = weeklySchedule[dayOfWeek] || [];

    for (const time of targetSchedule) {
        try {
            const q = query(
                collection(db, "reservations"),
                where("date", "==", selectedDate),
                where("time", "==", time)
            );
            const snapshot = await getDocs(q);
            const element = document.getElementById("count" + time.replace(":", ""));
            if (element) element.innerText = snapshot.size;
        } catch (e) {
            console.error(e);
        }
    }
}

// 7. 내 예약 목록 불러오기
async function loadMyReservation() {
    const user = auth.currentUser;
    if (!user) return;

    const box = document.getElementById("myReservations");
    if (!box) return;

    box.innerHTML = `<h3 style="font-size:16px; font-weight:bold; margin-bottom:10px; color:#111827;">🗓️ 내 예약 현황</h3>`;

    try {
        const q = query(
            collection(db, "reservations"),
            where("uid", "==", user.uid)
        );

        const snapshot = await getDocs(q);
        const todayStr = getTodayString();
        const currentTimeStr = getCurrentTimeString();

        let validReservations = [];

        snapshot.forEach(item => {
            const data = item.data();
            const formattedTime = data.time.length === 4 ? `0${data.time}` : data.time;

            const isFutureDate = data.date > todayStr;
            const isTodayUpcoming = (data.date === todayStr && formattedTime >= currentTimeStr);

            if (isFutureDate || isTodayUpcoming) {
                validReservations.push({ id: item.id, ...data });
            }
        });

        validReservations.sort((a, b) => {
            if (a.date === b.date) return a.time.localeCompare(b.time);
            return a.date.localeCompare(b.date);
        });

        if (validReservations.length === 0) {
            box.innerHTML += `<p style="color:#9ca3af; font-size:14px; margin-top:6px;">예약된 내역이 없습니다.</p>`;
            return;
        }

        const listContainer = document.createElement("div");
        listContainer.style.cssText = "display:flex; flex-direction:column; gap:8px;";

        validReservations.forEach(res => {
            const itemDiv = document.createElement("div");
            itemDiv.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:12px; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 1px 2px rgba(0,0,0,0.05);";

            itemDiv.innerHTML = `
                <div>
                    <span style="font-size:14px; font-weight:600; color:#111827;">${res.date}</span>
                    <span style="font-size:14px; font-weight:bold; color:#4f46e5; margin-left:6px;">(${res.time})</span>
                </div>
                <button type="button" class="cancel-btn" style="background:#fee2e2; color:#ef4444; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;">
                    예약 취소
                </button>
            `;

            const cancelBtn = itemDiv.querySelector(".cancel-btn");
            cancelBtn.addEventListener("click", async (e) => {
                const btn = e.target;
                btn.disabled = true;
                btn.style.background = "#e5e7eb";
                btn.style.color = "#6b7280";
                btn.style.cursor = "not-allowed";
                btn.innerText = "취소 중...";

                await cancelReservation(res.id);
            });

            listContainer.appendChild(itemDiv);
        });

        box.appendChild(listContainer);

    } catch (error) {
        console.error("내 예약 불러오기 오류:", error);
    }
}

// 8. 예약 처리 함수 (usedCount +1 처리 반영)
async function handleReservation() {
    const user = auth.currentUser;
    if (!user) {
        alert("로그인 후 이용해 주세요.");
        return;
    }

    if (!selectedDate) {
        alert("날짜를 선택해 주세요.");
        return;
    }

    if (!selectedTime) {
        alert("시간을 선택해 주세요.");
        return;
    }

    const todayStr = getTodayString();
    const currentTimeStr = getCurrentTimeString();
    const formattedSelectedTime = selectedTime.length === 4 ? `0${selectedTime}` : selectedTime;
    
    if (selectedDate === todayStr && formattedSelectedTime <= currentTimeStr) {
        alert("이미 지나간 시간은 예약할 수 없습니다.");
        return;
    }

    try {
        const dupQuery = query(
            collection(db, "reservations"),
            where("uid", "==", user.uid),
            where("date", "==", selectedDate),
            where("time", "==", selectedTime)
        );
        const dupSnap = await getDocs(dupQuery);
        if (!dupSnap.empty) {
            alert("이미 해당 시간대에 예약 신청하셨습니다.");
            return;
        }

        const userDocRef = doc(db, "users", user.uid);

        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userDocRef);

            if (!userSnap.exists()) {
                throw new Error("사용자 정보를 찾을 수 없습니다.");
            }

            const userData = userSnap.data();
            let userName = userData.name || user.displayName || "회원";
            let countFieldName = "remainingCount";
            let remCount = 0;
            let currentUsedCount = Number(userData.usedCount ?? userData.usedTickets ?? userData.used ?? 0);

            if (userData.remainingCount !== undefined) {
                remCount = Number(userData.remainingCount);
                countFieldName = "remainingCount";
            } else if (userData.ticketCount !== undefined) {
                remCount = Number(userData.ticketCount);
                countFieldName = "ticketCount";
            } else if (userData.remCount !== undefined) {
                remCount = Number(userData.remCount);
                countFieldName = "remCount";
            } else {
                remCount = typeof DEFAULT_INITIAL_TICKETS !== 'undefined' ? DEFAULT_INITIAL_TICKETS : 0;
            }

            if (remCount <= 0) {
                throw new Error(`NO_TICKETS:남은 이용권 횟수가 없습니다. (현재 잔여: ${remCount}회)`);
            }

            const newResRef = doc(collection(db, "reservations"));

            transaction.set(newResRef, {
                uid: user.uid,
                name: userName,
                date: selectedDate,
                time: selectedTime,
                createdAt: serverTimestamp()
            });

            // 🔥 [중요] 남은 횟수 -1 차감 & 사용 횟수(usedCount) +1 증가
            transaction.update(userDocRef, {
                [countFieldName]: remCount - 1,
                usedCount: currentUsedCount + 1
            });
        });

        alert("🎉 예약이 완벽하게 완료되었습니다!");

        if (typeof loadReservationCounts === 'function') loadReservationCounts();
        if (typeof loadMyReservation === 'function') loadMyReservation();

    } catch (err) {
        console.error("예약 오류 상세:", err);
        
        if (err.message && err.message.startsWith("NO_TICKETS:")) {
            alert(`⚠️ ${err.message.replace("NO_TICKETS:", "")}`);
        } else if (err.message && err.message.includes("사용자 정보")) {
            alert(err.message);
        } else {
            alert(`예약 중 오류가 발생했습니다.\n(${err.message})`);
        }
    }
}

// 9. 예약 취소 함수 (usedCount -1 복구 반영)
async function cancelReservation(resId) {
    if (!confirm("정말 예약을 취소하시겠습니까?")) return;

    const user = auth.currentUser;
    if (!user) {
        alert("로그인 후 이용해 주세요.");
        return;
    }

    try {
        const resDocRef = doc(db, "reservations", resId);
        const userDocRef = doc(db, "users", user.uid);
        const todayStr = getTodayString();

        await runTransaction(db, async (transaction) => {
            const resSnap = await transaction.get(resDocRef);
            if (!resSnap.exists()) {
                throw new Error("ALREADY_CANCELLED");
            }

            const resData = resSnap.data();
            const isTodayReservation = (resData.date === todayStr);

            const userSnap = await transaction.get(userDocRef);
            if (!userSnap.exists()) {
                throw new Error("USER_NOT_FOUND");
            }

            const userData = userSnap.data();

            let remainingCancel = userData.remainingCancelCount !== undefined 
                ? Number(userData.remainingCancelCount) 
                : Number(userData.remainingCancel ?? 0);

            let remainingTodayCancel = userData.remainingTodayCancelCount !== undefined 
                ? Number(userData.remainingTodayCancelCount) 
                : Number(userData.remainingTodayCancel ?? 0);

            let countFieldName = "remainingCount";
            let remCount = 0;
            let currentUsedCount = Number(userData.usedCount ?? userData.usedTickets ?? userData.used ?? 0);

            if (userData.remainingCount !== undefined) {
                countFieldName = "remainingCount";
                remCount = Number(userData.remainingCount);
            } else if (userData.ticketCount !== undefined) {
                countFieldName = "ticketCount";
                remCount = Number(userData.ticketCount);
            } else if (userData.remCount !== undefined) {
                countFieldName = "remCount";
                remCount = Number(userData.remCount);
            }

            if (remainingCancel <= 0) {
                throw new Error("NO_TOTAL_CANCEL:총 취소 가능 횟수를 모두 소진하셨습니다.");
            }

            if (isTodayReservation && remainingTodayCancel <= 0) {
                throw new Error("NO_TODAY_CANCEL:당일 취소 가능 횟수를 모두 소진하셨습니다.");
            }

            transaction.delete(resDocRef);

            const cancelFieldName = userData.remainingCancelCount !== undefined ? "remainingCancelCount" : "remainingCancel";
            const todayCancelFieldName = userData.remainingTodayCancelCount !== undefined ? "remainingTodayCancelCount" : "remainingTodayCancel";

            // 🔥 [중요] 이용권 +1 복구 & 사용 횟수(usedCount) -1 차감 (최소값 0 유지)
            const userUpdates = {
                [countFieldName]: remCount + 1,
                usedCount: Math.max(0, currentUsedCount - 1),
                [cancelFieldName]: remainingCancel - 1
            };

            if (isTodayReservation) {
                userUpdates[todayCancelFieldName] = remainingTodayCancel - 1;
            }

            transaction.update(userDocRef, userUpdates);
        });

        alert("🎉 예약이 성공적으로 취소되고 이용권 1회가 복구되었습니다.");

        if (typeof loadReservationCounts === 'function') loadReservationCounts();
        if (typeof loadMyReservation === 'function') loadMyReservation();
        if (typeof loadUserProfile === 'function') loadUserProfile();

    } catch (err) {
        console.error("취소 실패 상세:", err);

        if (err.message === "ALREADY_CANCELLED") {
            alert("⚠️ 이미 취소되었거나 존재하지 않는 예약입니다.");
            if (typeof loadMyReservation === 'function') loadMyReservation();
        } else if (err.message.startsWith("NO_TOTAL_CANCEL:") || err.message.startsWith("NO_TODAY_CANCEL:")) {
            alert(`⚠️ ${err.message.split(":")[1]}`);
        } else if (err.message === "USER_NOT_FOUND") {
            alert("사용자 정보를 찾을 수 없습니다.");
        } else {
            alert(`취소 처리 중 오류가 발생했습니다.\n(${err.message})`);
        }
    }
}

// 10. 이벤트 바인딩 및 상태 감시
document.addEventListener("DOMContentLoaded", () => {
    const reserveBtn = document.getElementById("reserveBtn");
    if (reserveBtn) {
        reserveBtn.addEventListener("click", handleReservation);
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        listenUserProfile(user);
        loadMyReservation();
    } else {
        if (unsubscribeUser) unsubscribeUser();
    }
});
