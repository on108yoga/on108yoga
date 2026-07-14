console.log("auth.js 실행");

import { auth, db } from "./firebase.js";

import {
createUserWithEmailAndPassword,
signInWithEmailAndPassword,
signOut,
onAuthStateChanged
}
from
"https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";


import {
doc,
setDoc,
getDoc
}
from
"https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";


// =================
// 회원가입
// =================

const signupForm = document.getElementById("signupForm");


if(signupForm){


signupForm.addEventListener(
"submit",
async(e)=>{


e.preventDefault();


const name =
document.getElementById("name").value;

const phone =
document.getElementById("phone")
.value
.replace(/-/g,"")
.trim();
        if(!/^010\d{8}$/.test(phone)){

    alert("전화번호를 정확히 입력해주세요. (예: 01012345678)");
    return;

        }
        

const email =
`${phone}@yoga.local`;


const password =
document.getElementById("password").value;



try {
        /* 가입 성공 */
          const userCredential =
            await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );
        
        
            await setDoc(
            doc(db,"users",userCredential.user.uid),
            {
               name:name,

                phone:phone,
        
                email:email,
        
                role:"member" /* 회원관리 */
            }
        );



alert("🎉 회원가입이 완료되었습니다.");

window.location.href="index.html";

}

catch(error){

    switch(error.code){

        case "auth/email-already-in-use":
            alert("이미 가입된 전화번호입니다.");
            break;

        case "auth/weak-password":
            alert("비밀번호는 6자 이상이어야 합니다.");
            break;

        case "auth/invalid-email":
            alert("전화번호 형식이 올바르지 않습니다.");
            break;

        default:
            console.log(error);
            alert("회원가입에 실패했습니다.");
    }

}



});

}



// =================
// 로그인
// =================


const loginForm =
document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const phone = document
            .getElementById("phone")
            .value
            .replace(/-/g, "")
            .trim();

        const email = `${phone}@yoga.local`;

        const password =
            document.getElementById("password").value;

        try {

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            alert("✅ 로그인 되었습니다.");
            location.href = "index.html";

        } catch (error) {

            if (error.code === "auth/invalid-credential") {
                alert("전화번호 또는 비밀번호가 올바르지 않습니다.");
            } else {
                console.log(error);
                alert("로그인에 실패했습니다.");
            }

        }

    });

}

// =================
// 로그아웃
// =================


const logoutBtn =
document.getElementById("logoutBtn");



if(logoutBtn){


logoutBtn.addEventListener(
"click",
async()=>{


await signOut(auth);


alert("로그아웃 되었습니다.");


location.href =
"index.html";


});

}

// =================
// 로그인 상태 확인
// =================

onAuthStateChanged(auth, async (user)=>{


const userInfo =
document.getElementById("userInfo");


const loginLink =
document.getElementById("loginLink");


const signupLink =
document.getElementById("signupLink");


const reservationLink =
document.getElementById("reservationLink");

const memberManageLink =
document.getElementById("memberManageLink");      

const logoutBtn =
document.getElementById("logoutBtn");



if(user){


console.log("로그인 UID:", user.uid);



let userName = user.email;
let role = "member";

try{        
        const userDoc = await getDoc(
            doc(db, "users", user.uid)
        );


/* 유저 네임 */
   if(userDoc.exists()){

        userName = userDoc.data().name;

        role = userDoc.data().role || "member";

        console.log("Firestore 이름:", userDoc.data().name);
        console.log("권한:", role);

    }

}
catch(error){

    console.log("사용자 정보 불러오기 실패", error);

}




if(userInfo){

userInfo.style.display="inline";

userInfo.innerHTML =
`👋 ${userName}님`;

}



const guestMenu = document.getElementById("guestMenu");
const memberMenu = document.getElementById("memberMenu");

if (user) {

    guestMenu.style.display = "none";
    memberMenu.style.display = "flex";

} else {

    guestMenu.style.display = "flex";
    memberMenu.style.display = "none";

}


if(logoutBtn)
logoutBtn.style.display="inline";


}



else{


if(userInfo)
userInfo.style.display="none";


if(loginLink)
loginLink.style.display="inline";


if(signupLink)
signupLink.style.display="inline";


if(role === "admin"){

            if(memberManageLink)
                memberManageLink.style.display = "inline";
        
        }else{
        
            if(memberManageLink)
                memberManageLink.style.display = "none";
        
        }


}


});
