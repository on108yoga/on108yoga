// calendar.js

document.addEventListener("DOMContentLoaded", () => {

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

    const calendar = new FullCalendar.Calendar(
        document.getElementById("calendar"),
        {

            initialView:"dayGridMonth",

            locale:"ko",

            height:"auto",

            displayEventTime:false,

            dateClick:function(info){

                const clickedDate = new Date(info.dateStr);

                const today = new Date();

                today.setHours(0,0,0,0);

                if(clickedDate < today){

                    alert("지난 날짜는 예약할 수 없습니다.");

                    return;

                }

                if(
                    clickedDate.getDay()==0 ||
                    clickedDate.getDay()==6
                ){

                    alert("주말은 예약이 불가능합니다.");

                    return;

                }

                if(
                    holidays.includes(info.dateStr)
                ){

                    alert("공휴일은 예약이 불가능합니다.");

                    return;

                }

                document.getElementById(
                    "selectedDate"
                ).innerText = info.dateStr;

                window.setSelectedDate(info.dateStr);

            }

        }
    );

    calendar.render();

});
