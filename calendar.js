document.addEventListener("DOMContentLoaded", function () {


    const calendarEl = document.getElementById("calendar");


    // 테스트용 예약 데이터
    // 나중에 Firestore 데이터로 변경
    const reservationData = {

        "2026-07-15": 4,

        "2026-07-16": 8,

        "2026-07-17": 10

    };



    const calendar = new FullCalendar.Calendar(calendarEl, {


        initialView: "dayGridMonth",


        locale: "ko",


        height: "auto",



        events: function(fetchInfo, successCallback){


            let events = [];



            Object.keys(reservationData).forEach(function(date){


                let count = reservationData[date];


                let text;



                if(count >= 10){

                    text = "마감";

                }

                else{

                    text = count + "/10";

                }



                events.push({

                    title: "👥 " + text,

                    start: date

                });



            });



            successCallback(events);


        }



    });



    calendar.render();


});
