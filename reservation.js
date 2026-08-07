// reservation.js
import { auth, db } from "./firebase.js";
import {
    collection,
    query,
    where,
    doc,
    getDoc,
    getDocs,
    runTransaction,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

let selectedDate = "";
let selectedTime = "";
let unsubscribeUser = null;
let unsubscribeMyRes = null;
let scheduleUnsubscribes = [];

let isReserving = false;
let isCanceling = false;

const MAX_PEOPLE = 10;
const DEFAULT_INITIAL_TICKETS = 0; // auth.js 기준 기본 회원가입 티켓 수

const weeklySchedule = {
    0: [],
    1: ["09:30 교정하타", "11:00 힐링빈야사", "18:00 힐링빈야사", "19:30 교정하타"],
    2: ["14:00 교정하타", "15:30 힐링빈야사", "18:00 교정하타", "19:30 힐링빈야사"],
    3: ["09:30 힐링빈야사", "11:00 교정하타", "18:00 힐링빈야사", "19:30 교정하타"],
    4: ["14:00 힐링빈야사", "15:30 교정하타", "18:00 교정하타", "19:30 힐링빈야사"],
    5: ["09:30 교정하타", "11:00 힐링빈야사", "18:00 힐링빈야사", "19:30 교정하타"],
    6: []
};

// 스플래시 화면을 빠르게 숨기는 함수
function hideSplash() {
    const splashElement = document.getElementById("appSplash");
    if (splashElement) {
        splashElement.style.opacity = "0";
        setTimeout(() => {
            splashElement.style.display = "none";
        }, 200);
    }
}

function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getCurrentTimeString() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// 사용자 실제 Document Reference 탐색 헬퍼 함수
// 사용자 문서 참조 헬퍼 함수 (전화번호 문서 우선 탐색)
async function getUserDocRef(user) {
    if (!user) return null;

    // 1. 이메일에서 전화번호 추출 (예: 01022222222@... -> 01022222222)
    const phone = user.email ? user.email.split("@")[0] : "";
    
    // 2. 전화번호 ID 문서가 존재하는지 최우선 확인
    if (phone) {
        const phoneRef = doc(db, "users", phone);
        const phoneSnap = await getDoc(phoneRef);
        if (phoneSnap.exists()) {
            return phoneRef; // 01022222222 문서를 사용
        }
    }

    // 3. 전화번호 문서가 없을 경우에만 UID 문서 확인
    const uidRef = doc(db, "users", user.uid);
    const uidSnap = await getDoc(uidRef);
    if (uidSnap.exists()) {
        return uidRef;
    }

    // 4. 둘 다 없으면 기본값으로 전화번호 또는 UID 리턴
    return phone ? doc(db, "users", phone) : uidRef;
}

// 사용자 프로필 실시간 수신
async function listenUserProfile(user) {
    if (!user) return;
    if (unsubscribeUser) unsubscribeUser();

    const userDocRef = await getUserDocRef(user);

    unsubscribeUser = onSnapshot(userDocRef, (userSnap) => {
        let userName = user.displayName || "회원";
        let remCount = DEFAULT_INITIAL_TICKETS;

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.name) userName = userData.name;

            // 💡 필드 탐색 순서: ticketCount -> remainingCount -> remCount
            if (userData.ticketCount !== undefined && userData.ticketCount !== null) {
                remCount = Number(userData.ticketCount);
            } else if (userData.remainingCount !== undefined && userData.remainingCount !== null) {
                remCount = Number(userData.remainingCount);
            } else if (userData.remCount !== undefined && userData.remCount !== null) {
                remCount = Number(userData.remCount);
            }
        }

        // 로컬 스토리지 캐시 최신화
        localStorage.setItem("cached_userName", userName);
        localStorage.setItem("cached_ticketCount", String(remCount));

        // 실시간 DOM 업데이트
        const nameElement = document.getElementById("myUserName");
        const countElement = document.getElementById("myTicketCount");

        if (nameElement) nameElement.innerText = `${userName} 님`;
        if (countElement) countElement.innerText = `${remCount} 회`;
    }, (err) => {
        console.error("사용자 정보 수신 실패:", err);
    });
}

// 📌 캘린더 및 선택 UI와 완벽 동기화하는 setSelectedDate
window.setSelectedDate = function(date) {
    selectedDate = date;
    selectedTime = "";
    
    // 1. 선택 날짜 텍스트 업데이트
    const dateDisplay = document.getElementById("selectedDate");
    if (dateDisplay) dateDisplay.innerText = date;

    // 2. <input type="date"> 요소가 있다면 선택 날짜 값 주입
    const dateInputs = document.querySelectorAll("input[type='date'], #reservationDate, #datePicker");
    dateInputs.forEach(input => {
        input.value = date;
    });

    // 3. 수업 시간 버튼 렌더링 및 예약 현황 불러오기
    renderTimeButtons(selectedDate);
    loadReservationCounts();
};

