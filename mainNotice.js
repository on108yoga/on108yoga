// mainNotice.js
import { db } from "./firebase.js";
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

async function loadMainNotices() {
    const listEl = document.getElementById("mainNoticeList");
    if (!listEl) return;

    try {
        // 최신글 4개만 조회
        const q = query(
            collection(db, "notices"),
            orderBy("createdAt", "desc"),
            limit(4)
        );
        const snapshot = await getDocs(q);

        listEl.innerHTML = "";

        if (snapshot.empty) {
            listEl.innerHTML = `<li style="padding: 12px 0; color: #9ca3af; font-size: 14px;">등록된 공지사항이 없습니다.</li>`;
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const dateStr = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : "";

            const li = document.createElement("li");
            li.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e5e7eb;";

            // 제목 클릭 시 전체 게시판(notice.html)으로 이동
            li.innerHTML = `
                <a href="notice.html" style="text-decoration: none; color: #111827; font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">
                    ${data.title}
                </a>
                <span style="font-size: 12px; color: #9ca3af;">${dateStr}</span>
            `;
            listEl.appendChild(li);
        });
    } catch (err) {
        console.error("메인 공지 로드 오류:", err);
    }
}

document.addEventListener("DOMContentLoaded", loadMainNotices);
