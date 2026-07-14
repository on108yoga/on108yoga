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

tbody.innerHTML += `

<tr>

<td>${no++}</td>

<td>${user.name ?? ""}</td>

<td>${user.phone ?? ""}</td>

<td>${user.remainCount ?? 0} 회</td>

<td>${user.role ?? "member"}</td>

<td>

<button
class="action-btn ticket"
onclick="location.href='tickets.html?uid=${doc.id}'">

이용권

</button>

<button
class="action-btn edit">

수정

</button>

<button
class="action-btn delete">

삭제

</button>

</td>

</tr>

`;

});

}

loadMembers();