function renderTimeButtons(selectedDateStr) {
    const container = document.getElementById('timeButtons');
    if (!container || !selectedDateStr) return;

    const [year, month, day] = selectedDateStr.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const availableTimes = weeklySchedule[dayOfWeek] || [];

    container.innerHTML = '';

    if (availableTimes.length === 0) {
        container.innerHTML = `<p style="color:#9ca3af; font-size:14px; padding:10px 0;">해당 요일은 수업이 없습니다.</p>`;
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

function loadReservationCounts() {
    scheduleUnsubscribes.forEach(unsub => unsub());
    scheduleUnsubscribes = [];

    if (!selectedDate) return;

    const [year, month, day] = selectedDate.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const targetSchedule = weeklySchedule[dayOfWeek] || [];

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
                countSpan.innerText = snapshot.size;
            }
        }, (err) => {
            console.error(`${time} 실시간 수신 오류:`, err);
        });

        scheduleUnsubscribes.push(unsubscribe);
    });
}

// 내 예약 현황 불러오기
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

// ==========================================
// 📌 예약 처리 로직
// ==========================================
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

        // 1. 중복 예약 검사
        const dupQuery = query(
            collection(db, "reservations"),
            where("uid", "==", user.uid),
            where("date", "==", selectedDate),
            where("time", "==", selectedTime)
        );
        const dupSnap = await getDocs(dupQuery);
        if (!dupSnap.empty) {
            alert("⚠️ 이미 해당 시간대에 예약 신청하셨습니다.");
            return;
        }

        // 2. 정원 10명 검사
        const timeSlotQuery = query(
            collection(db, "reservations"),
            where("date", "==", selectedDate),
            where("time", "==", selectedTime)
        );
        const timeSlotSnap = await getDocs(timeSlotQuery);
        if (timeSlotSnap.size >= MAX_PEOPLE) {
            alert("⚠️ 해당 시간대는 정원(10명)이 차서 더 이상 예약할 수 없습니다.");
            return;
        }

        const userDocRef = await getUserDocRef(user);

        // 3. 트랜잭션 (이용권 차감 및 마이페이지 필드 동기화)
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userDocRef);

            if (!userSnap.exists()) {
                throw new Error("사용자 정보를 찾을 수 없습니다.");
            }

            const userData = userSnap.data();
            let userName = userData.name || user.displayName || "회원";
            let remCount = 0;
            let currentUsedCount = Number(userData.usedCount ?? userData.usedTickets ?? userData.used ?? 0);

            if (userData.ticketCount !== undefined && userData.ticketCount !== null) {
                remCount = Number(userData.ticketCount);
            } else if (userData.remainingCount !== undefined && userData.remainingCount !== null) {
                remCount = Number(userData.remainingCount);
            } else if (userData.remCount !== undefined && userData.remCount !== null) {
                remCount = Number(userData.remCount);
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

            const newCount = remCount - 1;
            
            const userUpdates = {
                ticketCount: newCount,
                remainingCount: newCount,
                remCount: newCount,
                usedCount: currentUsedCount + 1
            };

            transaction.update(userDocRef, userUpdates);
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

// ==========================================
// 📌 예약 취소 로직
// ==========================================
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
        const userDocRef = await getUserDocRef(user);
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

            let remCount = 0;
            let currentUsedCount = Number(userData.usedCount ?? userData.usedTickets ?? userData.used ?? 0);

            if (userData.ticketCount !== undefined && userData.ticketCount !== null) {
                remCount = Number(userData.ticketCount);
            } else if (userData.remainingCount !== undefined && userData.remainingCount !== null) {
                remCount = Number(userData.remainingCount);
            } else if (userData.remCount !== undefined && userData.remCount !== null) {
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

            const restoredCount = remCount + 1;

            const userUpdates = {
                ticketCount: restoredCount,
                remainingCount: restoredCount,
                remCount: restoredCount,
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

// ⚡ [초기화] 앱 실행 시 오늘 날짜 기본 선택 및 캐시 복원
document.addEventListener("DOMContentLoaded", () => {
    // 1. 캐시된 유저 정보 표시
    const cachedName = localStorage.getItem("cached_userName");
    const cachedTicket = localStorage.getItem("cached_ticketCount");

    if (cachedName && cachedTicket !== null) {
        const nameElement = document.getElementById("myUserName");
        const countElement = document.getElementById("myTicketCount");
        if (nameElement) nameElement.innerText = `${cachedName} 님`;
        if (countElement) countElement.innerText = `${cachedTicket} 회`;
    }

    // 2. 예약 페이지 진입 시 오늘 날짜 자동 선택 및 캘린더 동기화
    const today = getTodayString();
    window.setSelectedDate(today);

    // 3. 캘린더 Input 변경 감지 리스너 추가
    const dateInput = document.querySelectorAll("input[type='date'], #reservationDate, #datePicker");
    dateInput.forEach(input => {
        input.addEventListener("change", (e) => {
            if (e.target.value) {
                window.setSelectedDate(e.target.value);
            }
        });
    });

    setTimeout(hideSplash, 200);

    const reserveBtn = document.getElementById("reserveBtn");
    if (reserveBtn) {
        reserveBtn.addEventListener("click", handleReservation);
    }
});

// 백그라운드 인증 상태 수신
onAuthStateChanged(auth, (user) => {
    hideSplash();

    if (user) {
        listenUserProfile(user);
        loadMyReservation();
    } else {
        if (unsubscribeUser) unsubscribeUser();
        if (unsubscribeMyRes) unsubscribeMyRes();
        if (Array.isArray(scheduleUnsubscribes)) {
            scheduleUnsubscribes.forEach(unsub => unsub());
            scheduleUnsubscribes = [];
        }

        localStorage.removeItem("cached_userName");
        localStorage.removeItem("cached_ticketCount");
    }
});
