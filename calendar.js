document.addEventListener("DOMContentLoaded", function () {

    const calendarEl = document.getElementById("calendar");


    const calendar = new FullCalendar.Calendar(calendarEl, {

        initialView: "dayGridMonth",

        locale: "ko",

        events: [

            {
                title: "👥 4/10",
                start: new Date()
            }

        ]

    });


    calendar.render();

});
