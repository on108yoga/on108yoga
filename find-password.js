import { db } from "./firebase.js";
import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const findForm = document.getElementById("findForm");

if (findForm) {
    findForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById("userName").value.trim();
        const phoneInput = document.getElementById("phone").value.replace(/[^0-9]/g, "");

        const resultBox = document.getElementById("resultBox");
        const displayUserName = document.getElementById("displayUserName");
        const passwordText = document.getElementById("passwordText");

        // 초기화
        resultBox.style.display = "none";
        passwordText.innerText = "";

        try {
            const usersRef = collection(db, "users");
            
            // 1. 전화번호(문서 ID 또는 phone 필드) 기준으로 검색
            // 먼저 문서 ID가 전화번호인 경우를 조회합니다.
            let userData = null;
            let targetName = "";

            const querySnapshot = await getDocs(usersRef);
            
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const docId = docSnap.id;

                // 전화번호가 일치하고 이름도 일치하는지 확인
                const isPhoneMatch = (docId === phoneInput) || (data.phone && data.phone.replace(/[^0-9]/g, "") === phoneInput);
                const isNameMatch = data.name && data.name.trim() === nameInput;

                if (isPhoneMatch && isNameMatch) {
                    userData = data;
                }
            });

            if (userData && userData.password) {
                // 결과 출력
                displayUserName.innerText = userData.name;
                passwordText.innerText = userData.password;
                resultBox.style.display = "block";
            } else if (userData && !userData.password) {
                alert("해당 회원의 등록된 비밀번호 정보가 없습니다. 관리자에게 문의하세요.");
            } else {
                alert("일치하는 회원 정보를 찾을 수 없습니다. 이름과 전화번호를 다시 확인해주세요.");
            }

        } catch (error) {
            console.error("비밀번호 조회 오류:", error);
            alert("비밀번호 조회 중 오류가 발생했습니다.");
        }
    });
}
