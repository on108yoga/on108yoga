// reservation.js
console.log("reservation.js 실행");

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
    increment
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
        let remCount = 0;

        if (userSnap.exists()) {
            const userData = userSnap.data();
            // Firestore에 이름 정보가 있으면 우선 반영
            if (userData.name) userName = userData.name;
            // remCount 또는 remainingCount 속성 조회
            remCount = userData.remCount ?? userData.remainingCount ?? 0;
        }

        // HTML에 이름과 잔여 횟수 표시
        if (nameElement) nameElement.innerText = `${userName} 님`;
        if (countElement) countElement.innerText = `${remCount}회`;

    } catch (err) {
        console.error("사용자 정보 로드 실패:", err);
        if (nameElement) nameElement.innerText = `${user.displayName || '회원'} 님`;
        if (countElement) countElement.innerText = "0회";
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

    // 1. 주말 및 공휴일 체크
    if (isWeekendOrHoliday(selectedDate)) {
        alert("토요일, 일요일 및 공휴일은 휴무일이므로 예약이 불가능합니다.");
        clearTimeCounts();
        selectedDate = "";
        return;
    }

    // 2. 지난 날짜 선택 체크
    if (selectedDate < todayStr) {
        alert("지난 날짜는 선택 또는 예약할 수 없습니다.");
        clearTimeCounts();
        selectedDate = "";
        return;
    }

    loadReservation();
};

// 인원 카운트 뷰 초기화 헬퍼 함수
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

    // YYYY-MM-DD 스트링을 Date 객체로 변환 (타임존 오차 방지용 T00:00:00 추가)
    const targetDate = new Date(`${dateStr}T00:00:00`);
    const day = targetDate.getDay(); // 0: 일요일, 6: 토요일

    // 1. 주말(토요일, 일요일) 체크
    if (day === 0 || day === 6) {
        return true;
    }

    // 2. 주요 양력 고정 공휴일 (MM-DD)
    const monthDay = dateStr.slice(5); // "MM-DD"
    const fixedHolidays = [
        "01-01", // 신정
        "03-01", // 삼일절
        "05-05", // 어린이날
        "06-06", // 현충일
        "08-15", // 광복절
        "10-03", // 개천절
        "10-09", // 한글날
        "12-25"  // 크리스마스
    ];

    if (fixedHolidays.includes(monthDay)) {
        return true;
    }

    // 3. 주요 음력/대체 공휴일 지정 (연도별 추가 필요 시 여기에 YYYY-MM-DD 등록)
    const variableHolidays = [
        // 2026년 기준 주요 설날/추석/부처님오신날 등
        "2026-02-16", "2026-02-17", "2026-02-18", // 설날 연휴
        "2026-05-24", // 부처님오신날
        "2026-09-24", "2026-09-25", "2026-09-26"  // 추석 연휴
    ];

    if (variableHolidays.includes(dateStr)) {
        return true;
    }

    return false;
}

/*
================================
예약 인원 불러오기
================================
*/
async function loadReservation() {
    if (!selectedDate) return;

    // 1. 조회 전 모든 시간대의 화면 인원 표시를 0으로 먼저 초기화
    classTimes.forEach(time => {
        const id = "count" + time.replace(":", "");
        const element = document.getElementById(id);
        if (element) element.innerText = "0";
    });

    // 2. 선택된 날짜의 예약 수량 조회 및 업데이트
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
시간 선택 버튼
================================
*/
document.querySelectorAll(".time-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        console.log("선택 시간:", btn.dataset.time);

        document.querySelectorAll(".time-btn").forEach(b => {
            b.classList.remove("selected");
        });

        btn.classList.add("selected");
        selectedTime = btn.dataset.time;
    });
});

