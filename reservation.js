// reservation.js
import { auth, db } from "./firebase.js";
import {
    collection,
    query,
    where,
    doc,
    runTransaction,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

let selectedDate = "";
let selectedTime = "";
let unsubscribeUser = null;
let unsubscribeMyRes = null; // 🔥 내 예약 실시간 리스너
let scheduleUnsubscribes = []; // 🔥 시간표 인원 실시간 리스너 관리 배열

let isReserving = false;
let isCanceling = false; // 중복 취소 실행 방지 플래그

const MAX_PEOPLE = 10;
const DEFAULT_INITIAL_TICKETS = 4; // 신규 회원 기본 부여 횟수

// 수업시간표
const weeklySchedule = {
    0: [],
    1: ["09:30 교정하타", "11:00 힐링빈야사", "18:00 힐링빈야사", "19:30 교정하타"],
    2: ["14:00 교정하타", "15:30 힐링빈야사", "18:00 교정하타", "19:30 힐링빈야사"],
    3: ["09:30 힐링빈야사", "11:00 교정하타", "18:00 힐링빈야사", "19:30 교정하타"],
    4: ["14:00 힐링빈야사", "15:30 교정하타", "18:00 교정하타", "19:30 힐링빈야사"],
    5: ["09:30 교정하타", "11:00 힐링빈야사", "18:00 힐링빈야사", "19:30 교정하타"],
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

// 5. 시간 버튼 랜더링
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
        const timeId = time.replace(":", "").replace(/\s+/g, "");
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'time-btn';
        button.dataset.time = time;
        button.innerHTML = `${time} (예약 <span id="count${timeId}">0</span> / ${MAX_PEOPLE}명)`;

        // 시간 부분만 추출 (예: "09:30 교정하타" -> "09:30")
        const timeOnly = time.split(" ")[0];
        const formattedTime = timeOnly.length === 4 ? `0${timeOnly}` : timeOnly;
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

// 6. 타임별 인원 수 실시간 반영 (onSnapshot 완전 적용)
function loadReservationCounts() {
    // 1) 기존 연결된 실시간 리스너 해제 (메모리 누수 방지)
    scheduleUnsubscribes.forEach(unsub => unsub());
    scheduleUnsubscribes = [];

    if (!selectedDate) return;

    const [year, month, day] = selectedDate.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const targetSchedule = weeklySchedule[dayOfWeek] || [];

    // 2) 타임별로 onSnapshot 리스너 등록
    targetSchedule.forEach(time => {
        const q = query(
            collection(db, "reservations"),
            where("date", "==", selectedDate),
            where("time", "==", time)
        );

        const timeId = time.replace(":", "").replace(/\s+/g, "");

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const countSpan = document.getElementById("count" + timeId);
            if (countSpan) {
                countSpan.innerText = snapshot.size; // 실시간 문서 수 반영
            }
        }, (err) => {
            console.error(`${time} 실시간 수신 오류:`, err);
        });

        scheduleUnsubscribes.push(unsubscribe);
    });
}

// 7. 내 예약 목록 불러오기 (실시간 onSnapshot 변환)
function loadMyReservation() {
    const user = auth.currentUser;
    if (!user) return;

    if (unsubscribeMyRes) unsubscribeMyRes();

    const box = document.getElementById("myReservations");
    if (!box) return;

    const q = query(
        collection(db, "reservations"),
        where("uid", "==", user.uid)
    );

    // 실시간 감시 적용
    unsubscribeMyRes = onSnapshot(q, (snapshot) => {
        box.innerHTML = `<h3 style="font-size:16px; font-weight:bold; margin-bottom:10px; color:#111827;">🗓️ 내 예약 현황</h3>`;

        const todayStr = getTodayString();
        const currentTimeStr = getCurrentTimeString();
        let validReservations = [];

        snapshot.forEach(item => {
            const data = item.data();
            const timeOnly = data.time ? data.time.split(" ")[0] : "";
            const formattedTime = timeOnly.length === 4 ? `0${timeOnly}` : timeOnly;

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
            cancelBtn.addEventListener("click", async () => {
                await cancelReservation(res.id);
            });

            listContainer.appendChild(itemDiv);
        });

        box.appendChild(listContainer);
    }, (error) => {
        console.error("내 예약 실시간 수신 오류:", error);
    });
}

