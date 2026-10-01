import { db, auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    getDocs,
    doc,
    getDoc,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ─── [1] 한국 표준시(KST YYYY-MM-DD) 반환 함수 ───
function getTodayKST() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const dateKST = new Date(now.getTime() - offset);
    return dateKST.toISOString().split('T')[0];
}

// ─── [2] DOM 로드 완료 후 초기화 ───
document.addEventListener("DOMContentLoaded", () => {
    // 1. 날짜별 예약 현황 초기화
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

    // 2. 실시간 최근 수업 예약 데이터 감시
    initRecentReservations();
});

// ─── [3] 실시간 최근 수업 예약 표(최신 5건) 출력 ───
function initRecentReservations() {
    const recentTbody = document.getElementById('recentTbody');
    if (!recentTbody) return;

    // 🎯 reservations 컬렉션에서 최근 예약 신청건 최신순 5개 수신
    const q = query(
        collection(db, 'reservations'), 
        orderBy('createdAt', 'desc'), 
        limit(5)
    );
    
    onSnapshot(q, async (snapshot) => {
        recentTbody.innerHTML = '';
        
        if (snapshot.empty) {
            recentTbody.innerHTML = `<tr><td colspan="4" class="empty-msg">최근 수업 예약 건이 없습니다.</td></tr>`;
            return;
        }

        for (const docSnap of snapshot.docs) {
            const item = docSnap.data();

            // 신청 시각 포맷팅
            let createdTimeStr = item.date || '-';
            if (item.createdAt?.toDate) {
                const d = item.createdAt.toDate();
                createdTimeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }

            // 회원의 이름/연락처
            const userName = item.name || item.userName || '회원';
            const userPhone = item.phone ? ` (${item.phone})` : '';

            // 예약된 수업 날짜 및 시간
            const classInfo = `${item.date} [${item.time || '시간미지정'}]`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${createdTimeStr}</td>
                <td>${userName}${userPhone}</td>
                <td style="font-weight:500; color:#517e73;">${classInfo}</td>
                <td><span class="badge badge-approved">예약완료</span></td>
            `;
            recentTbody.appendChild(tr);
        }
    }, (error) => {
        console.error("최근 수업 예약 수신 실패:", error);
        recentTbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="color:red;">데이터를 불러오지 못했습니다.</td></tr>`;
    });
}

// ─── 유저 데이터 검색 헬퍼 (UID -> 전화번호 문서 순서로 교차 조회) ───
async function fetchUserData(member) {
    let uData = null;

    // 1. UID 기반 문서 확인
    if (member.uid) {
        try {
            const uidSnap = await getDoc(doc(db, "users", member.uid));
            if (uidSnap.exists()) uData = uidSnap.data();
        } catch (e) { console.warn("UID 조회 패스:", e); }
    }

    // 2. 전화번호 기반 문서 확인
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

// ─── [4] 관리자용 특정 날짜 수업 예약 목록 조회 ───
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
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div>
                                <strong>${idx + 1}. ${name}</strong> 
                                <span style="font-size: 13px; color: #2563eb; font-weight: 600; margin-left: 6px;">
                                    (${usedCount}회 사용 / ${remainingCount}회 남음)
                                </span>
                                <span style="font-size: 12px; color: #6b7280; margin-left: 8px;">
                                    ${phoneText}
                                </span>
                            </div>
                            <button type="button" 
                                    onclick="window.cancelByAdmin('${m.id}', '${name}', '${selectedDate}', '${time}', '${m.uid || ''}', '${phone}')"
                                    style="background: #fee2e2; border: 1px solid #fca5a5; color: #ef4444; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">
                                예약 취소 (+1회)
                            </button>
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

// ─── [5] 관리자 단에서 직관적 예약 취소 및 1회 환불 ───
window.cancelByAdmin = async (resId, name, dateStr, timeStr, uid, phone) => {
    if (!confirm(`[${dateStr} ${timeStr}] ${name} 회원님의 예약을 취소하고 수강권 1회를 복구하시겠습니까?`)) return;

    try {
        await deleteDoc(doc(db, 'reservations', resId));

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

        alert("🎉 예약이 취소되고 수강권 1회가 복구되었습니다.");
        loadAdminReservations(dateStr);

    } catch (err) {
        console.error("관리자 예약 취소 에러:", err);
        alert("취소 처리 중 오류 발생: " + err.message);
    }
};

// ─── [6] 관리자 접근 권한 검증 ───
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
