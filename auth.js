console.log("auth.js 실행");

import { auth, db } from "./firebase.js";

import {
doc,
setDoc
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

const email =
document.getElementById("email").value;


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
                email:email
            }
        );
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

/* 로그인 시 이름 등장 */
if(user){

const userDoc =
await getDoc(
doc(db,"users",user.uid)
);


let userName =
user.email;


if(userDoc.exists()){

userName =
userDoc.data().name;

}



if(userInfo){

userInfo.style.display="inline";

userInfo.innerHTML =
`👋 ${userName}님`;

}

}

        
/* */

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
