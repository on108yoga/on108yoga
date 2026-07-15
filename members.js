import { db } from "./firebase.js";

import {
collection,
getDocs,
getDoc,
doc,
updateDoc
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

    selectedUid = uid;

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
document.getElementById("plus1").onclick=()=>{

document.getElementById("remainTicket").innerText=
Number(document.getElementById("remainTicket").innerText)+1;

};

document.getElementById("plus5").onclick=()=>{

document.getElementById("remainTicket").innerText=
Number(document.getElementById("remainTicket").innerText)+5;

};
document.getElementById("plus10").onclick=()=>{

document.getElementById("remainTicket").innerText=
Number(document.getElementById("remainTicket").innerText)+10;

};

document.getElementById("plus20").onclick=()=>{

document.getElementById("remainTicket").innerText=
Number(document.getElementById("remainTicket").innerText)+20;

};

document.getElementById("plus50").onclick=()=>{

document.getElementById("remainTicket").innerText=
Number(document.getElementById("remainTicket").innerText)+50;

};

/* 숫자변경, firestore에 저장 */
document.getElementById("saveBtn").onclick =
async()=>{


if(!selectedUid){

alert("회원을 선택해주세요.");

return;

}


await updateDoc(

doc(db,"users",selectedUid),

{

remainTicket:Number(
document.getElementById("remainTicket").innerText
),


cancelRemain:Number(
document.getElementById("cancelRemain").value
),


sameDayCancelRemain:Number(
document.getElementById("sameDayCancelRemain").value
)

}

);

alert("회원정보가 저장되었습니다.");

};

/* 회원목록을 화면으로 호출 */
loadMembers();
