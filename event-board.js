import { db, auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const ITEMS_PER_PAGE = 10; // 페이지당 10개
let currentPage = 1;
let allPosts = [];
let currentUser = null;
let isAdmin = false;
let userPhone = localStorage.getItem('userPhone') || '';

// 1. 사용자 인증 및 관리자 권한 확인
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        userPhone = userPhone || (user.email ? user.email.split('@')[0] : '');
        try {
            const userSnap = await getDoc(doc(db, "users", user.uid));
            if (userSnap.exists() && userSnap.data().role === 'admin') {
                isAdmin = true;
            }
        } catch (e) {
            console.warn("관리자 권한 확인 실패:", e);
        }
    }

    const badgeEl = document.getElementById('userBadge');
    if (badgeEl) {
        badgeEl.innerText = isAdmin ? "👑 관리자 모드 (전체 열람 가능)" : "🔒 비밀글 모드 (본인/관리자만 열람)";
    }

    loadEventPosts();
});

// 2. event_reservations 데이터 가져오기
function loadEventPosts() {
    const tbody = document.getElementById('boardTbody');
    if (!tbody) return;

    const q = query(collection(db, "event_reservations"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        allPosts = snapshot.docs.map((docSnap, index) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                index: 0, // 나중에 번호 매김
                ...data
            };
        });

        // 전체 번호 재정렬 (최신글이 높은 번호)
        const total = allPosts.length;
        allPosts.forEach((p, idx) => {
            p.index = total - idx;
        });

        renderTablePage(currentPage);
    }, (error) => {
        console.error("이벤트 게시글 수신 실패:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="color:red;">데이터를 불러오지 못했습니다.</td></tr>`;
    });
}

// 3. 10개 단위 테이블 페이지 렌더링
function renderTablePage(page = 1) {
    const tbody = document.getElementById('boardTbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (allPosts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">등록된 신청 내역이 없습니다.</td></tr>`;
        renderPagination(0);
        return;
    }

    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedItems = allPosts.slice(startIndex, endIndex);

    paginatedItems.forEach((post) => {
        // 날짜 포맷
        let dateStr = '-';
        if (post.createdAt?.toDate) {
            const d = post.createdAt.toDate();
            dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        // 작성자 익명화 처리 (예: 01012345678 -> 010****5678)
        let rawPhone = post.phone || post.userPhone || '';
        let maskedName = '익명 회원';
        if (rawPhone.length >= 7) {
            maskedName = rawPhone.substring(0, 3) + '****' + rawPhone.slice(-4);
        } else if (post.name) {
            maskedName = post.name.substring(0, 1) + '**';
        }

        const ticketName = post.eventOption || post.actualTicket || '수강권 신청';
        const titleText = `[신청완료] ${ticketName}`;

        // 리스트 행 생성
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center; color: #6b7280;">${post.index}</td>
            <td>
                <a class="post-title-link" onclick="window.toggleDetail('${post.id}')">
                    🔒 ${titleText}
                </a>
            </td>
            <td style="text-align: center;">${maskedName}</td>
            <td style="text-align: center; font-size: 13px; color: #6b7280;">${dateStr}</td>
        `;
        tbody.appendChild(tr);

        // 상세 내용 확장 행 생성 (비공개 처리)
        const detailTr = document.createElement('tr');
        detailTr.id = `detail_${post.id}`;
        detailTr.className = 'detail-row';
        detailTr.innerHTML = `
            <td colspan="4">
                <div class="detail-content" id="content_${post.id}">
                    내용을 불러오는 중...
                </div>
            </td>
        `;
        tbody.appendChild(detailTr);
    });

    renderPagination(allPosts.length);
}

// 4. 숫자 스크롤 페이징 버튼 생성
function renderPagination(totalItems) {
    const paginationBox = document.getElementById('paginationBox');
    if (!paginationBox) return;

    paginationBox.innerHTML = '';
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.onclick = () => {
            currentPage = i;
            renderTablePage(currentPage);
        };
        paginationBox.appendChild(btn);
    }
}

// 5. 제목 클릭 시 권한 체크 후 내용 열람 (작성자 및 관리자만 가능)
window.toggleDetail = (postId) => {
    const detailRow = document.getElementById(`detail_${postId}`);
    const contentDiv = document.getElementById(`content_${postId}`);
    if (!detailRow || !contentDiv) return;

    // 이미 열려있으면 닫기
    if (detailRow.style.display === 'table-row') {
        detailRow.style.display = 'none';
        return;
    }

    // 해당 글 데이터 찾기
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;

    // 🔒 권한 검증: 관리자이거나 작성자 본인일 때만 내용 허용
    const isOwner = (currentUser && post.uid === currentUser.uid) || 
                    (userPhone && post.phone && post.phone.replace(/[^0-9]/g, '') === userPhone.replace(/[^0-9]/g, ''));

    if (!isAdmin && !isOwner) {
        alert("🚨 비밀글입니다. 작성자와 관리자만 내용을 볼 수 있습니다.");
        return;
    }

    // 내용 구성
    contentDiv.innerHTML = `
        <strong>📋 상세 신청 정보</strong><br>
        - <strong>신청 수강권:</strong> ${post.eventOption || post.actualTicket || '미지정'}<br>
        - <strong>연락처:</strong> ${post.phone || '미입력'}<br>
        - <strong>상태:</strong> ${post.status === 'approved' ? '승인완료' : '대기중'}<br>
        - <strong>메모 / 안내:</strong> 계좌 입금 확인 후 최종 처리됩니다.
    `;

    detailRow.style.display = 'table-row';
};
