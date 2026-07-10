// reservation.js

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



let selectedDate="";



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



document
.querySelectorAll(".reserveBtn")
.forEach(btn=>{


btn.addEventListener(
"click",

async()=>{


const time = btn.dataset.time;



await addDoc(

collection(db,"reservations"),

{

uid:auth.currentUser.uid,

date:selectedDate,

time:time,

createdAt:new Date()

}


);



loadReservation();



});


});
