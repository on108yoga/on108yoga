console.log("calendar.js 실행 (주간 달력)");

let currentDate = new Date();
let selectedDate = "";

/* 매년 동일한 날짜의 고정 공휴일 (MM-DD) */
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

/* 매년 날짜가 바뀌는 음력 공휴일/대체공휴일 (YYYY-MM-DD) */
const variableHolidays = [
    "2026-09-24", // 2026 추석 연휴 첫날
    "2026-09-25", // 2026 추석 당일
    "2026-09-26"  // 2026 추석 연휴 마지막날
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

    // 오늘 날짜 구하기 (시간 비교를 위해 00:00:00으로 설정)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 일요일(0)부터 토요일(6)까지 7일 반복 생성
    for (let i = 0; i < 7; i++) {
        let date = new Date(sunday);
        date.setDate(sunday.getDate() + i);

        // 자정 기준 시간 비교용 객체 생성
        let targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        // 1. 날짜 셀 div 생성
        let dateBox = document.createElement("div");
        dateBox.className = "date-cell day-box"; 

        // 2. 날짜 텍스트
        dateBox.innerHTML = `<span>${date.getDate()}</span>`;

        // 3. 날짜 문자열 구성 (YYYY-MM-DD / MM-DD)
        let yyyy = date.getFullYear();
        let mm = String(date.getMonth() + 1).padStart(2, "0");
        let dd = String(date.getDate()).padStart(2, "0");
        let dateString = `${yyyy}-${mm}-${dd}`;
        let monthDay = `${mm}-${dd}`;

        // 공휴일 여부 체크 (고정 공휴일 OR 변동 공휴일/추석)
        const isHoliday = fixedHolidays.includes(monthDay) || variableHolidays.includes(dateString);

        // 4. 주말 및 공휴일 스타일 적용
        if (date.getDay() === 0) {
            dateBox.classList.add("sunday");
        } else if (date.getDay() === 6) {
            dateBox.classList.add("saturday");
        }

        if (isHoliday) {
            dateBox.classList.add("holiday");
        }

        // 5. 오늘 날짜 및 지난 날짜 처리
        if (targetDate.getTime() === today.getTime()) {
            dateBox.classList.add("today"); // 오늘 날짜
        } else if (targetDate < today) {
            dateBox.classList.add("past"); // 지난 날짜
        }

        // 이전 선택된 날짜 유지 표시
        if (selectedDate === dateString) {
            dateBox.classList.add("selected");
        }

        /* 6. 날짜 클릭 이벤트 처리 (지난 날짜 및 공휴일/추석은 예약 불가) */
        if (targetDate < today || isHoliday) {
            // 지난 날짜나 공휴일(추석 포함)은 클릭 불가 및 선택 안 됨 처리
            dateBox.style.pointerEvents = "none";
            dateBox.classList.add("disabled"); // 선택 불가 CSS 스타일용 class (필요시 사용)
        } else {
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

                // 외부(reservation.js) 함수 연동
                if (typeof window.setSelectedDate === "function") {
                    window.setSelectedDate(dateString);
                }
            };
        }

        // 7. 캘린더 그리드에 추가
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
