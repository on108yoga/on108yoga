import { db, auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const RECENT_ITEMS_PER_PAGE = 7;
let currentRecentPage = 1;
let allRecentReservations = [];

// ─── [1] 한국 표준시(KST YYYY-MM-DD) 반환 함수 ───
function getTodayKST() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const dateKST = new Date(now.getTime() - offset);
    return dateKST.toISOString().split('T')[0];
}

// ─── [2] DOM 로드 완료 후 초기화 ───
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

// ─── [3] 실시간 최근 수업 예약 수신 ───
function initRecentReservations() {
    const recentTbody = document.getElementById('recentTbody');
    if (!recentTbody) return;

    const q = query(
        collection(db, 'reservations'),
        orderBy('createdAt', 'desc')
    );
    
    onSnapshot(q, (snapshot) => {
        allRecentReservations = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        renderRecentTablePage(currentRecentPage);
    }, (error) => {
        console.error("최근 수업 예약 수신 실패:", error);
        recentTbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="color:red;">데이터를 불러오지 못했습니다.</td></tr>`;
    });
}

// ─── [4] 최근 수업 예약 표 7개씩 페이지네이션 출력 ───
function renderRecentTablePage(page = 1) {
    const recentTbody = document.getElementById('recentTbody');
    if (!recentTbody) return;

    recentTbody.innerHTML = '';

    if (allRecentReservations.length === 0) {
        recentTbody.innerHTML = `<tr><td colspan="4" class="empty-msg">최근 수업 예약 건이 없습니다.</td></tr>`;
        renderRecentPagination(0);
        return;
    }

    const startIndex = (page - 1) * RECENT_ITEMS_PER_PAGE;
    const endIndex = startIndex + RECENT_ITEMS_PER_PAGE;
    const paginatedItems = allRecentReservations.slice(startIndex, endIndex);

    paginatedItems.forEach((item) => {
        let createdTimeStr = item.date || '-';
        if (item.createdAt?.toDate) {
            const d = item.createdAt.toDate();
            createdTimeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }

        const userName = item.name || item.userName || '회원';
        const userPhone = item.phone ? ` (${item.phone})` : '';
        const classInfo = `${item.date} [${item.time || '시간미지정'}]`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${createdTimeStr}</td>
            <td>${userName}${userPhone}</td>
            <td style="font-weight:500; color:#517e73;">${classInfo}</td>
            <td><span class="badge badge-approved">예약완료</span></td>
        `;
        recentTbody.appendChild(tr);
    });

    renderRecentPagination(allRecentReservations.length);
}

// ─── [5] 페이지네이션 버튼 생성 ───
function renderRecentPagination(totalItems) {
    let paginationBox = document.getElementById('recentPagination');
    const tableBox = document.querySelector('.recent-table-box');

    if (!paginationBox && tableBox) {
        paginationBox = document.createElement('div');
        paginationBox.id = 'recentPagination';
        paginationBox.style.cssText = "display:flex; justify-content:center; gap:6px; margin-top:10px; margin-bottom:25px;";
        tableBox.after(paginationBox);
    }

    if (!paginationBox) return;
    paginationBox.innerHTML = '';

    const totalPages = Math.ceil(totalItems / RECENT_ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.type = 'button';
        btn.style.cssText = `
            padding: 5px 10px; 
            font-size: 13px; 
            border: 1px solid #cbd5e1; 
            border-radius: 4px; 
            cursor: pointer;
            background-color: ${i === currentRecentPage ? '#517e73' : '#ffffff'};
            color: ${i === currentRecentPage ? '#ffffff' : '#334155'};
            font-weight: ${i === currentRecentPage ? 'bold' : 'normal'};
        `;

        btn.onclick = () => {
            currentRecentPage = i;
            renderRecentTablePage(currentRecentPage);
        };

        paginationBox.appendChild(btn);
    }
}

// ─── [6] 회원의 사용/잔여 횟수 정보 조회 ───
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

// ─── [7] 일자별 수업 회원 명단 출력 ───
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

// ─── [8] 관리자 인증 권한 확인 ───
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
