import { auth, db } from "./firebase.js";
import { 
    collection, 
    getDocs, 
    addDoc, 
    orderBy, 
    query 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const noticeList = document.getElementById("noticeList");
const writeBtn = document.getElementById("writeBtn");

// 1. 공지사항 목록 불러오기
async function loadNotices() {
    noticeList.innerHTML = "<li class='notice-item'>공지사항을 불러오는 중...</li>";

    try {
        const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        noticeList.innerHTML = "";

        if (querySnapshot.empty) {
            noticeList.innerHTML = "<li class='notice-item'>등록된 공지사항이 없습니다.</li>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const dateStr = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : "";

            const li = document.createElement("li");
            li.className = "notice-item";
            li.innerHTML = `
                <div class="notice-title">${data.title}</div>
                <div class="notice-date">${dateStr}</div>
            `;
            
            // 클릭 시 내용 알림(또는 상세 모달) 출력
            li.addEventListener("click", () => {
                alert(`[${data.title}]\n\n${data.content}`);
            });

            noticeList.appendChild(li);
        });
    } catch (error) {
        console.error("공지사항 로드 실패:", error);
        noticeList.innerHTML = "<li class='notice-item'>공지사항을 불러오지 못했습니다.</li>";
    }
}

// 2. 권한 확인 및 관리자용 버튼 처리
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 관리자인지 확인 후 글쓰기 버튼 표시
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
            if (writeBtn) writeBtn.style.display = "inline-block";
        }
    }
});

// 3. 관리자 공지사항 작성
if (writeBtn) {
    writeBtn.addEventListener("click", async () => {
        const title = prompt("공지사항 제목을 입력하세요:");
        if (!title) return;

        const content = prompt("공지사항 내용을 입력하세요:");
        if (!content) return;

        try {
            await addDoc(collection(db, "notices"), {
                title: title,
                content: content,
                createdAt: new Date()
            });
            alert("공지사항이 등록되었습니다.");
            loadNotices(); // 목록 새로고침
        } catch (error) {
            console.error("공지사항 작성 실패:", error);
            alert("등록에 실패했습니다.");
        }
    });
}

// 초기 로드
loadNotices();
