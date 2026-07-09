// calendar.js

import { db } from "./firebase.js";

import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', async function () {


    const calendarEl = document.getElementById('calendar');


    // 공휴일
    const holidays = [
        "2026-01-01",
        "2026-03-01",
        "2026-05-05",
        "2026-06-06",
        "2026-08-15",
        "2026-10-03",
        "2026-10-09",
        "2026-12-25"
    ];



    // Firestore 예약 데이터 저장용
    let reservationData = {};



    // Firestore에서 예약 데이터 가져오기
    async function loadReservations(){


        reservationData = {};


        const snapshot = await getDocs(
            collection(db,"reservations")
        );



        snapshot.forEach((doc)=>{


            const data = doc.data();


            const date = data.date;



            if(reservationData[date]){

                reservationData[date]++;

            }
            else{

                reservationData[date]=1;

            }


        });


    }



    await loadReservations();



    const calendar = new FullCalendar.Calendar(calendarEl,{


        initialView:"dayGridMonth",


        locale:"ko",


        height:"auto",



        dateClick:function(info){



            const date = new Date(info.dateStr);



            const today = new Date();

            today.setHours(0,0,0,0);



            // 지난 날짜
            if(date < today){

                alert("지난 날짜는 예약할 수 없습니다.");

                return;

            }



            // 주말
            if(
                date.getDay()===0 ||
                date.getDay()===6
            ){

                alert("주말은 예약할 수 없습니다.");

                return;

            }



            // 공휴일
            if(
                holidays.includes(info.dateStr)
            ){

                alert("공휴일은 예약할 수 없습니다.");

                return;

            }



            // 선택 날짜 전달

            document.getElementById(
                "selectedDate"
            ).innerText = info.dateStr;



            let count =
                reservationData[info.dateStr] || 0;



            document.getElementById(
                "currentCount"
            ).innerText=count;



            document.getElementById(
                "remainCount"
            ).innerText=10-count;



        },




        // 달력 안 예약현황 표시

        events:function(fetchInfo, successCallback){



            let events=[];



            Object.keys(reservationData)
            .forEach(date=>{


                let count =
                reservationData[date];



                events.push({

                    title:
                    count>=10
                    ?
                    "마감"
                    :
                    count+"/10",


                    start:date


                });



            });



            successCallback(events);


        }



    });



    calendar.render();


});
