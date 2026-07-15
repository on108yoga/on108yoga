console.log("tickets.js 실행");


import {auth,db}
from "./firebase.js";


import {

onAuthStateChanged

}

from

"https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";


import {

doc,
getDoc

}

from

"https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";




onAuthStateChanged(
auth,
async(user)=>{


if(!user){

    location.href="login.html";

    return;

}



const userDoc =
await getDoc(
    doc(db,"users",user.uid)
);



if(userDoc.exists()){


const data =
userDoc.data();



document.getElementById("totalTicket").innerText =
data.totalTicket || 0;



document.getElementById("usedTicket").innerText =
data.usedTicket || 0;



document.getElementById("refundTicket").innerText =
data.refundTicket || 0;



document.getElementById("remainTicket").innerText =
data.remainTicket || 0;



}



});
