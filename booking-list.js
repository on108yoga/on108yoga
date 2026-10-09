import { db, auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    getDocs,
    where,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const RECENT_ITEMS_PER_PAGE = 7;
const PAGE_BLOCK_SIZE = 10;

let currentRecentPage = 1;
let allRecentReservations = [];

function getTodayKST() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const dateKST = new Date(now.getTime() - offset);
    return dateKST.toISOString().split('T')[0];
}

document.addEventListener("DOMContentLoaded", () => {
    const today = getTodayKST();
    const dateInput = document.getElementById("searchDate");
    
    if (dateInput) {
        dateInput.value = today;
        loadAdminReservations(today);
    }

    document.getElementById("loadBtn")?.addEventListener("click", () => {
        if (dateInput) {
            loadAdminReservations(dateInput.value);
        }
    });

    initRecentReservations();
});

// ─── 실시간 최근 예약 및 취소 내역 동시 수신 (오류 방지 로직 포함) ───
function initRecentReservations() {
    const recentTbody = document.getElementById('recentTbody');
    if (!recentTbody) return;

    // orderBy 정렬 실패로 인한 백화 현상을 막기 위해 예외 쿼리 파이프라인 구성
    const q = query(collection(db, 'reservations'));
    
    onSnapshot(q, (snapshot) => {
        let docsData = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        // 자바스크립트 내부에서 생성일/취소일 기준으로 정렬하여 쿼리 실패 및 백화 방지
        docsData.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0);
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0);
            return timeB - timeA;
        });

        allRecentReservations = docsData;
        renderRecentTablePage(currentRecentPage);
    }, (error) => {
        console.error("최근 내역 수신 실패:", error);
        recentTbody.innerHTML = `<tr><td colspan="5" class="empty-msg" style="color:red;">데이터를 불러오지 못했습니다.</td></tr>`;
    });
}

