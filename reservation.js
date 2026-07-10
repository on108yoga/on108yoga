// reservation.js
let selectedDate = "";
let selectedTime = "";

import { auth, db } from "./firebase.js";

import {

collection,

query,

where,

getDocs,

addDoc

}

from

"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";



const classTimes=[

"09:30",

"11:00",

"18:30",

"20:00"

];



window.setSelectedDate = function(date){

    selectedDate = date;

    loadReservation();

};



async function loadReservation(){

    for(const time of classTimes){

        const q = query(

            collection(db,"reservations"),

            where("date","==",selectedDate),

            where("time","==",time)

        );



        const snapshot = await getDocs(q);



        const count = snapshot.size;



        const id =
        "count"+time.replace(":","");



        document.getElementById(id)
        .innerText=count;

    }

}


/* 시간 버튼 */
document
.querySelectorAll(".time-btn")
.forEach(btn=>{

btn.addEventListener("click",()=>{

        // 이전 선택 제거
        document
        .querySelectorAll(".time-btn")
        .forEach(b=>b.classList.remove("selected"));

        // 현재 버튼 선택
        btn.classList.add("selected");

        // 선택한 시간 저장
        selectedTime = btn.dataset.time;

});


});

/* 예약하기 버튼 */ 
document.getElementById("reserveBtn")
.addEventListener("click", async()=>{

    if(!selectedDate){
        alert("날짜를 선택해주세요.");
        return;
    }

    if(!selectedTime){
        alert("시간을 선택해주세요.");
        return;
    }

    await addDoc(
        collection(db,"reservations"),
        {
            uid: auth.currentUser.uid,
            date: selectedDate,
            time: selectedTime,
            createdAt: new Date()
        }
    );

    alert("예약이 완료되었습니다.");

    loadReservation();

});
