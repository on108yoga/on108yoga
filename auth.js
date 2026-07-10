console.log("auth.js 실행");

import { auth } from "./firebase.js";


import {

createUserWithEmailAndPassword,

signInWithEmailAndPassword,

signOut,

onAuthStateChanged

}

from

"https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";



// =================
// 회원가입
// =================

const signupForm = document.getElementById("signupForm");


if(signupForm){


signupForm.addEventListener(
"submit",
async(e)=>{


e.preventDefault();



const email =
document.getElementById("email").value;


const password =
document.getElementById("password").value;



try {

    await createUserWithEmailAndPassword(
        auth,
        email,
        password
    );


alert("🎉 회원가입이 완료되었습니다.");

location.href = "index.html";

}

catch(error){


  alert(error.message);


}



});

}



// =================
// 로그인
// =================


const loginForm =
document.getElementById("loginForm");



if(loginForm){


loginForm.addEventListener(
"submit",
async(e)=>{


e.preventDefault();



const email =
document.getElementById("email").value;


const password =
document.getElementById("password").value;



try{


await signInWithEmailAndPassword(

auth,

email,

password

);



alert("✅ 로그인 되었습니다.");

location.href = "index.html";

}

catch(error){


alert(
"로그인 정보를 확인해주세요."
);



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

// =================
// 로그인 상태 확인
// =================

onAuthStateChanged(auth, (user)=>{


const userInfo =
document.getElementById("userInfo");


const loginLink =
document.getElementById("loginLink");


const signupLink =
document.getElementById("signupLink");


const reservationLink =
document.getElementById("reservationLink");


const logoutBtn =
document.getElementById("logoutBtn");



if(user){


console.log(
"로그인 UID:",
user.uid
);



if(userInfo){

userInfo.style.display="inline";

userInfo.innerHTML =
`👋 ${user.email}님`;

}



if(loginLink)
loginLink.style.display="none";


if(signupLink)
signupLink.style.display="none";


if(reservationLink)
reservationLink.style.display="inline";


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


if(reservationLink)
reservationLink.style.display="none";


if(logoutBtn)
logoutBtn.style.display="none";


}


});
