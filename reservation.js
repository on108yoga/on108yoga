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
/*
================================
날짜 선택 (calendar.js에서 호출)
================================
*/
window.setSelectedDate = function(date) {
    selectedDate = date;
    console.log("선택 날짜:", selectedDate);

    const todayStr = getTodayString();

    // 지나간 날짜를 선택했을 때
    if (selectedDate < todayStr) {
        alert("지난 날짜는 선택 또는 예약할 수 없습니다.");
        
        // 지난 날짜일 경우 기존 표시된 인원 카운트를 모두 0으로 초기화
        classTimes.forEach(time => {
            const id = "count" + time.replace(":", "");
            const element = document.getElementById(id);
            if (element) element.innerText = "0";
        });
        return; // 예약 조회 함수 실행 안 함
    }

    loadReservation();
};

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
const reserveBtn = document.getElementById("reserveBtn");

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

        // 1. 지난 날짜 예약 방지
        const todayStr = getTodayString();
        if (selectedDate < todayStr) {
            alert("지난 날짜에는 예약할 수 없습니다.");
            return;
        }

        if (!selectedTime) {
            alert("시간을 선택해주세요.");
            return;
        }

        // 2. 잔여 횟수 체크 및 사용자 이름 조회
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        let remCount = 0;
        let userName = auth.currentUser.displayName || "";
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            remCount = userData.remCount ?? userData.remainingCount ?? 0;
            if (userData.name) userName = userData.name;
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

            // 6. 회원 잔여 횟수 1회 차감
            await updateDoc(userDocRef, {
                remCount: increment(-1)
            });

            alert("예약이 완료되었습니다.");

            loadReservation();
            loadMyReservation();
            loadUserProfile(auth.currentUser); // 👈 함수명 정정 완료

        } catch (err) {
            console.error("예약 오류:", err);
            alert("예약 중 오류가 발생했습니다.");
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
        // 예약 삭제
        await deleteDoc(doc(db, "reservations", id));

        // 회원 잔여 횟수 1회 복구
        if (auth.currentUser) {
            const userDocRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userDocRef, {
                remCount: increment(1)
            });
        }

        alert("예약이 취소되었습니다.");

        loadReservation();
        loadMyReservation();
        if (auth.currentUser) loadUserProfile(auth.currentUser); // 👈 함수명 정정 완료

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
