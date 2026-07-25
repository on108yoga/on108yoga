import { auth, db } from "./firebase.js";
import { 
    collection, 
    getDocs, 
    addDoc, 
    doc, 
    getDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const writeBtn = document.getElementById("writeBtn");
const noticeList = document.getElementById("noticeList");

// 작성 모달 관련 DOM
const writeModal = document.getElementById("writeModal");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const saveNoticeBtn = document.getElementById("saveNoticeBtn");

// 수정 모달 관련 DOM
const editModal = document.getElementById("editModal");
const cancelEditModalBtn = document.getElementById("cancelEditModalBtn");
const updateNoticeBtn = document.getElementById("updateNoticeBtn");

let isAdmin = false;

// 1. 공지사항 불러오기 (목록 접힘 상태 렌더링)
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
            const noticeId = docSnap.id;
            const dateStr = item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString() : "";

            const card = document.createElement("div");
            card.className = "notice-card";

            // 이미지 포함 여부
            const imgHtml = item.imageUrl 
                ? `<img src="${item.imageUrl}" class="notice-img" alt="공지 이미지" onerror="this.style.display='none'">` 
                : "";

            // 관리자 전용 수정/삭제 버튼
            const adminBtnsHtml = isAdmin ? `
                <div class="admin-actions">
                    <button class="btn-edit" data-id="${noticeId}">수정</button>
                    <button class="btn-delete" data-id="${noticeId}">삭제</button>
                </div>
            ` : "";

            card.innerHTML = `
                <div class="notice-header">
                    <div class="notice-title-group">
                        <span class="notice-title">${item.title}</span>
                    </div>
                    <div>
                        <span class="notice-date">${dateStr}</span>
                        <span class="arrow-icon" style="margin-left:8px;">▼</span>
                    </div>
                </div>
                <div class="notice-body">
                    ${imgHtml}
                    <div class="notice-content">${item.content}</div>
                    ${adminBtnsHtml}
                </div>
            `;

            // 클릭 시 제목만 보였다가 내용이 펼쳐지는 이벤트 (토글)
            const header = card.querySelector(".notice-header");
            header.addEventListener("click", () => {
                card.classList.toggle("open");
            });

            // 관리자 버튼 이벤트 (수정/삭제 클릭 시 펼침 이벤트 상쇄)
            if (isAdmin) {
                const editBtn = card.querySelector(".btn-edit");
                const deleteBtn = card.querySelector(".btn-delete");

                editBtn.addEventListener("click", (e) => {
                    e.stopPropagation(); // 카드 닫힘 방지
                    openEditModal(noticeId, item.title, item.imageUrl, item.content);
                });

                deleteBtn.addEventListener("click", (e) => {
                    e.stopPropagation(); // 카드 닫힘 방지
                    deleteNotice(noticeId);
                });
            }

            noticeList.appendChild(card);
        });
    } catch (err) {
        console.error("공지 로드 오류:", err);
        noticeList.innerHTML = `<p style="text-align:center; color:#888;">공지사항을 불러오지 못했습니다.</p>`;
    }
}

// 2. 권한 확인 (관리자 확인 후 UI 노출)
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
    fetchNotices(); // 권한 체크 후 공지 재로드 (버튼 노출 여부 반영)
});

// 3. 모달 제어 (등록 모달)
if (writeBtn) writeBtn.addEventListener("click", () => writeModal.style.display = "flex");
if (cancelModalBtn) cancelModalBtn.addEventListener("click", () => writeModal.style.display = "none");

// 새 공지 저장
if (saveNoticeBtn) {
    saveNoticeBtn.addEventListener("click", async () => {
        const title = document.getElementById("noticeTitle").value.trim();
        const imageUrl = document.getElementById("noticeImageUrl").value.trim();
        const content = document.getElementById("noticeContent").value.trim();

        if (!title || !content) return alert("제목과 내용을 입력해 주세요.");

        try {
            await addDoc(collection(db, "notices"), {
                title,
                imageUrl: imageUrl || null,
                content,
                createdAt: new Date()
            });

            document.getElementById("noticeTitle").value = "";
            document.getElementById("noticeImageUrl").value = "";
            document.getElementById("noticeContent").value = "";
            writeModal.style.display = "none";

            fetchNotices();
        } catch (err) {
            alert("저장 실패: " + err.message);
        }
    });
}

// 4. 수정 모달 제어 및 업데이트
function openEditModal(id, title, imageUrl, content) {
    document.getElementById("editNoticeId").value = id;
    document.getElementById("editNoticeTitle").value = title || "";
    document.getElementById("editNoticeImageUrl").value = imageUrl || "";
    document.getElementById("editNoticeContent").value = content || "";
    editModal.style.display = "flex";
}

if (cancelEditModalBtn) cancelEditModalBtn.addEventListener("click", () => editModal.style.display = "none");

if (updateNoticeBtn) {
    updateNoticeBtn.addEventListener("click", async () => {
        const id = document.getElementById("editNoticeId").value;
        const title = document.getElementById("editNoticeTitle").value.trim();
        const imageUrl = document.getElementById("editNoticeImageUrl").value.trim();
        const content = document.getElementById("editNoticeContent").value.trim();

        if (!title || !content) return alert("제목과 내용을 입력해 주세요.");

        try {
            await updateDoc(doc(db, "notices", id), {
                title,
                imageUrl: imageUrl || null,
                content
            });

            alert("공지사항이 수정되었습니다.");
            editModal.style.display = "none";
            fetchNotices();
        } catch (err) {
            alert("수정 실패: " + err.message);
        }
    });
}

// 5. 공지사항 삭제
async function deleteNotice(id) {
    if (!confirm("이 공지사항을 정말로 삭제하시겠습니까?")) return;

    try {
        await deleteDoc(doc(db, "notices", id));
        alert("공지사항이 삭제되었습니다.");
        fetchNotices();
    } catch (err) {
        alert("삭제 실패: " + err.message);
    }
}
