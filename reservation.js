// reservation.js

console.log("reservation.js 실행");


import { auth, db } from "./firebase.js";


import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    deleteDoc,
    doc
}
from
"https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";


import {
    onAuthStateChanged
}
from
"https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";



let selectedDate = "";
let selectedTime = "";



const classTimes = [
    "09:30",
    "11:00",
    "18:30",
    "20:00"
];

const MAX_PEOPLE = 10;



/*
================================
날짜 선택
calendar.js에서 호출
================================
*/

window.setSelectedDate = function(date){

    selectedDate = date;

    console.log(
        "선택 날짜:",
        selectedDate
    );


    loadReservation();

};




/*
================================
예약 인원 불러오기
================================
*/

async function loadReservation(){


    if(!selectedDate){
        return;
    }


    for(const time of classTimes){


        const q = query(

            collection(
                db,
                "reservations"
            ),

            where(
                "date",
                "==",
                selectedDate
            ),

            where(
                "time",
                "==",
                time
            )

        );



        const snapshot =
        await getDocs(q);



        const count =
        snapshot.size;



        const id =
        "count" +
        time.replace(":","");



        const element =
        document.getElementById(id);



        if(element){

            element.innerText =
            count;

        }


    }


}





/*
================================
시간 선택 버튼
================================
*/


document
.querySelectorAll(".time-btn")
.forEach(btn=>{


    btn.addEventListener(
    "click",
    ()=>{


        console.log(
            "선택 시간:",
            btn.dataset.time
        );


        document
        .querySelectorAll(".time-btn")
        .forEach(b=>{

            b.classList.remove(
                "selected"
            );

        });



        btn.classList.add(
            "selected"
        );



        selectedTime =
        btn.dataset.time;



    });



});






/*
================================
예약하기
================================
*/


const reserveBtn =
document.getElementById(
    "reserveBtn"
);



if(reserveBtn){


reserveBtn.addEventListener(
"click",
async()=>{


    if(!auth.currentUser){

        alert(
            "로그인 후 예약해주세요."
        );

        location.href =
        "login.html";

        return;

    }



    if(!selectedDate){

        alert(
            "날짜를 선택해주세요."
        );

        return;

    }



    if(!selectedTime){

        alert(
            "시간을 선택해주세요."
        );

        return;

    }




    /*
    중복 예약 확인
    */

    const duplicateQuery =
    query(

        collection(
            db,
            "reservations"
        ),

        where(
            "uid",
            "==",
            auth.currentUser.uid
        ),

        where(
            "date",
            "==",
            selectedDate
        ),

        where(
            "time",
            "==",
            selectedTime
        )

    );



    const duplicateSnapshot =
    await getDocs(
        duplicateQuery
    );



    if(!duplicateSnapshot.empty){

        alert(
            "이미 예약한 시간입니다."
        );

        return;

    }





    /*
    정원 확인
    */


    const countQuery =
    query(

        collection(
            db,
            "reservations"
        ),

        where(
            "date",
            "==",
            selectedDate
        ),

        where(
            "time",
            "==",
            selectedTime
        )

    );



    const countSnapshot =
    await getDocs(
        countQuery
    );



    if(
        countSnapshot.size >= MAX_PEOPLE
    ){

        alert(
            "예약이 마감되었습니다."
        );

        return;

    }






    /*
    예약 저장
    */


    await addDoc(

        collection(
            db,
            "reservations"
        ),

        {

            uid:
            auth.currentUser.uid,


            name:
            auth.currentUser.displayName || "",


            date:
            selectedDate,


            time:
            selectedTime,


            createdAt:
            new Date()

        }

    );



    alert(
        "예약이 완료되었습니다."
    );
    
    
    loadReservation();
    
    loadMyReservation();



});


}

// ================================
// 예약 취소
// ================================

window.cancelReservation = async function(id){


    const ok =
    confirm("예약을 취소하시겠습니까?");


    if(!ok){
        return;
    }


    await deleteDoc(
        doc(
            db,
            "reservations",
            id
        )
    );


    alert(
        "예약이 취소되었습니다."
    );


    loadReservation();


};


// ================================
// 내 예약 불러오기
// ================================
async function loadMyReservation(){
console.log(
"내 예약 조회 실행",
auth.currentUser
);

if(!auth.currentUser){
    return;
}


const q =
query(

collection(
db,
"reservations"
),

where(
"uid",
"==",
auth.currentUser.uid
)

);



const snapshot =
await getDocs(q);



const box =
document.getElementById(
"myReservations"
);



if(!box){
    return;
}



box.innerHTML =
"<h3>내 예약</h3>";



snapshot.forEach(item=>{


const data =
item.data();


box.innerHTML +=
`

<div class="my-reservation">

${data.date}
${data.time}

<button onclick="cancelReservation('${item.id}')">
취소
</button>
</div>
`;
});

}

// ================================
// 로그인 후 자동으로 불러오기
// ================================
onAuthStateChanged(auth,(user)=>{

    console.log(
        "현재 로그인:",
        user
    );


    if(user){

        loadMyReservation();

    }

});
