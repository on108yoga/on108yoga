console.log("admin.js 실행");

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
}
from
"https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
    doc,
    getDoc
}
from
"https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";


// ==========================
// 관리자 권한 확인
// ==========================

onAuthStateChanged(auth, async(user)=>{

    if(!user){

        alert("로그인이 필요합니다.");

        location.href="login.html";

        return;

    }

    try{

        const userDoc =
        await getDoc(
            doc(db,"users",user.uid)
        );

        if(!userDoc.exists()){

            alert("회원정보가 없습니다.");

            location.href="index.html";

            return;

        }

        const data =
        userDoc.data();

        // 관리자 확인
        if(data.role !== "admin"){

            alert("관리자만 접근 가능합니다.");

            location.href="index.html";

            return;

        }

        console.log("관리자 로그인 :", data.name);

    }

    catch(error){

        console.log(error);

        alert("권한 확인 실패");

        location.href="index.html";

    }

});


// ==========================
// 로그아웃
// ==========================

const logoutBtn =
document.getElementById("logoutBtn");

if(logoutBtn){

    logoutBtn.onclick =
    async()=>{

        await signOut(auth);

        alert("로그아웃 되었습니다.");

        location.href="index.html";

    };

}
