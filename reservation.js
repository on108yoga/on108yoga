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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

let selectedDate = "";
let selectedTime = "";

const classTimes = [
    "09:30",
    "11:00",
    "18:30",
    "20:00"
];

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
사용자 프로필(성명 + 잔여 횟수) 불러오기
================================
*/
async function loadUserProfile(user) {
    const nameElement = document.getElementById("myUserName");
    const countElement = document.getElementById("myTicketCount");
    if (!user) return;

    try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        let userName = user.displayName || "회원";
        let remCount = 0; // ✨ 기본값을 0으로 설정하여 오작동 방지

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.name) userName = userData.name;

            // DB 필드 매칭 (ticketCount > remCount > remainingCount)
            if (userData.ticketCount !== undefined) {
                remCount = Number(userData.ticketCount);
            } else if (userData.remCount !== undefined) {
                remCount = Number(userData.remCount);
            } else if (userData.remainingCount !== undefined) {
                remCount = Number(userData.remainingCount);
            } else {
                remCount = 0;
            }
        }

        if (nameElement) nameElement.innerText = `${userName} 님`;
        if (countElement) countElement.innerText = `${remCount} 회`;

    } catch (err) {
        console.error("사용자 정보 로드 실패:", err);
        if (nameElement) nameElement.innerText = `${user.displayName || '회원'} 님`;
        if (countElement) countElement.innerText = "0 회";
    }
}

/*
================================
날짜 선택 (calendar.js에서 호출)
================================
*/
window.setSelectedDate = function(date) {
    selectedDate = date;
    console.log("선택 날짜:", selectedDate);

    const todayStr = getTodayString();

    if (isWeekendOrHoliday(selectedDate)) {
        alert("토요일, 일요일 및 공휴일은 휴무일이므로 예약이 불가능합니다.");
        clearTimeCounts();
        selectedDate = "";
        return;
    }

    if (selectedDate < todayStr) {
        alert("지난 날짜는 선택 또는 예약할 수 없습니다.");
        clearTimeCounts();
        selectedDate = "";
        return;
    }

    loadReservation();
};

function clearTimeCounts() {
    classTimes.forEach(time => {
        const id = "count" + time.replace(":", "");
        const element = document.getElementById(id);
        if (element) element.innerText = "0";
    });
}

/*
================================
주말 및 공휴일 체크 유틸리티
================================
*/
function isWeekendOrHoliday(dateStr) {
    if (!dateStr) return false;

    const targetDate = new Date(`${dateStr}T00:00:00`);
    const day = targetDate.getDay();

    if (day === 0 || day === 6) return true;

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
예약 인원 불러오기
================================
*/
async function loadReservation() {
    if (!selectedDate) return;

    clearTimeCounts();

    for (const time of classTimes) {
        const q = query(
            collection(db, "reservations"),
            where("date", "==", selectedDate),
            where("time", "==", time)
        );

        const snapshot = await getDocs(q);
        const count = snapshot.size;
        const id = "count" + time.replace(":", "");
        const element = document.getElementById(id);

        if (element) {
            element.innerText = count;
        }
    }
}

/*
================================
시간 선택 버튼 이벤트
================================
*/
document.querySelectorAll(".time-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".time-btn").forEach(b => {
            b.classList.remove("selected", "active");
        });

        btn.classList.add("selected", "active");
        selectedTime = btn.dataset.time;
    });
});

/*
================================
예약하기 (0회 예약 철저 차단 로직 적용)
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
            // 🛑 [핵심 1] DB에서 현재 잔여 횟수를 실시간으로 다시 가져와 강력 검증
            const userDocRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userDocRef);

            if (!userSnap.exists()) {
                alert("회원 정보가 존재하지 않습니다.");
                return;
            }

            const userData = userSnap.data();
            let userName = userData.name || user.displayName || "회원";
            
            let countFieldName = "ticketCount";
            let remCount = 0;

            if (userData.ticketCount !== undefined) {
                remCount = Number(userData.ticketCount);
                countFieldName = "ticketCount";
            } else if (userData.remCount !== undefined) {
                remCount = Number(userData.remCount);
                countFieldName = "remCount";
            } else if (userData.remainingCount !== undefined) {
                remCount = Number(userData.remainingCount);
                countFieldName = "remainingCount";
            }

            // 🛑 [핵심 2] 횟수권 0 이하 차단 (경고창 후 즉시 중단)
            if (remCount <= 0) {
                alert(`⚠️ 남은 이용권 횟수가 없습니다. (잔여: ${remCount}회)\n이용권을 충전 후 다시 시도해주세요.`);
                return; // 여기서 로직 완전히 중단
            }

            // 3. 동일 시간대 중복 예약 체크
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

            // 4. 정원 체크 (최대 10명)
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

            // 5. 예약 데이터 생성
            await addDoc(collection(db, "reservations"), {
                uid: user.uid,
                name: userName,
                date: selectedDate,
                time: selectedTime,
                createdAt: serverTimestamp()
            });

            // 6. 회원 문서 잔여 횟수 1회 차감 (-1)
            await updateDoc(userDocRef, {
                [countFieldName]: increment(-1)
            });

            alert(`🎉 예약이 완료되었습니다!`);

            // 화면 상태 동기화
            loadReservation();
            loadMyReservation();
            loadUserProfile(user);

        } catch (err) {
            console.error("예약 오류:", err);
            alert("예약 처리 중 오류가 발생했습니다.");
        }
    });
}

/*
================================
예약 취소 (잔여 횟수 +1 복구)
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
                
                let countFieldName = "ticketCount";
                if (userData.ticketCount === undefined) {
                    if (userData.remCount !== undefined) countFieldName = "remCount";
                    else if (userData.remainingCount !== undefined) countFieldName = "remainingCount";
                }

                await updateDoc(userDocRef, {
                    [countFieldName]: increment(1)
                });
            }
        }

        alert("예약이 취소되었습니다.");

        loadReservation();
        loadMyReservation();
        if (auth.currentUser) loadUserProfile(auth.currentUser);

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
        loadUserProfile(user);
    }
});