/*
================================
예약하기
================================
*/
/*
================================
예약하기 (잔여 횟수 차감 필드명 통합 수정)
================================
*/
if (reserveBtn) {
    reserveBtn.addEventListener("click", async () => {
        if (!auth.currentUser) {
            alert("로그인 후 예약해주세요.");
            location.href = "login.html";
            return;
        }

        if (!selectedDate) {
            alert("날짜를 선택해주세요.");
            return;
        }

        // 주말 및 공휴일 예약 방지
        if (isWeekendOrHoliday(selectedDate)) {
            alert("토요일, 일요일 및 공휴일은 예약이 불가능합니다.");
            return;
        }

        // 지난 날짜 예약 방지
        const todayStr = getTodayString();
        if (selectedDate < todayStr) {
            alert("지난 날짜에는 예약할 수 없습니다.");
            return;
        }
        
        if (!selectedTime) {
            alert("시간을 선택해주세요.");
            return;
        }

        // 2. 잔여 횟수 체크
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        
        let remCount = 0;
        let userName = auth.currentUser.displayName || "";
        let countFieldName = "remCount"; // 기본 차감할 필드명

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.name) userName = userData.name;

            // remainingCount가 존재하는 경우 해당 필드명을 사용
            if (userData.remainingCount !== undefined && userData.remCount === undefined) {
                remCount = userData.remainingCount;
                countFieldName = "remainingCount";
            } else {
                remCount = userData.remCount ?? 0;
                countFieldName = "remCount";
            }
        }

        if (remCount <= 0) {
            alert("잔여 횟수가 부족합니다. 이용권을 충전해 주세요.");
            return;
        }

        // 3. 중복 예약 확인
        const duplicateQuery = query(
            collection(db, "reservations"),
            where("uid", "==", auth.currentUser.uid),
            where("date", "==", selectedDate),
            where("time", "==", selectedTime)
        );

        const duplicateSnapshot = await getDocs(duplicateQuery);

        if (!duplicateSnapshot.empty) {
            alert("이미 예약한 시간입니다.");
            return;
        }

        // 4. 정원 확인
        const countQuery = query(
            collection(db, "reservations"),
            where("date", "==", selectedDate),
            where("time", "==", selectedTime)
        );

        const countSnapshot = await getDocs(countQuery);

        if (countSnapshot.size >= MAX_PEOPLE) {
            alert("예약이 마감되었습니다.");
            return;
        }

        try {
            // 5. 예약 저장
            await addDoc(collection(db, "reservations"), {
                uid: auth.currentUser.uid,
                name: userName,
                date: selectedDate,
                time: selectedTime,
                createdAt: new Date()
            });

            // 6. 회원 잔여 횟수 1회 차감 (동적으로 매칭된 필드 차감)
            await updateDoc(userDocRef, {
                [countFieldName]: increment(-1)
            });

            alert("예약이 완료되었습니다.");

            loadReservation();
            loadMyReservation();
            loadUserProfile(auth.currentUser);

        } catch (err) {
            console.error("예약 오류:", err);
            alert("예약 중 오류가 발생했습니다.");
        }
    });
}

/*
================================
예약 취소 (필드명 매칭 복구)
================================
*/
window.cancelReservation = async function(id) {
    const ok = confirm("예약을 취소하시겠습니까?");
    if (!ok) return;

    try {
        // 예약 삭제
        await deleteDoc(doc(db, "reservations", id));

        // 회원 잔여 횟수 1회 복구
        if (auth.currentUser) {
            const userDocRef = doc(db, "users", auth.currentUser.uid);
            const userSnap = await getDoc(userDocRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                // remainingCount 필드를 쓰고 있는 계정이면 remainingCount를 +1, 아니면 remCount를 +1
                const countFieldName = (userData.remainingCount !== undefined && userData.remCount === undefined) 
                    ? "remainingCount" 
                    : "remCount";

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
내 예약 불러오기 (오늘 및 미래 예약만 표시)
================================
*/
/*
================================
내 예약 불러오기 (지나간 시각까지 완전 자동 숨김)
================================
*/
async function loadMyReservation() {
    if (!auth.currentUser) return;

    const box = document.getElementById("myReservations");
    if (!box) return;

    box.innerHTML = "<h3>내 예약</h3>";

    const q = query(
        collection(db, "reservations"),
        where("uid", "==", auth.currentUser.uid)
    );

    const snapshot = await getDocs(q);
    
    // 현재 날짜 및 시각 구하기
    const now = new Date();
    const todayStr = getTodayString();
    const currentHoursMinutes = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let count = 0;

    snapshot.forEach(item => {
        const data = item.data();

        // 1. 미래 날짜이거나
        // 2. 오늘 날짜이면서 수업 시간이 아직 지나지 않은 경우만 표시
        const isFutureDate = data.date > todayStr;
        const isTodayUpcoming = (data.date === todayStr && data.time >= currentHoursMinutes);

        if (isFutureDate || isTodayUpcoming) {
            count++;
            box.innerHTML += `
                <div class="my-reservation" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:8px; border-bottom:1px solid #eee;">
                    <span>${data.date} (${data.time})</span>
                    <button type="button" onclick="cancelReservation('${item.id}')" style="background:#fee2e2; color:#ef4444; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
                        취소
                    </button>
                </div>
            `;
        }
    });

    if (count === 0) {
        box.innerHTML += "<p style='color:#9ca3af; font-size:13px;'>예약된 내역이 없습니다.</p>";
    }
}

/*
================================
로그인 후 자동으로 불러오기
================================
*/
onAuthStateChanged(auth, (user) => {
    console.log("현재 로그인:", user);

    if (user) {
        loadMyReservation();
        loadUserProfile(user);
    }
});
