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
사용자 잔여 횟수 불러오기
================================
*/
async function loadUserTicketCount(user) {
    const countElement = document.getElementById("myTicketCount");
    if (!countElement || !user) return;

    try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            // remCount 또는 remainingCount 속성 사용
            const remCount = userData.remCount ?? userData.remainingCount ?? 0;
            countElement.innerText = `${remCount}회`;
        } else {
            countElement.innerText = "0회";
        }
    } catch (err) {
        console.error("잔여 횟수 로드 실패:", err);
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

    // 지난 날짜 선택 체크
    const todayStr = getTodayString();
    if (selectedDate < todayStr) {
        alert("지난 날짜는 선택 또는 예약할 수 없습니다.");
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

        // 2. 잔여 횟수 체크
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        let remCount = 0;
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            remCount = userData.remCount ?? userData.remainingCount ?? 0;
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
                name: auth.currentUser.displayName || "",
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
            loadUserTicketCount(auth.currentUser);

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
        if (auth.currentUser) loadUserTicketCount(auth.currentUser);

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
async function loadMyReservation() {
    console.log("내 예약 조회 실행", auth.currentUser);

    if (!auth.currentUser) return;

    const box = document.getElementById("myReservations");
    if (!box) return;

    box.innerHTML = "<h3>내 예약</h3>";

    const q = query(
        collection(db, "reservations"),
        where("uid", "==", auth.currentUser.uid)
    );

    const snapshot = await getDocs(q);
    const todayStr = getTodayString();
    let count = 0;

    snapshot.forEach(item => {
        const data = item.data();

        // 날짜가 지나지 않은(오늘 포함 미래) 예약만 목록에 표출
        if (data.date >= todayStr) {
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
        loadUserTicketCount(user);
    }
});
