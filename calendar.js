document.addEventListener("DOMContentLoaded", function () {

    console.log("calendar.js 실행");

    const calendarEl = document.getElementById("calendar");

    console.log(calendarEl);


    const calendar = new FullCalendar.Calendar(
        calendarEl,
        {
            initialView: "dayGridMonth",
            locale: "ko"
        }
    );


    calendar.render();

});
