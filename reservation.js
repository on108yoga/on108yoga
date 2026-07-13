// reservation.js
console.log("reservation.js 실행");

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



        const element = document.getElementById(id);
        if (element) {
            element.innerText = count;
        }

    }

}


/* 시간 버튼 */
console.log("시간 버튼 개수:", document.querySelectorAll(".time-btn").length);
document.querySelectorAll(".time-btn").forEach(btn=>{
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
document.getElementById("reserveBtn").addEventListener("click", async()=>{
    if (!auth.currentUser) {
    alert("로그인 후 예약해주세요.");
    location.href = "login.html";
    return;
    }

    if(!selectedDate){
        alert("날짜를 선택해주세요.");
        return;
    }

    if(!selectedTime){
        alert("시간을 선택해주세요.");
        return;
    }

    /* 중복 예약 방지 */
    const q = query(
    collection(db, "reservations"),
    where("uid", "==", auth.currentUser.uid),
    where("date", "==", selectedDate),
    where("time", "==", selectedTime)
    );
    
    const snapshot = await getDocs(q);
    
    if(!snapshot.empty){
        alert("이미 예약한 시간입니다.");
        return;
    }

    /* 정원 체크 */
    const countQuery = query(
    collection(db, "reservations"),
    where("date", "==", selectedDate),
    where("time", "==", selectedTime)
    );
    
    const countSnapshot = await getDocs(countQuery);
    
    if(countSnapshot.size >= 10){
        alert("예약이 마감되었습니다.");
        return;
    }
    
    /* addDoc */
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
