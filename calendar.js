let currentDate = new Date();

let selectedDate="";

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

/* 변동 공휴일

*/

const weekCalendar =
document.getElementById("weekCalendar");


const monthTitle =
document.getElementById("monthTitle");



function renderWeek(){


weekCalendar.innerHTML="";


let day =
new Date(currentDate);



day.setDate(
currentDate.getDate() -
currentDate.getDay()
);



monthTitle.innerText =
`${day.getFullYear()}년 ${day.getMonth()+1}월`;



for(let i=0;i<7;i++){


let date =
new Date(day);


date.setDate(
day.getDate()+i
);

    // calendar.js 내부 예시

function renderWeek(baseDate) {
    const calendarContainer = document.getElementById('weekCalendar');
    calendarContainer.innerHTML = ''; // 기존 날짜 초기화

    // 현재 선택된 주의 "일요일" 계산
    const currentSunday = new Date(baseDate);
    currentSunday.setDate(baseDate.getDate() - baseDate.getDay()); // 0 = 일요일

    // 일(0)부터 토(6)까지 정확히 7일간 그리드 생성
    for (let i = 0; i < 7; i++) {
        const day = new Date(currentSunday);
        day.setDate(currentSunday.getDate() + i);

        const dateCell = document.createElement('div');
        dateCell.classList.add('date-cell');
        dateCell.textContent = day.getDate(); // 날짜 숫자 표시
        dateCell.dataset.date = day.toISOString().split('T')[0]; // YYYY-MM-DD 데이터 저장

        // 필요시 클릭 이벤트 추가
        dateCell.addEventListener('click', () => selectDate(day));

        calendarContainer.appendChild(dateCell);
        // 🔥 중요: 7번 정확히 appendChild 되므로 일~토 요일 헤더와 1:1로 정확히 맞아떨어집니다!
    }
}


let dateBox =
document.createElement("div");

dateBox.className="day-box";
// 일요일
if(date.getDay()===0){    dateBox.classList.add("sunday");}

// 토요일
if(date.getDay()===6){    dateBox.classList.add("saturday");}

  
dateBox.innerHTML=
`
<span>
${date.getDate()}
</span>
`;



let yyyy =
date.getFullYear();

let mm =
String(date.getMonth()+1).padStart(2,"0");

let dd =
String(date.getDate()).padStart(2,"0");


let dateString =
`${yyyy}-${mm}-${dd}`;

// 일요일
if(date.getDay()===0){
    dateBox.classList.add("sunday");
}

// 토요일
if(date.getDay()===6){
    dateBox.classList.add("saturday");
}

// 공휴일
const monthDay =
`${mm}-${dd}`;
if(fixedHolidays.includes(monthDay)){
    dateBox.classList.add("holiday");
}


/* 클릭 이벤트 */
dateBox.onclick=()=>{
  
document
.querySelectorAll(".day-box")
.forEach(el=>
el.classList.remove("selected")
);



dateBox.classList.add("selected");


selectedDate=dateString;



document.getElementById("selectedDate")
.innerText=dateString;



if(window.setSelectedDate){

window.setSelectedDate(dateString);

}

};



weekCalendar.appendChild(dateBox);


}


}



document
.getElementById("prevWeek")
.onclick=()=>{

currentDate.setDate(
currentDate.getDate()-7
);

renderWeek();

}



document
.getElementById("nextWeek")
.onclick=()=>{

currentDate.setDate(
currentDate.getDate()+7
);

renderWeek();

}



renderWeek();
