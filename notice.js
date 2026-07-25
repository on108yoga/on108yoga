import { auth, db } from "./firebase.js";
import { collection, getDocs, addDoc, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const writeBtn = document.getElementById("writeBtn");
const noticeList = document.getElementById("noticeList");
const writeModal = document.getElementById("writeModal");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const saveNoticeBtn = document.getElementById("saveNoticeBtn");

let isAdmin = false;

// 1. 공지사항 불러오기 (이미지 포함 렌더링)
async function fetchNotices() {
    noticeList.innerHTML = `<p style="text-align:center; color:#888;">공지사항을 불러오는 중...</p>`;

    try {
        const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        noticeList.innerHTML = "";

        if (snapshot.empty) {
            noticeList.innerHTML = `<p style="text-align:center; color:#888;">등록된 공지사항이 없습니다.</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const item = docSnap.data();
            const dateStr = item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString() : "";

            const card = document.createElement("div");
            card.className = "notice-card";

            // 이미지 유무 체크하여 HTML 구성
            const imgHtml = item.imageUrl 
                ? `<img src="${item.imageUrl}" alt="공지 이미지" onerror="this.style.display='none'">` 
                : "";

            card.innerHTML = `
                ${imgHtml}
                <div class="notice-info">
                    <div class="notice-title">${item.title}</div>
                    <div class="notice-date">${dateStr}</div>
                    <div class="notice-content">${item.content}</div>
                </div>
            `;

            noticeList.appendChild(card);
        });
    } catch (err) {
        console.error("공지 로드 오류:", err);
        noticeList.innerHTML = `<p style="text-align:center; color:#888;">공지사항을 불러오지 못했습니다.</p>`;
    }
}

// 2. 권한 확인 (어드민에게만 글쓰기 버튼 노출)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists() && userDoc.data().role === "admin") {
                isAdmin = true;
                if (writeBtn) writeBtn.style.display = "inline-block";
            }
        } catch (e) {
            console.error("권한 체크 실패:", e);
        }
    }
});

// 3. 모달 제어
if (writeBtn) {
    writeBtn.addEventListener("click", () => {
        writeModal.style.display = "flex";
    });
}

if (cancelModalBtn) {
    cancelModalBtn.addEventListener("click", () => {
        writeModal.style.display = "none";
    });
}

// 4. 글 저장 (DB 등록)
if (saveNoticeBtn) {
    saveNoticeBtn.addEventListener("click", async () => {
        const title = document.getElementById("noticeTitle").value.trim();
        const imageUrl = document.getElementById("noticeImageUrl").value.trim();
        const content = document.getElementById("noticeContent").value.trim();

        if (!title || !content) {
            alert("제목과 내용을 입력해 주세요.");
            return;
        }

        try {
            await addDoc(collection(db, "notices"), {
                title: title,
                imageUrl: imageUrl || null,
                content: content,
                createdAt: new Date()
            });

            // 입력폼 초기화 & 모달 닫기
            document.getElementById("noticeTitle").value = "";
            document.getElementById("noticeImageUrl").value = "";
            document.getElementById("noticeContent").value = "";
            writeModal.style.display = "none";

            fetchNotices(); // 목록 새로고침
        } catch (err) {
            console.error("저장 실패:", err);
            alert("공지사항 작성 권한이 없거나 오류가 발생했습니다.");
        }
    });
}

// 최초 실행
fetchNotices();
