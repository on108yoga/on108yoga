import { db } from "./firebase.js";

import {

collection,
getDocs

}
from
"https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const tbody =
document.getElementById("memberTableBody");

async function loadMembers(){

tbody.innerHTML="";

const snapshot =
await getDocs(collection(db,"users"));

let no = 1;

snapshot.forEach(doc=>{

const user = doc.data();

  /* 1 */
  memberList.innerHTML += `

<div class="member-item"
data-id="${doc.id}">

<b>${user.name}</b><br>

${user.phone}

</div>

`;
/* */
});

}

loadMembers();


/* 2 */
document.querySelectorAll(".member-item")
.forEach(item=>{

item.onclick=()=>{

showMember(item.dataset.id);

};

});

/* 3 */

async function showMember(uid){

const snap =
await getDoc(
doc(db,"users",uid)
);

const data =
snap.data();

document.getElementById("memberName").innerText =
data.name;

document.getElementById("memberPhone").innerText =
data.phone;

document.getElementById("remainTicket").innerText =
data.remainTicket || 0;

document.getElementById("totalTicket").innerText =
data.totalTicket || 0;

document.getElementById("usedTicket").innerText =
data.usedTicket || 0;

document.getElementById("cancelRemain").value =
data.cancelRemain || 0;

document.getElementById("sameDayCancelRemain").value =
data.sameDayCancelRemain || 0;

  document
.getElementById("plus10")
.onclick=()=>{

document.getElementById("remainTicket").innerText=
Number(
document.getElementById("remainTicket").innerText
)+10;

};

}
