import { db } from "./firebase.js";

import {
collection,
getDocs,
getDoc,
doc
}
from
"https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";


const memberList =
document.getElementById("memberList");

let selectedUid = ""; /* 선택한 회원 기억 */

/* loadMembers */
async function loadMembers(){

    memberList.innerHTML = "";

    const snapshot =
    await getDocs(collection(db,"users"));

    snapshot.forEach(docSnap=>{

        const user = docSnap.data();

        memberList.innerHTML += `
        <div class="member-item"
             data-id="${docSnap.id}">

            <b>${user.name}</b><br>
            ${user.phone}

        </div>
        `;

    });

    // 회원을 모두 만든 후 클릭 이벤트 등록
    document
    .querySelectorAll(".member-item")
    .forEach(item=>{

        item.onclick = ()=>{

            showMember(item.dataset.id);

        };

    });

}

/* 3 */

async function showMember(uid){

    const snap =
    await getDoc(
    doc(db,"users",uid)
    );

const data = snap.data();

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

}

/* puls 버튼 */
document.getElementById("plus10").onclick = () => {

    document.getElementById("remainTicket").innerText =
        Number(document.getElementById("remainTicket").innerText) + 10;

};
