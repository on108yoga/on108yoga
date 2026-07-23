// calendar.js
console.log("calendar.js 실행 (주간 달력)");

let currentDate = new Date();
let selectedDate = "";

/* 매년 반복되는 공휴일 */
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

const weekCalendar = document.getElementById("weekCalendar");
const monthTitle = document.getElementById("monthTitle");

function renderWeek() {
    if (!weekCalendar) return;
    weekCalendar.innerHTML = ""; // 기존 주간 날짜 초기화

    // 현재 선택된 주(Week)의 시작일인 "일요일" 기준 날짜 구하기
    let sunday = new Date(currentDate);
    sunday.setDate(currentDate.getDate() - currentDate.getDay());

    // 주간의 중간 기준(수요일) 날짜로 월 타이틀 표시
    let midWeek = new Date(sunday);
    midWeek.setDate(sunday.getDate() + 3);
    if (monthTitle) {
        monthTitle.innerText = `${midWeek.getFullYear()}년 ${midWeek.getMonth() + 1}월`;
    }

    // 오늘 날짜 문자열 (YYYY-MM-DD)
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // 일요일(0)부터 토요일(6)까지 7일 반복 생성
    for (let i = 0; i < 7; i++) {
        let date = new Date(sunday);
        date.setDate(sunday.getDate() + i);

        // 1. 날짜 셀 div 생성
        let dateBox = document.createElement("div");
        dateBox.className = "date-cell day-box"; 

        // 2. 날짜 텍스트
        dateBox.innerHTML = `<span>${date.getDate()}</span>`;

        // 3. 날짜 문자열 구성 (YYYY-MM-DD)
        let yyyy = date.getFullYear();
        let mm = String(date.getMonth() + 1).padStart(2, "0");
        let dd = String(date.getDate()).padStart(2, "0");
        let dateString = `${yyyy}-${mm}-${dd}`;
        let monthDay = `${mm}-${dd}`;

        // 4. 주말 및 공휴일, 오늘 날짜 클래스 처리
        if (date.getDay() === 0) {
            dateBox.classList.add("sunday");
        } else if (date.getDay() === 6) {
            dateBox.classList.add("saturday");
        }

        if (fixedHolidays.includes(monthDay)) {
            dateBox.classList.add("holiday");
        }

        // 오늘 날짜 클래스 추가
        if (dateString === todayString) {
            dateBox.classList.add("today");
        }

        // 이전 선택된 날짜 유지 표시
        if (selectedDate === dateString) {
            dateBox.classList.add("selected");
        }

        /* 5. 날짜 클릭 이벤트 */
        dateBox.onclick = () => {
            document.querySelectorAll(".day-box").forEach(el =>
                el.classList.remove("selected")
            );

            dateBox.classList.add("selected");
            selectedDate = dateString;

            // 선택된 날짜 표시 영역 업데이트
            const selectedDateEl = document.getElementById("selectedDate");
            if (selectedDateEl) {
                selectedDateEl.innerText = dateString;
            }

            // 외부(reservation.js) 함수 호출 연동 (💡 바르게 실행하도록 수정함)
            if (typeof window.setSelectedDate === "function") {
                window.setSelectedDate(dateString);
            }
        };

        // 6. 캘린더 그리드에 추가 (일~토 순서대로 7개)
        weekCalendar.appendChild(dateBox);
    }
}

/* 이전 주 / 다음 주 버튼 연결 */
const prevWeekBtn = document.getElementById("prevWeek");
const nextWeekBtn = document.getElementById("nextWeek");

if (prevWeekBtn) {
    prevWeekBtn.onclick = () => {
        currentDate.setDate(currentDate.getDate() - 7);
        renderWeek();
    };
}

if (nextWeekBtn) {
    nextWeekBtn.onclick = () => {
        currentDate.setDate(currentDate.getDate() + 7);
        renderWeek();
    };
}

// 초기 실행
document.addEventListener("DOMContentLoaded", () => {
    renderWeek();
});
