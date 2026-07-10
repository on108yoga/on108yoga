let currentDate = new Date();

let selectedDate="";


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
