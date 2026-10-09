import { db, auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
    collection,
    query,
    onSnapshot,
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

let currentUser = null;
let isAdmin = false;
let userPhone = localStorage.getItem('userPhone') || '';

// 1. 사용자 권한 체크 및 익명 식별자 세팅
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
            console.warn("관리자 권한 판별 중 오류 패스:", e);
        }
    }

    const badgeEl = document.getElementById('userBadge');
    if (badgeEl) {
        badgeEl.innerText = isAdmin ? "👑 관리자 모드" : (userPhone ? `👤 익명사용자 (${userPhone.substring(0, 3)}****)` : "👤 익명 게스트");
    }

    loadAllBoardPosts();
});

// 2. 게시글 불러오기 (기존 리스트 포함 전체 수신 후 프론트 단에서 본인/관리자만 필터링)
function loadAllBoardPosts() {
    const container = document.getElementById('postsContainer');
    if (!container) return;

    // 모든 신청/문의 내역 수신
    const q = query(collection(db, "board_posts"));

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = `<p style="text-align:center; color:#999; padding:20px;">등록된 신청 내역이 없습니다.</p>`;
            return;
        }

        let posts = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        // 날짜순 내림차순 정렬 (최신순)
        posts.sort((a, b) => {
            const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return tB - tA;
        });

        // 🎯 본인 작성글이거나 관리자인 경우만 조회 가능하도록 제한
        const visiblePosts = posts.filter(post => {
            if (isAdmin) return true; // 관리자는 전체 읽기 허용

            // 회원 UID 매칭
            if (currentUser && post.uid === currentUser.uid) return true;

            // 전화번호 매칭 (로그인 창에서 넘겨받은 익명 구분 전화번호)
            if (userPhone && post.phone && post.phone.replace(/[^0-9]/g, '') === userPhone.replace(/[^0-9]/g, '')) return true;

            return false;
        });

        if (visiblePosts.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:#999; padding:20px;">조회 가능한 본인의 신청 내역이 없습니다.</p>`;
            return;
        }

        visiblePosts.forEach(post => {
            let dateStr = "신청일자 미기재";
            if (post.createdAt?.toDate) {
                const d = post.createdAt.toDate();
                dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }

            const postEl = document.createElement('div');
            postEl.className = 'post-item';

            // 댓글 목록 생성
            let commentsHtml = '';
            if (post.comments && post.comments.length > 0) {
                post.comments.forEach((c, idx) => {
                    const deleteBtn = isAdmin 
                        ? `<button class="btn-comment-del" onclick="window.deleteComment('${post.id}', ${idx})">삭제</button>` 
                        : '';
                    commentsHtml += `
                        <div class="comment-item">
                            <div>
                                <span class="comment-author">${c.author}:</span>
                                <span>${c.text}</span>
                            </div>
                            <div>
                                <span style="font-size:11px; color:#999;">${c.date || ''}</span>
                                ${deleteBtn}
                            </div>
                        </div>
                    `;
                });
            }

            // 관리자 전용 댓글 작성 양식
            const commentFormHtml = isAdmin ? `
                <div class="comment-form">
                    <input type="text" id="commentInput_${post.id}" class="comment-input" placeholder="운영자 답변을 입력하세요...">
                    <button class="btn-comment-add" onclick="window.addComment('${post.id}')">답변등록</button>
                </div>
            ` : '';

            // 마스킹 처리된 익명 작성자 연락처
            const displayPhone = post.phone ? `${post.phone.substring(0, 3)}****${post.phone.slice(-4)}` : '익명 회원';

            postEl.innerHTML = `
                <div class="post-header">
                    <span><span class="post-badge">🔒 비공개</span> 작성자: ${displayPhone}</span>
                    <span>신청일시: ${dateStr}</span>
                </div>
                <div class="post-ticket-info">🎫 신청 옵션: ${post.ticket || post.eventOption || '미선택'}</div>
                <div class="post-content">${post.memo || post.message || '신청 내용이 등록되었습니다.'}</div>

                <div class="comment-section">
                    <strong style="font-size:12px; color:#517e73;">💬 운영자 답변 및 안내</strong>
                    ${commentsHtml || '<p style="font-size:12px; color:#999; margin-top:4px;">작성된 답변이 없습니다.</p>'}
                    ${commentFormHtml}
                </div>
            `;

            container.appendChild(postEl);
        });
    }, (error) => {
        console.error("게시글 수신 실패:", error);
        container.innerHTML = `<p style="text-align:center; color:red; padding:20px;">내역을 불러오는 중 오류가 발생했습니다.</p>`;
    });
}

// 3. 운영자 댓글 등록
window.addComment = async (postId) => {
    const inputEl = document.getElementById(`commentInput_${postId}`);
    const text = inputEl?.value.trim();
    if (!text) return;

    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
        const postRef = doc(db, "board_posts", postId);
        const postSnap = await getDoc(postRef);

        if (postSnap.exists()) {
            const currentComments = postSnap.data().comments || [];
            currentComments.push({
                author: "운영자",
                text: text,
                date: dateStr
            });

            await updateDoc(postRef, { comments: currentComments });
            inputEl.value = '';
        }
    } catch (err) {
        console.error("댓글 등록 실패:", err);
        alert("댓글 등록 실패: " + err.message);
    }
};

// 4. 운영자 댓글 삭제
window.deleteComment = async (postId, commentIndex) => {
    if (!confirm("해당 댓글을 삭제하시겠습니까?")) return;

    try {
        const postRef = doc(db, "board_posts", postId);
        const postSnap = await getDoc(postRef);

        if (postSnap.exists()) {
            let currentComments = postSnap.data().comments || [];
            currentComments.splice(commentIndex, 1);

            await updateDoc(postRef, { comments: currentComments });
        }
    } catch (err) {
        console.error("댓글 삭제 실패:", err);
        alert("댓글 삭제 실패: " + err.message);
    }
};
