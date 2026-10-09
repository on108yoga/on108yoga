import { db, auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

let currentUser = null;
let isAdmin = false;
let selectedTicket = localStorage.getItem('selectedTicket') || '선택 없음';

document.addEventListener('DOMContentLoaded', () => {
    const ticketDisplay = document.getElementById('ticketDisplay');
    if (ticketDisplay) {
        ticketDisplay.innerText = `선택 수강권: [${selectedTicket}]`;
    }

    document.getElementById('postForm')?.addEventListener('submit', handleCreatePost);
});

// 1. 로그인 사용자 및 운영자 권한 확인
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("로그인이 필요합니다.");
        window.location.href = 'index.html';
        return;
    }

    currentUser = user;

    // 운영자 role 체크
    try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists() && userSnap.data().role === 'admin') {
            isAdmin = true;
            document.getElementById('userBadge').innerText = "👑 관리자 모드 접속 중";
        } else {
            document.getElementById('userBadge').innerText = `👤 ${user.email ? user.email.split('@')[0] : '회원'}님`;
        }
    } catch (e) {
        console.warn("권한 확인 패스:", e);
    }

    loadBoardPosts();
});

// 2. 비공개 게시글 작성
async function handleCreatePost(e) {
    e.preventDefault();
    const memo = document.getElementById('postMemo').value.trim();
    if (!memo) return;

    try {
        await addDoc(collection(db, "board_posts"), {
            uid: currentUser.uid,
            phone: currentUser.email ? currentUser.email.split('@')[0] : '',
            ticket: selectedTicket,
            memo: memo,
            comments: [],
            createdAt: serverTimestamp()
        });

        alert("비공개 신청글이 정상 등록되었습니다.");
        document.getElementById('postMemo').value = '';
    } catch (err) {
        console.error("글 작성 오류:", err);
        alert("글 작성 실패: " + err.message);
    }
}

// 3. 게시글 불러오기 (일반 회원은 본인글만, 운영자는 전체)
function loadBoardPosts() {
    const container = document.getElementById('postsContainer');
    let q;

    if (isAdmin) {
        // 관리자는 전체 비공개글 조회
        q = query(collection(db, "board_posts"), orderBy("createdAt", "desc"));
    } else {
        // 일반 회원은 본인 작성글만 조회
        q = query(
            collection(db, "board_posts"),
            where("uid", "==", currentUser.uid)
        );
    }

    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';

        if (snapshot.empty) {
            container.innerHTML = `<p style="text-align:center; color:#999; padding:20px;">신청 내역이 없습니다.</p>`;
            return;
        }

        const posts = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        // 프론트 내 정렬 (날짜순)
        posts.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

        posts.forEach(post => {
            let dateStr = "방금 전";
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

            postEl.innerHTML = `
                <div class="post-header">
                    <span><span class="post-badge">🔒 비공개</span> 작성자: ${post.phone || '회원'}</span>
                    <span>신청일시: ${dateStr}</span>
                </div>
                <div class="post-ticket-info">🎫 신청 수강권: ${post.ticket || '미선택'}</div>
                <div class="post-content">${post.memo}</div>

                <div class="comment-section">
                    <strong style="font-size:12px; color:#517e73;">💬 운영자 답변 및 안내</strong>
                    ${commentsHtml || '<p style="font-size:12px; color:#999; margin-top:4px;">작성된 답변이 없습니다.</p>'}
                    ${commentFormHtml}
                </div>
            `;

            container.appendChild(postEl);
        });
    });
}

// 4. 운영자 댓글 등록 함수
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
        alert("댓글 등록에 실패했습니다.");
    }
};

// 5. 운영자 댓글 삭제 함수
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
        alert("댓글 삭제에 실패했습니다.");
    }
};
