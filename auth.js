import { auth } from "./firebase.js";


import {

createUserWithEmailAndPassword,

signInWithEmailAndPassword,

signOut,

onAuthStateChanged

}

from

"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";



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



try{


const userCredential =

await createUserWithEmailAndPassword(
auth,
email,
password
);



alert("회원가입 완료");



// 자동 로그인 상태

location.href =
"index.html";



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



alert("로그인 성공");



location.href =
"reservation.html";



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


onAuthStateChanged(
auth,
(user)=>{


if(user){

console.log(
"로그인 UID:",
user.uid
);


}

else{

console.log(
"로그아웃 상태"
);


}


});
