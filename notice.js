// notice.js
import { auth, db } from "./firebase.js";
import { collection, getDocs, addDoc, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const PAGE_SIZE = 10; // 한 페이지당 게시글 수
let currentPage = 1;
let allNotices = []; // 전체 게시글 목록
let isAdmin = false; // 관리자 여부 플래그

const noticeList = document.getElementById("noticeList");
const paginationEl = document.getElementById("pagination");
const writeBtn = document.getElementById("writeBtn");

// 1. 전체 공지사항 불러오기 (누구나 읽기 가능)
async function fetchAllNotices() {
    noticeList.innerHTML = `<li style="padding:16px; color:#9ca3af;">공지사항을 불러오는 중...</li>`;

    try {
        const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        allNotices = [];
        snapshot.forEach(doc => {
            allNotices.push({ id: doc.id, ...doc.data() });
        });

        renderPage(1);
    } catch (err) {
        console.error("공지 로드 오류:", err);
        noticeList.innerHTML = `<li style="padding:16px; color:#9ca3af;">공지사항을 불러오지 못했습니다.</li>`;
    }
}

// 2. 10개씩 목록 렌더링
function renderPage(page) {
    currentPage = page;
    noticeList.innerHTML = "";

    if (allNotices.length === 0) {
        noticeList.innerHTML = `<li style="padding:16px; color:#9ca3af;">등록된 공지사항이 없습니다.</li>`;
        paginationEl.innerHTML = "";
        return;
    }

    const startIdx = (page - 1) * PAGE_SIZE;
    const pageNotices = allNotices.slice(startIdx, startIdx + PAGE_SIZE);

    pageNotices.forEach(item => {
        const dateStr = item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString() : "";

        const li = document.createElement("li");
        li.className = "notice-item";
        li.innerHTML = `
            <span class="notice-title">${item.title}</span>
            <span class="notice-date">${dateStr}</span>
        `;

        // 글 클릭 시 내용 확인 (읽기 가능)
        li.addEventListener("click", () => {
            alert(`[${item.title}]\n\n${item.content}`);
        });

        noticeList.appendChild(li);
    });

    renderPagination();
}

// 3. 하단 페이지 번호 버튼
function renderPagination() {
    paginationEl.innerHTML = "";
    const totalPages = Math.ceil(allNotices.length / PAGE_SIZE);

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.innerText = i;
        btn.addEventListener("click", () => renderPage(i));
        paginationEl.appendChild(btn);
    }
}

// 4. 로그인 사용자 권한 체크 (admin일 때만 글쓰기 버튼 노출)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists() && userDoc.data().role === "admin") {
                isAdmin = true;
                if (writeBtn) writeBtn.style.display = "inline-block"; // 관리자만 버튼 보임
            } else {
                isAdmin = false;
                if (writeBtn) writeBtn.style.display = "none"; // 일반 회원은 숨김
            }
        } catch (e) {
            console.error("권한 확인 실패:", e);
        }
    } else {
        isAdmin = false;
        if (writeBtn) writeBtn.style.display = "none"; // 비회원은 숨김
    }
});

// 5. 공지사항 작성 기능 (관리자 전용)
if (writeBtn) {
    writeBtn.addEventListener("click", async () => {
        if (!isAdmin) {
            alert("관리자 권한이 필요합니다.");
            return;
        }

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
            fetchAllNotices(); // 목록 새로고침
        } catch (err) {
            console.error(err);
            alert("작성 실패: 관리자 권한이 없거나 오류가 발생했습니다.");
        }
    });
}

// 최초 실행
fetchAllNotices();
