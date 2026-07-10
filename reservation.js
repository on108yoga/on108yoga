// reservation.js

import { auth, db } from "./firebase.js";

import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


// =========================
// 설정
// =========================

const MAX_COUNT = 10;

const CLASS_TIMES = [
    "09:30",
    "11:00",
    "18:30",
    "20:00"
];

let currentUser = null;
let selectedDate = "";


// =========================
// 로그인 확인
// =========================

onAuthStateChanged(auth, (user) => {

    currentUser = user;

});


// =========================
// 날짜 선택
// calendar.js에서 호출
// =========================

window.setSelectedDate = function(date){

    selectedDate = date;

    loadReservationCount();

};


// =========================
// 시간별 예약 인원 조회
// =========================

async function loadReservationCount(){

    if(selectedDate === "") return;

    for(const time of CLASS_TIMES){

        const q = query(
            collection(db,"reservations"),
            where("date","==",selectedDate),
            where("time","==",time)
        );

        const snapshot = await getDocs(q);

        const count = snapshot.size;

        const spanId = "count" + time.replace(":","");

        const span = document.getElementById(spanId);

        if(span){

            span.innerText = count;

        }

    }

}


// =========================
// 예약하기 버튼
// =========================

document.querySelectorAll(".reserveBtn").forEach(btn=>{

    btn.addEventListener("click", async ()=>{

        if(!currentUser){

            alert("로그인 후 예약 가능합니다.");

            location.href="login.html";

            return;

        }

        if(selectedDate===""){

            alert("날짜를 선택하세요.");

            return;

        }

        const time = btn.dataset.time;

        const q = query(
            collection(db,"reservations"),
            where("date","==",selectedDate),
            where("time","==",time)
        );

        const snapshot = await getDocs(q);

        if(snapshot.size>=MAX_COUNT){

            alert("예약이 마감되었습니다.");

            return;

        }

        await addDoc(
            collection(db,"reservations"),
            {

                uid:currentUser.uid,

                email:currentUser.email,

                date:selectedDate,

                time:time,

                createdAt:new Date()

            }
        );

        alert("예약 완료");

        loadReservationCount();

    });

});