// ─── 표 렌더링 ───
function renderRecentTablePage(page = 1) {
    const recentTbody = document.getElementById('recentTbody');
    if (!recentTbody) return;

    recentTbody.innerHTML = '';

    if (allRecentReservations.length === 0) {
        recentTbody.innerHTML = `<tr><td colspan="5" class="empty-msg">최근 예약 및 취소 내역이 없습니다.</td></tr>`;
        renderRecentPagination(0);
        return;
    }

    const startIndex = (page - 1) * RECENT_ITEMS_PER_PAGE;
    const endIndex = startIndex + RECENT_ITEMS_PER_PAGE;
    const paginatedItems = allRecentReservations.slice(startIndex, endIndex);

    paginatedItems.forEach((item) => {
        let createdTimeStr = item.date || '-';
        
        try {
            if (item.createdAt?.toDate) {
                const d = item.createdAt.toDate();
                createdTimeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            } else if (item.cancelledAt?.toDate) {
                const d = item.cancelledAt.toDate();
                createdTimeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
        } catch (e) {
            console.warn("날짜 파싱 실패 패스:", e);
        }

        const userName = item.name || item.userName || '회원';
        const userPhone = item.phone ? ` (${item.phone})` : '';
        const classInfo = `${item.date || ''} [${item.time || '시간미지정'}]`;

        const isCancelled = (item.status === 'cancelled' || item.status === 'canceled');
        
        const statusBadge = isCancelled 
            ? `<span class="badge badge-cancelled">취소됨</span>` 
            : `<span class="badge badge-approved">예약완료</span>`;

        const actionButton = isCancelled
            ? `<button type="button" class="btn-disabled" disabled>취소완료</button>`
            : `<button type="button" class="btn-delete-res" onclick="window.cancelRecentReservation('${item.id}', '${userName}', '${item.date || ''}', '${item.time || ''}', '${item.uid || ''}', '${item.phone || ''}')">예약취소</button>`;

        const tr = document.createElement('tr');
        if (isCancelled) tr.className = 'cancelled-row';

        tr.innerHTML = `
            <td>${createdTimeStr}</td>
            <td>${userName}${userPhone}</td>
            <td style="font-weight:500; color:#517e73;">${classInfo}</td>
            <td>${statusBadge}</td>
            <td style="text-align: center;">${actionButton}</td>
        `;
        recentTbody.appendChild(tr);
    });

    renderRecentPagination(allRecentReservations.length);
}

// ─── 페이지네이션 버튼 ───
function renderRecentPagination(totalItems) {
    let paginationBox = document.getElementById('recentPagination');
    const tableBox = document.querySelector('.recent-table-box');

    if (!paginationBox && tableBox) {
        paginationBox = document.createElement('div');
        paginationBox.id = 'recentPagination';
        tableBox.after(paginationBox);
    }

    if (!paginationBox) return;
    paginationBox.innerHTML = '';

    const totalPages = Math.ceil(totalItems / RECENT_ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    const currentBlock = Math.floor((currentRecentPage - 1) / PAGE_BLOCK_SIZE);
    const startPage = currentBlock * PAGE_BLOCK_SIZE + 1;
    const endPage = Math.min(startPage + PAGE_BLOCK_SIZE - 1, totalPages);

    const createBtn = (label, pageNum, disabled = false, isActive = false) => {
        const btn = document.createElement('button');
        btn.innerHTML = label;
        btn.type = 'button';
        btn.disabled = disabled;
        btn.style.cssText = `
            padding: 5px 10px; 
            font-size: 13px; 
            border: 1px solid #cbd5e1; 
            border-radius: 4px; 
            cursor: ${disabled ? 'default' : 'pointer'};
            opacity: ${disabled ? '0.4' : '1'};
            background-color: ${isActive ? '#517e73' : '#ffffff'};
            color: ${isActive ? '#ffffff' : '#334155'};
            font-weight: ${isActive ? 'bold' : 'normal'};
        `;
        if (!disabled) {
            btn.onclick = () => {
                currentRecentPage = pageNum;
                renderRecentTablePage(currentRecentPage);
            };
        }
        return btn;
    };

    const prevBlockPage = startPage - 1;
    paginationBox.appendChild(createBtn('&laquo;', prevBlockPage, startPage <= 1));

    for (let i = startPage; i <= endPage; i++) {
        paginationBox.appendChild(createBtn(i, i, false, i === currentRecentPage));
    }

    const nextBlockPage = endPage + 1;
    paginationBox.appendChild(createBtn('&raquo;', nextBlockPage, endPage >= totalPages));
}

// ─── 예약 취소 실행 ───
window.cancelRecentReservation = async (resId, name, dateStr, timeStr, uid, phone) => {
    if (!confirm(`[${dateStr} ${timeStr}] ${name} 회원님의 예약을 취소 상태로 변경하고 수강권 1회를 복구하시겠습니까?`)) return;

    try {
        await updateDoc(doc(db, 'reservations', resId), {
            status: 'cancelled',
            cancelledAt: serverTimestamp()
        });

        let userDocRef = null;

        if (uid) {
            const uidSnap = await getDoc(doc(db, 'users', uid));
            if (uidSnap.exists()) userDocRef = doc(db, 'users', uid);
        }

        if (!userDocRef && phone) {
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone) {
                const phoneSnap = await getDoc(doc(db, 'users', cleanPhone));
                if (phoneSnap.exists()) userDocRef = doc(db, 'users', cleanPhone);
            }
        }

        if (userDocRef) {
            const uSnap = await getDoc(userDocRef);
            if (uSnap.exists()) {
                const uData = uSnap.data();
                const curRem = Number(uData.remainingCount ?? uData.ticketCount ?? uData.remCount ?? 0);
                const curUsed = Number(uData.usedCount ?? uData.usedTickets ?? uData.used ?? 0);

                await updateDoc(userDocRef, {
                    remainingCount: curRem + 1,
                    ticketCount: curRem + 1,
                    remCount: curRem + 1,
                    usedCount: Math.max(0, curUsed - 1)
                });
            }
        }

        alert("예약 상태가 '취소됨'으로 변경되었으며 회원의 수강권 1회가 복구되었습니다.");

        const searchDateVal = document.getElementById('searchDate')?.value;
        if (searchDateVal) loadAdminReservations(searchDateVal);

    } catch (err) {
        console.error("예약 취소 오류:", err);
        alert("예약 취소 실패: " + err.message);
    }
};

async function fetchUserData(member) {
    let uData = null;

    if (member.uid) {
        try {
            const uidSnap = await getDoc(doc(db, "users", member.uid));
            if (uidSnap.exists()) uData = uidSnap.data();
        } catch (e) { console.warn("UID 조회 패스:", e); }
    }

    if (!uData && member.phone) {
        const cleanPhone = member.phone.replace(/[^0-9]/g, '');
        if (cleanPhone) {
            try {
                const phoneSnap = await getDoc(doc(db, "users", cleanPhone));
                if (phoneSnap.exists()) uData = phoneSnap.data();
            } catch (e) { console.warn("전화번호 문서 조회 패스:", e); }
        }
    }

    return uData;
}

// ─── 일자별 명단 (취소건 제외) ───
async function loadAdminReservations(selectedDate) {
    const container = document.getElementById("reservationContainer");
    if (!container) return;

    container.innerHTML = "<p class='empty-msg'>예약 내역을 불러오는 중...</p>";

    try {
        const q = query(
            collection(db, "reservations"),
            where("date", "==", selectedDate)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `<p class='empty-msg'>${selectedDate}에는 예약된 수업이 없습니다.</p>`;
            return;
        }

        const groupedByTime = {};

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.status === 'cancelled' || data.status === 'canceled') return;

            const time = data.time || "시간 미지정";

            if (!groupedByTime[time]) {
                groupedByTime[time] = [];
            }
            groupedByTime[time].push({
                id: docSnap.id,
                ...data
            });
        });

        const sortedTimes = Object.keys(groupedByTime).sort();
        
        if (sortedTimes.length === 0) {
            container.innerHTML = `<p class='empty-msg'>${selectedDate}에는 예약된 수업이 없습니다. (취소건 제외)</p>`;
            return;
        }

        container.innerHTML = "";

        for (const time of sortedTimes) {
            const members = groupedByTime[time];

            const card = document.createElement("div");
            card.className = "time-slot-card";

            let membersHtml = "";

            for (let idx = 0; idx < members.length; idx++) {
                const m = members[idx];
                let usedCount = 0;
                let remainingCount = 0;

                const uData = await fetchUserData(m);
                if (uData) {
                    usedCount = uData.usedCount ?? uData.usedTickets ?? uData.used ?? 0;
                    remainingCount = uData.remainingCount ?? uData.ticketCount ?? uData.remCount ?? 0;
                }

                const name = m.userName || m.name || (uData ? uData.name : '회원');
                const phone = m.phone || (uData ? uData.phone : '');
                const phoneText = phone ? ` / 📞 ${phone}` : "";

                membersHtml += `
                    <li class="member-item">
                        <div>
                            <strong>${idx + 1}. ${name}</strong> 
                            <span style="font-size: 13px; color: #2563eb; font-weight: 600; margin-left: 6px;">
                                (${usedCount}회 사용 / ${remainingCount}회 남음)
                            </span>
                            <span style="font-size: 12px; color: #6b7280; margin-left: 8px;">
                                ${phoneText}
                            </span>
                        </div>
                    </li>
                `;
            }

            card.innerHTML = `
                <div class="slot-header">
                    <span>⏰ ${time} 수업</span>
                    <span>총 ${members.length}명 예약</span>
                </div>
                <ul class="member-list">
                    ${membersHtml}
                </ul>
            `;

            container.appendChild(card);
        }

    } catch (error) {
        console.error("관리자 예약 조회 오류:", error);
        container.innerHTML = "<p class='empty-msg' style='color:red;'>예약 목록을 불러오지 못했습니다.</p>";
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("로그인이 필요합니다.");
        location.href = "./index.html";
        return;
    }

    try {
        const phone = user.email ? user.email.split("@")[0] : "";
        let isAdmin = false;

        if (phone) {
            const phoneSnap = await getDoc(doc(db, "users", phone));
            if (phoneSnap.exists() && phoneSnap.data().role === "admin") {
                isAdmin = true;
            }
        }

        if (!isAdmin) {
            const uidSnap = await getDoc(doc(db, "users", user.uid));
            if (uidSnap.exists() && uidSnap.data().role === "admin") {
                isAdmin = true;
            }
        }

        if (!isAdmin) {
            alert("관리자만 접근할 수 있는 페이지입니다.");
            location.href = "./index.html";
        }
    } catch (err) {
        console.error("권한 체크 실패:", err);
        alert("권한 확인 중 오류가 발생했습니다.");
        location.href = "./index.html";
    }
});
