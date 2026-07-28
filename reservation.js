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
    runTransaction, // 👈 트랜잭션 함수 추가
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

let selectedDate = "";
let selectedTime = "";
let unsubscribeUser = null;

const MAX_PEOPLE = 10;
const DEFAULT_INITIAL_TICKETS = 4; // 👈 신규 회원 기본 부여 횟수 (필요에 따라 변경 가능)

const weeklySchedule = {
    0: [],
    1: ["09:30", "11:00", "18:00", "19:30"],
    2: ["14:00", "15:30", "18:00", "19:30"],
    3: ["09:30", "11:00", "18:00", "19:30"],
    4: ["14:00", "15:30", "18:00", "19:30"],
    5: ["09:30", "11:00", "18:00", "19:30"],
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
        let remCount = DEFAULT_INITIAL_TICKETS; // 기본값 4회 설정

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.name) userName = userData.name;

            // DB에 잔여 횟수 필드가 명시적으로 존재하는 경우 해당 값 반영
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

// 5. 시간 버튼 랜더링 (🔥 지난 시간 회색 비활성화 로직 추가)
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

        // 🔥 날짜가 오늘이고, 시간이 현재 시각보다 같거나 작으면 지나간 시간으로 판별
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

           // !!수정 포인트: 클릭 즉시 버튼 잠금 처리 
            const cancelBtn = itemDiv.querySelector(".cancel-btn");
            cancelBtn.addEventListener("click", async (e) => {
                // 1) 클릭 즉시 버튼 비활성화 및 텍스트 변경 (연타 방지)
                const btn = e.target;
                btn.disabled = true;
                btn.style.background = "#e5e7eb"; // 회색으로 변경
                btn.style.color = "#6b7280";
                btn.style.cursor = "not-allowed";
                btn.innerText = "취소 중...";

                // 2) 아까 수정한 트랜잭션 취소 함수 실행
                await cancelReservation(res.id);

                // (참고: cancelReservation 함수 내부에서 성공/실패 시 
                // loadMyReservation()을 다시 호출하여 화면을 새로고침하므로 
                // 버튼 상태를 다시 원래대로 돌려놓을 필요는 없습니다.)
            });

            listContainer.appendChild(itemDiv);
        });

        box.appendChild(listContainer);

    } catch (error) {
        console.error("내 예약 불러오기 오류:", error);
    }
}

// 8. 예약 처리 함수 (이용권 횟수 엄격 검증 & 중복 방지)
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

    // 🔥 지난 시간에 대한 방어 처리
    const todayStr = getTodayString();
    const currentTimeStr = getCurrentTimeString();
    const formattedSelectedTime = selectedTime.length === 4 ? `0${selectedTime}` : selectedTime;
    
    if (selectedDate === todayStr && formattedSelectedTime <= currentTimeStr) {
        alert("이미 지나간 시간은 예약할 수 없습니다.");
        return;
    }

    try {
        // 1) 같은 날짜 & 같은 시간 중복 예약 체크
        // (만약 하루에 1회만 가능하게 하려면 아래 where("time", "==", selectedTime) 줄을 지우시면 됩니다!)
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

        // 2) 🌟 [핵심] 트랜잭션으로 DB 잔여 횟수 실시간 무조건 검증
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userDocRef);

            if (!userSnap.exists()) {
                throw new Error("사용자 정보를 찾을 수 없습니다.");
            }

            const userData = userSnap.data();
            let userName = userData.name || user.displayName || "회원";
            let countFieldName = "remainingCount";
            let remCount = 0;

            // 저장된 필드명에 따른 잔여 횟수 파악
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
                // 필드가 아예 없는 경우 기본값 적용
                remCount = typeof DEFAULT_INITIAL_TICKETS !== 'undefined' ? DEFAULT_INITIAL_TICKETS : 0;
            }

            // ⛔ 횟수 부족 시 즉시 실패 트랜잭션 발생 (DB 예약 추가 금지)
            if (remCount <= 0) {
                throw new Error(`NO_TICKETS:남은 이용권 횟수가 없습니다. (현재 잔여: ${remCount}회)`);
            }

            // 3) 예약 생성 및 횟수 1회 차감 동시 실행
            const newResRef = doc(collection(db, "reservations"));

            transaction.set(newResRef, {
                uid: user.uid,
                name: userName,
                date: selectedDate,
                time: selectedTime,
                createdAt: serverTimestamp()
            });

            transaction.update(userDocRef, {
                [countFieldName]: remCount - 1
            });
        });

        alert("🎉 예약이 완벽하게 완료되었습니다!");

        // 4) UI 실시간 업데이트
        if (typeof loadReservationCounts === 'function') loadReservationCounts();
        if (typeof loadMyReservation === 'function') loadMyReservation();

    } catch (err) {
        console.error("예약 오류 상세:", err);
        
        // 이용권 부족 에러 메시지 분기 처리
        if (err.message && err.message.startsWith("NO_TICKETS:")) {
            alert(`⚠️ ${err.message.replace("NO_TICKETS:", "")}`);
        } else if (err.message && err.message.includes("사용자 정보")) {
            alert(err.message);
        } else {
            alert(`예약 중 오류가 발생했습니다.\n(${err.message})`);
        }
    }
}

