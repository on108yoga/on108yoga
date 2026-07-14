import {auth, db}
from "./firebase.js";


import {

onAuthStateChanged,
signOut

}
from
"https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";



import {

collection,
query,
where,
getDocs,
deleteDoc,
doc,
getDoc

}
from
"https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";





const box =
document.getElementById(
"myReservations"
);



onAuthStateChanged(
auth,
async(user)=>{


if(!user){

location.href="login.html";

return;

}


const userDoc = await getDoc(
        doc(db,"users",user.uid)
    );

    if(userDoc.exists()){

        document.getElementById("userName").innerText =
        userDoc.data().name;

        document.getElementById("userPhone").innerText =
        userDoc.data().phone;

    }


loadReservations(
user.uid
);



});






async function loadReservations(uid){


const q =
query(

collection(
db,
"reservations"
),

where(
"uid",
"==",
uid
)

);



const snapshot =
await getDocs(q);



box.innerHTML="";



snapshot.forEach(item=>{


const data =
item.data();



box.innerHTML +=
`

<div class="reservation-card">

<p>
${data.date}
</p>


<p>
${data.time}
</p>


<button
onclick="cancel('${item.id}')">

예약취소

</button>


</div>

`;



});


}






window.cancel =
async function(id){


if(
!confirm("예약을 취소할까요?")
)
return;



await deleteDoc(
doc(
db,
"reservations",
id
)
);



alert(
"취소되었습니다."
);



location.reload();


};





document
.getElementById("logoutBtn")
.onclick =
async()=>{


await signOut(auth);


location.href="index.html";


};
