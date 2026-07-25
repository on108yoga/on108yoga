import { db } from './firebase.js';
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 메인 페이지 공지사항 최신 3개 불러오기 함수
async function loadMainNotices() {
    const mainNoticeList = document.getElementById('mainNoticeList');
    if (!mainNoticeList) return;

    try {
        // notice 컬렉션에서 작성일(createdAt) 기준 내림차순 3개만 조회
        const q = query(collection(db, "notices"), orderBy("createdAt", "desc"), limit(3));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            mainNoticeList.innerHTML = `<li style="padding: 12px 0; color: #9ca3af; font-size: 14px;">등록된 공지사항이 없습니다.</li>`;
            return;
        }

        let html = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // 날짜 포맷팅 (YYYY.MM.DD)
            let dateStr = '';
            if (data.createdAt) {
                const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
            }

            // 클릭 시 notice.html로 이동하도록 링크 처리
            html += `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                    <a href="notice.html" style="text-decoration: none; color: #374151; font-size: 14px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 15px;">
                        ${data.title || '제목 없음'}
                    </a>
                    <span style="font-size: 12px; color: #9ca3af; shrink: 0;">${dateStr}</span>
                </li>
            `;
        });

        mainNoticeList.innerHTML = html;

    } catch (error) {
        console.error("공지사항 불러오기 실패:", error);
        mainNoticeList.innerHTML = `<li style="padding: 12px 0; color: #ef4444; font-size: 14px;">공지사항을 불러오지 못했습니다.</li>`;
    }
}

// DOM 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', loadMainNotices);
