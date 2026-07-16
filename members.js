/* 1. import 문구 */ 
import { db } from "./firebase.js";

import {
    collection,
    getDocs,
    getDoc,
    doc,
    updateDoc,
}
from
"https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

/* 2. 변수 선언 */
const memberList =
document.getElementById("memberList");

let selectedUid = ""; /* 선택한 회원 기억 */

/* 3. loadMembers 함수 : 회원 목록 */
async function loadMembers() {

    memberList.innerHTML = "";

    const snapshot =
    await getDocs(collection(db, "users"));

    snapshot.forEach(docSnap => {

        const user = docSnap.data();

        memberList.innerHTML += `
        <div class="member-item" data-id="${docSnap.id}">
            <b>${user.name || "이름없음"}</b><br>
            ${user.phone || ""}
        </div>
        `;

    });

    // 회원 클릭 이벤트
    document
    .querySelectorAll(".member-item")
    .forEach(item => {

        item.onclick = () => {

            document
            .querySelectorAll(".member-item")
            .forEach(i => i.classList.remove("active"));

            item.classList.add("active");

            showMember(item.dataset.id);

        };

    });

}

/* 4. showMember 함수 : 회원정보 표시 */
async function showMember(uid){

    selectedUid = uid;

    const snap =
    await getDoc(doc(db,"users",uid));

    const data = snap.data();

    if(!data){
        alert("회원정보가 없습니다.");
        return;
    }

    document.getElementById("memberName").innerText =
    data.name || "";

    document.getElementById("memberPhone").innerText =
    data.phone || "";

    document.getElementById("ticketType").value =
    data.ticketType || "";

    document.getElementById("remainTicketInput").value =
    data.remainTicket || 0;

    document.getElementById("totalTicketInput").value =
    data.totalTicket || 0;

    document.getElementById("usedTicketInput").value =
    data.usedTicket || 0;

    document.getElementById("startDateInput").value =
    data.startDate || "";

    document.getElementById("expireDateInput").value =
    data.expireDate || "";

    document.getElementById("cancelRemain").value =
    data.cancelRemain || 0;

    document.getElementById("sameDayCancelRemain").value =
    data.sameDayCancelRemain || 0;

}

/* 11. 회원목록을 화면으로 호출 */
loadMembers();
