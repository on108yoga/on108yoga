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

    const calendarEl = document.getElementById("calendar");

    const calendar = new FullCalendar.Calendar(calendarEl, {

        initialView: "dayGridWeek",

        locale: "ko",

        firstDay: 1,

        headerToolbar: {
            left: "prev",
            center: "title",
            right: "next"
        },

        height: "auto",

        selectable: true,

        displayEventTime: false,

        dateClick(info){

            const clickedDate = new Date(info.dateStr);

            const today = new Date();

            today.setHours(0,0,0,0);

            if(clickedDate < today){
                alert("지난 날짜는 예약할 수 없습니다.");
                return;
            }

            if(clickedDate.getDay()==0 || clickedDate.getDay()==6){
                alert("주말은 예약이 불가능합니다.");
                return;
            }

            if(holidays.includes(info.dateStr)){
                alert("공휴일은 예약이 불가능합니다.");
                return;
            }

            document.getElementById("selectedDate").innerText = info.dateStr;

            if(window.setSelectedDate){
                window.setSelectedDate(info.dateStr);
            }

        }

    });

    calendar.render();

});
