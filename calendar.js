let currentDate = new Date();

let selectedDate="";

/* 고정 공휴일 배열 */
const holidays = [
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
