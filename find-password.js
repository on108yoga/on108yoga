import { db } from "./firebase.js";
import {
    collection,
    getDocs,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const findForm = document.getElementById("findForm");

if (findForm) {
    findForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById("userName").value.trim();
        const phoneInput = document.getElementById("phone").value.replace(/[^0-9]/g, "");
        const newPassword = prompt("변경할 새로운 비밀번호를 입력해주세요 (6자 이상):");

        if (!newPassword || newPassword.trim().length < 6) {
            alert("비밀번호는 6자 이상이어야 합니다.");
            return;
        }

        try {
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
                // Firestore 문서의 비밀번호 갱신
                const userDocRef = doc(db, "users", targetDocId);
                await updateDoc(userDocRef, {
                    password: newPassword.trim(),
                    updatedAt: new Date()
                });

                alert("🎉 비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.");
                location.href = "login.html";
            } else {
                alert("일치하는 회원 정보를 찾을 수 없습니다. 이름과 전화번호를 다시 확인해주세요.");
            }

        } catch (error) {
            console.error("비밀번호 변경 오류:", error);
            alert("비밀번호 변경 중 오류가 발생했습니다.");
        }
    });
}
