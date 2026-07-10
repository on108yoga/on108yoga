document.addEventListener("DOMContentLoaded", function () {

    const calendarEl = document.getElementById("calendar");


const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ko",
    displayEventTime: false,

    events: [
        {
            title: "👥 9/10",
            start: "2026-09-10",
            allDay: true
        }
    ]
});


    calendar.render();

});