// 9. 예약 취소 함수 (트랜잭션 적용 - 중복 취소 방지 & 안전한 횟수 복구)
// 9. 예약 취소 함수 (취소 제한 횟수 차감 + 이용권 복구)
// 9. 예약 취소 함수 (mypage.js 필드 연동 완벽 반영)
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
        const todayStr = getTodayString(); // YYYY-MM-DD 형식

        await runTransaction(db, async (transaction) => {
            // 1) 예약 존재 여부 확인
            const resSnap = await transaction.get(resDocRef);
            if (!resSnap.exists()) {
                throw new Error("ALREADY_CANCELLED");
            }

            const resData = resSnap.data();
            const isTodayReservation = (resData.date === todayStr); // 당일 예약 여부

            // 2) 회원 정보 확인
            const userSnap = await transaction.get(userDocRef);
            if (!userSnap.exists()) {
                throw new Error("USER_NOT_FOUND");
            }

            const userData = userSnap.data();

            // 🎯 mypage.js와 필드명 일치시킴
            // (1) 일반 남은 취소 횟수
            let remainingCancel = userData.remainingCancelCount !== undefined 
                ? Number(userData.remainingCancelCount) 
                : Number(userData.remainingCancel ?? 0);

            // (2) 당일 남은 취소 횟수
            let remainingTodayCancel = userData.remainingTodayCancelCount !== undefined 
                ? Number(userData.remainingTodayCancelCount) 
                : Number(userData.remainingTodayCancel ?? 0);

            // (3) 이용권 남은 횟수 필드명 파악
            let countFieldName = "remainingCount";
            let remCount = 0;
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

            // ⛔ 3) 취소 가능 횟수 검증
            if (remainingCancel <= 0) {
                throw new Error("NO_TOTAL_CANCEL:총 취소 가능 횟수를 모두 소진하셨습니다.");
            }

            if (isTodayReservation && remainingTodayCancel <= 0) {
                throw new Error("NO_TODAY_CANCEL:당일 취소 가능 횟수를 모두 소진하셨습니다.");
            }

            // 4) 예약 삭제
            transaction.delete(resDocRef);

            // 5) mypage.js 필드명에 맞게 DB 차감 처리
            const cancelFieldName = userData.remainingCancelCount !== undefined ? "remainingCancelCount" : "remainingCancel";
            const todayCancelFieldName = userData.remainingTodayCancelCount !== undefined ? "remainingTodayCancelCount" : "remainingTodayCancel";

            const userUpdates = {
                [countFieldName]: remCount + 1,                   // 이용권 +1 복구
                [cancelFieldName]: remainingCancel - 1            // 남은 취소 횟수 -1 차감
            };

            // 당일 취소인 경우 당일 남은 횟수도 -1 차감
            if (isTodayReservation) {
                userUpdates[todayCancelFieldName] = remainingTodayCancel - 1;
            }

            transaction.update(userDocRef, userUpdates);
        });

        alert("🎉 예약이 성공적으로 취소되고 이용권 1회가 복구되었습니다.");

        // UI 실시간 업데이트
        if (typeof loadReservationCounts === 'function') loadReservationCounts();
        if (typeof loadMyReservation === 'function') loadMyReservation();
        if (typeof loadUserProfile === 'function') loadUserProfile(); // 👈 마이페이지 프로필/횟수 갱신 함수가 있다면 실행

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