// 8. 예약 처리 함수
async function handleReservation() {
    if (isReserving) return;

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
    
    const selectedTimeOnly = selectedTime.split(" ")[0];
    const formattedSelectedTime = selectedTimeOnly.length === 4 ? `0${selectedTimeOnly}` : selectedTimeOnly;
    
    if (selectedDate === todayStr && formattedSelectedTime <= currentTimeStr) {
        alert("이미 지나간 시간은 예약할 수 없습니다.");
        return;
    }

    const reserveBtn = document.getElementById("reserveBtn");

    try {
        isReserving = true;
        if (reserveBtn) {
            reserveBtn.disabled = true;
            reserveBtn.innerText = "예약 처리 중...";
        }

        const userDocRef = doc(db, "users", user.uid);

        await runTransaction(db, async (transaction) => {
            // 중복 예약 체크
            const dupQuery = query(
                collection(db, "reservations"),
                where("uid", "==", user.uid),
                where("date", "==", selectedDate),
                where("time", "==", selectedTime)
            );
            
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
                remCount = DEFAULT_INITIAL_TICKETS;
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

            transaction.update(userDocRef, {
                [countFieldName]: remCount - 1,
                usedCount: currentUsedCount + 1
            });
        });

        alert("🎉 예약이 완벽하게 완료되었습니다!");

    } catch (err) {
        console.error("예약 오류 상세:", err);
        
        if (err.message && err.message.startsWith("NO_TICKETS:")) {
            alert(`⚠️ ${err.message.replace("NO_TICKETS:", "")}`);
        } else if (err.message && err.message.includes("사용자 정보")) {
            alert(err.message);
        } else {
            alert(`예약 중 오류가 발생했습니다.\n(${err.message})`);
        }
    } finally {
        isReserving = false;
        if (reserveBtn) {
            reserveBtn.disabled = false;
            reserveBtn.innerText = "예약하기";
        }
    }
}

// 9. 예약 취소 함수
async function cancelReservation(resId) {
    if (isCanceling) return;

    if (!confirm("정말 예약을 취소하시겠습니까?")) return;

    const user = auth.currentUser;
    if (!user) {
        alert("로그인 후 이용해 주세요.");
        return;
    }

    try {
        isCanceling = true;
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
                : (userData.remainingCancel !== undefined ? Number(userData.remainingCancel) : 10);

            let remainingTodayCancel = userData.remainingTodayCancelCount !== undefined 
                ? Number(userData.remainingTodayCancelCount) 
                : (userData.remainingTodayCancel !== undefined ? Number(userData.remainingTodayCancel) : 3);

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

            // 1. 문서 삭제
            transaction.delete(resDocRef);

            const cancelFieldName = userData.remainingCancelCount !== undefined ? "remainingCancelCount" : "remainingCancel";
            const todayCancelFieldName = userData.remainingTodayCancelCount !== undefined ? "remainingTodayCancelCount" : "remainingTodayCancel";

            // 2. 수치 연산
            const userUpdates = {
                [countFieldName]: remCount + 1,
                usedCount: Math.max(0, currentUsedCount - 1),
                [cancelFieldName]: Math.max(0, remainingCancel - 1)
            };

            if (isTodayReservation) {
                userUpdates[todayCancelFieldName] = Math.max(0, remainingTodayCancel - 1);
            }

            transaction.update(userDocRef, userUpdates);
        });

        alert("🎉 예약이 성공적으로 취소되고 이용권 1회가 복구되었습니다.");

    } catch (err) {
        console.error("취소 실패 상세:", err);

        if (err.message === "ALREADY_CANCELLED") {
            alert("⚠️ 이미 취소되었거나 존재하지 않는 예약입니다.");
        } else if (err.message && (err.message.startsWith("NO_TOTAL_CANCEL:") || err.message.startsWith("NO_TODAY_CANCEL:"))) {
            alert(`⚠️ ${err.message.split(":")[1]}`);
        } else if (err.message === "USER_NOT_FOUND") {
            alert("사용자 정보를 찾을 수 없습니다.");
        } else {
            alert(`취소 처리 중 오류가 발생했습니다.\n(${err.message})`);
        }
    } finally {
        isCanceling = false;
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
        if (unsubscribeMyRes) unsubscribeMyRes();
        scheduleUnsubscribes.forEach(unsub => unsub());
        scheduleUnsubscribes = [];
    }
});
