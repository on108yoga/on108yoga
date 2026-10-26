import { db } from "./firebase.js";
import {
    collection,
    getDocs,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const resetForm = document.getElementById("resetForm");

if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("비밀번호 재설정 버튼 클릭됨");

        const nameInput = document.getElementById("userName").value.trim();
        const phoneInput = document.getElementById("phone").value.replace(/[^0-9]/g, "");
        const newPassword = document.getElementById("newPassword").value.trim();

        if (newPassword.length < 6) {
            alert("비밀번호는 6자 이상이어야 합니다.");
            return;
        }

        try {
            console.log("Firestore에서 회원 조회 시도 중...");
            const usersRef = collection(db, "users");
            const querySnapshot = await getDocs(usersRef);
            
            let targetDocId = null;

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const docId = docSnap.id;

                const isPhoneMatch = (docId === phoneInput) || (data.phone && data.phone.replace(/[^0-9]/g, "") === phoneInput);
                const isNameMatch = data.name && data.name.trim() === nameInput;

                if (isPhoneMatch && isNameMatch) {
                    targetDocId = docId;
                }
            });

            if (targetDocId) {
                console.log("일치하는 회원 찾음, 문서 ID:", targetDocId);
                const userDocRef = doc(db, "users", targetDocId);
                
                await updateDoc(userDocRef, {
                    password: newPassword,
                    updatedAt: new Date()
                });

                alert("🎉 비밀번호가 성공적으로 재설정되었습니다. 로그인 페이지로 이동합니다.");
                window.location.href = "login.html";
            } else {
                console.log("일치하는 회원을 찾지 못함");
                alert("일치하는 회원 정보를 찾을 수 없습니다. 이름과 전화번호를 다시 확인해주세요.");
            }

        } catch (error) {
            console.error("비밀번호 재설정 오류 상세내용:", error);
            // 모바일 화면에서 에러 내용을 바로 볼 수 있도록 출력
            alert("오류 발생: " + error.message);
        }
    });
} else {
    console.error("resetForm 요소를 찾을 수 없습니다. HTML의 form id를 확인해주세요.");
    alert("오류: resetForm 폼을 찾을 수 없습니다.");
}
