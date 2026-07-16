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

/* saveBtn 수정한 값을 그대로 Firestore에 저장 */
const saveBtn = document.getElementById("saveBtn");

if(saveBtn){

    saveBtn.onclick = async()=>{

        if(!selectedUid){
            alert("회원을 선택해주세요.");
            return;
        }

        await updateDoc(
            doc(db,"users",selectedUid),
            {

                ticketType:
                document.getElementById("ticketType").value,

                remainTicket:Number(
                document.getElementById("remainTicketInput").value
                ),

                totalTicket:Number(
                document.getElementById("totalTicketInput").value
                ),

                usedTicket:Number(
                document.getElementById("usedTicketInput").value
                ),

                startDate:
                document.getElementById("startDateInput").value,

                expireDate:
                document.getElementById("expireDateInput").value,

                cancelRemain:Number(
                document.getElementById("cancelRemain").value
                ),

                sameDayCancelRemain:Number(
                document.getElementById("sameDayCancelRemain").value
                )

            }

        );

        alert("저장되었습니다.");

        showMember(selectedUid);

    }

}

/* 6. changeValue */
function changeValue(inputId,count){

    const input =
    document.getElementById(inputId);

    let value = Number(input.value);

    value += count;

    if(value < 0){
        value = 0;
    }

    input.value = value;

}
/* 6-2. 버튼 연결 */
document.getElementById("plusRemain").onclick =
()=>changeValue("remainTicketInput",1);

document.getElementById("minusRemain").onclick =
()=>changeValue("remainTicketInput",-1);


document.getElementById("plusTotal").onclick =
()=>changeValue("totalTicketInput",1);

document.getElementById("minusTotal").onclick =
()=>changeValue("totalTicketInput",-1);


document.getElementById("plusUsed").onclick =
()=>changeValue("usedTicketInput",1);

document.getElementById("minusUsed").onclick =
()=>changeValue("usedTicketInput",-1);

/* 7. changeExpire */
function changeExpire(days){

    const input =
    document.getElementById("expireDateInput");

    if(!input.value) return;

    const date = new Date(input.value);

    date.setDate(date.getDate()+days);

    input.value =
    date.toISOString().slice(0,10);

}

/* 7-2. 버튼 연결 */
document.getElementById("minus30Day").onclick =
()=>changeExpire(-30);

document.getElementById("minus7Day").onclick =
()=>changeExpire(-7);

document.getElementById("minusDay").onclick =
()=>changeExpire(-1);

document.getElementById("plusDay").onclick =
()=>changeExpire(1);

document.getElementById("plus7Day").onclick =
()=>changeExpire(7);

document.getElementById("plus30Day").onclick =
()=>changeExpire(30);

/* 8. registerTicket */
async function registerTicket(ticketCount,days){

    if(!selectedUid){

        alert("회원을 선택해주세요.");

        return;

    }

    const snap =
    await getDoc(doc(db,"users",selectedUid));

    const user = snap.data();

    const today = new Date();

    const todayString =
    today.toISOString().slice(0,10);

    let startDate;
    let expireDate;

    if(
        user.expireDate &&
        new Date(user.expireDate) > today
    ){

        startDate =
        user.startDate || todayString;

        expireDate =
        new Date(user.expireDate);

    }else{

        startDate = todayString;

        expireDate = new Date(today);

    }

    expireDate.setDate(
        expireDate.getDate()+days
    );

    await updateDoc(

        doc(db,"users",selectedUid),

        {

            ticketType:
            `${ticketCount}회권`,

            startDate,

            expireDate:
            expireDate.toISOString().slice(0,10),

            totalTicket:
            (user.totalTicket||0)+ticketCount,

            remainTicket:
            (user.remainTicket||0)+ticketCount

        }

    );

    alert("이용권 등록 완료");

    showMember(selectedUid);

}

/* 8. 이용권 버튼 연결 */
const ticket5 =
document.getElementById("ticket5");

const ticket10 =
document.getElementById("ticket10");

const ticket20 =
document.getElementById("ticket20");

const ticket30 =
document.getElementById("ticket30");

const ticket50 =
document.getElementById("ticket50");

if(ticket5)
ticket5.onclick=()=>registerTicket(5,20);

if(ticket10)
ticket10.onclick=()=>registerTicket(10,40);

if(ticket20)
ticket20.onclick=()=>registerTicket(20,80);

if(ticket30)
ticket30.onclick=()=>registerTicket(30,120);

if(ticket50)
ticket50.onclick=()=>registerTicket(50,200);


/* 회원목록을 화면으로 호출 */
loadMembers();
