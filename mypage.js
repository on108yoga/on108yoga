// mypage.js (로그아웃 기능 추가 및 에러 수정 완료 버전)
import { db, auth } from './firebase.js';
import { 
    doc, 
    onSnapshot,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

let unsubscribeUser = null;

// 📌 페이지네이션 전역 상태 변수
let allMyReservations = []; // 내 전체 예약 목록 데이터
let currentPage = 1;
const itemsPerPage = 10;    // 한 페이지당 10개씩 표시

// 📌 DOM 로드 후 로그아웃 버튼 이벤트 등록
document.addEventListener("DOMContentLoaded", () => {
    // HTML 상의 로그아웃 버튼 ID를 확인하세요 (예: id="logout-btn" 또는 id="logoutBtn")
    const logoutBtn = document.getElementById('logout-btn') || document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});

// 📌 로그아웃 처리 함수
async function handleLogout(e) {
    if (e) e.preventDefault();

    if (confirm("정말 로그아웃 하시겠습니까?")) {
        try {
            // 실시간 리스너 해제
            if (unsubscribeUser) unsubscribeUser();
            
            await signOut(auth);
            alert("로그아웃 되었습니다.");
            window.location.href = "index.html"; // 로그인 페이지 또는 메인으로 이동
        } catch (error) {
            console.error("🚨 로그아웃 처리 중 오류 발생:", error);
            alert("로그아웃에 실패했습니다. 다시 시도해 주세요.");
        }
    }
}

// 로그인 상태 감지
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("🔑 로그인 감지된 계정:", user);
        await initMyPageSync(user);
    } else {
        alert("로그인이 필요합니다. 로그인 페이지로 이동합니다.");
        window.location.href = "index.html";
    }
});

// 📌 [1] 내 예약 목록 불러오기 함수
async function loadMyReservations(userOrUid) {
    const listContainer = document.getElementById('reservation-list');
    const loadingElem = document.getElementById('reservation-loading');
    const paginationContainer = document.getElementById('reservation-pagination');

    if (!listContainer) return;

    try {
        const currentUser = auth.currentUser;
        
        // 1. 회원 식별 키값들 전부 추출
        const uid = typeof userOrUid === 'string' ? userOrUid : (userOrUid?.uid || currentUser?.uid || "");
        const rawEmail = currentUser?.email || "";
        
        // 가상 이메일에서 Pure ID(전화번호)만 추출
        const pureId = rawEmail.includes('@') ? rawEmail.split('@')[0] : rawEmail;
        const cleanPhone = pureId.replace(/[^0-9]/g, '');

        console.log(`🔍 [예약 내역 조회 조건] UID: "${uid}", PureID: "${pureId}", Phone: "${cleanPhone}"`);

        // 2. reservations 데이터 가져오기
        const querySnapshot = await getDocs(collection(db, "reservations"));
        console.log("📦 전체 예약 건수:", querySnapshot.size);

        allMyReservations = [];

        // 3. 내 예약 필터링
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            
            const targetUser = String(data.userId || data.uid || data.phone || data.user_id || data.memberId || "");
            const targetPhone = targetUser.replace(/[^0-9]/g, '');

            const isMatch = 
                (uid && targetUser === uid) ||
                (pureId && targetUser === pureId) ||
                (rawEmail && targetUser === rawEmail) ||
                (cleanPhone && cleanPhone.length >= 8 && targetPhone === cleanPhone);

            if (isMatch) {
                allMyReservations.push({ id: docSnap.id, ...data });
            }
        });

        console.log("🎉 [회원 예약 내역 매칭 성공]:", allMyReservations);

        if (loadingElem) loadingElem.style.display = 'none';

        if (allMyReservations.length === 0) {
            listContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #888;">
                    아직 예약된 내역이 없습니다.
                </div>
            `;
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        // 날짜 내림차순 정렬
        allMyReservations.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        // 4. 첫 페이지 렌더링
        currentPage = 1;
        renderReservationPage(currentPage);

    } catch (error) {
        console.error("🚨 예약 내역 조회 오류:", error);
        if (loadingElem) {
            loadingElem.innerText = `오류 발생: ${error.message}`;
        }
    }
}

// 📌 [1-1] 특정 페이지 예약 목록 출력 함수
function renderReservationPage(page) {
    const listContainer = document.getElementById('reservation-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    // 오늘 날짜 계산 (YYYY-MM-DD)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = allMyReservations.slice(startIndex, endIndex);

    pageData.forEach((res) => {
        const itemCard = document.createElement('div');
        itemCard.className = 'reservation-card';

        const isPastDate = res.date && res.date < todayStr;
        const isCanceled = res.status === 'canceled';

        let statusBadge = '';
        if (isCanceled) {
            statusBadge = `<span class="badge badge-canceled">취소됨</span>`;
        } else if (isPastDate) {
            statusBadge = `<span class="badge badge-expired-red">예약만료</span>`;
        } else {
            statusBadge = `<span class="badge badge-active">예약완료</span>`;
        }

        itemCard.innerHTML = `
            <div class="res-info">
                <span class="res-date">📅 ${res.date || '날짜 없음'}</span>
                <span class="res-time">⏰ ${res.time || '시간 없음'}</span>
                ${res.className ? `<span class="res-class">🧘 ${res.className}</span>` : ''}
            </div>
            <div class="res-status">
                ${statusBadge}
            </div>
        `;
        listContainer.appendChild(itemCard);
    });

    listContainer.scrollTop = 0;
    renderPaginationControls(allMyReservations.length, page);
}

// 📌 [1-2] 하단 페이지 번호 버튼 생성 함수
function renderPaginationControls(totalItems, activePage) {
    const paginationContainer = document.getElementById('reservation-pagination');
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === activePage ? 'active' : ''}`;
        btn.innerText = i;
        btn.onclick = () => {
            currentPage = i;
            renderReservationPage(i);
        };
        paginationContainer.appendChild(btn);
    }
}

// 📌 [2] 회원 데이터 동기화 시작
async function initMyPageSync(user) {
    if (unsubscribeUser) unsubscribeUser();

    // 1. Auth 기준 기본 아이디 표시
    const userIdElem = document.getElementById('user-id');
    if (userIdElem) {
        const rawPhone = user.phoneNumber || "";
        let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith("82")) cleanPhone = "0" + cleanPhone.substring(2);

        userIdElem.innerText = user.email || cleanPhone || user.phoneNumber || "소셜 로그인 계정";
    }

    // 1단계: user.uid 기반 탐색
    const uidDocRef = doc(db, 'users', user.uid);
    try {
        const uidSnap = await getDocs(query(collection(db, 'users'), where("__name__", "==", user.uid)));
        if (!uidSnap.empty) {
            console.log("✅ [1단계 성공] Auth UID 매칭:", user.uid);
            bindRealtimeListener(uidDocRef);
            loadMyReservations(user);
            return;
        }
    } catch (e) {
        console.warn("1단계 탐색 중 오류:", e);
    }

    // 2단계: 전화번호 문서 ID 탐색
    let userPhone = user.phoneNumber || user.photoURL || ""; 
    let cleanPhone = userPhone.replace(/[^0-9]/g, '');

    if (cleanPhone.startsWith("82")) {
        cleanPhone = "0" + cleanPhone.substring(2);
    }

    if (cleanPhone) {
        const phoneDocRef = doc(db, 'users', cleanPhone);
        console.log("🔍 [2단계 시도] 전화번호 문서 ID 탐색:", cleanPhone);
        bindRealtimeListener(phoneDocRef);
        loadMyReservations(user);
        return;
    }

    // 3단계: 기타 방식 대비 예약 내역 직접 로드
    loadMyReservations(user);
}

// 실시간 감시 스냅샷 연결
function bindRealtimeListener(docRef) {
    unsubscribeUser = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            console.log("🎉 실시간 수신 데이터:", docSnap.data());
            renderMyPageUI(docSnap.data(), docSnap.id);
        } else {
            console.warn("⚠️ 문서를 찾을 수 없습니다:", docRef.id);
        }
    }, (error) => {
        console.error("🚨 실시간 구독 오류:", error);
    });
}

// 화면 UI 랜더링 함수
function renderMyPageUI(data, docId = "") {
    const user = auth.currentUser;

    const userIdElem = document.getElementById('user-id');
    if (userIdElem) {
        let authPhone = (user?.phoneNumber || "").replace(/[^0-9]/g, '');
        if (authPhone.startsWith("82")) authPhone = "0" + authPhone.substring(2);

        let dbPhone = (data.phone || data.phoneNumber || "").replace(/[^0-9]/g, '');

        const displayId = data.userId ||            
                          data.email ||             
                          user?.email ||            
                          authPhone ||              
                          dbPhone ||                
                          data.id ||                
                          user?.uid ||              
                          "-";
        console.log("🆔 최종 표시될 아이디:", displayId);
        userIdElem.innerText = displayId;
    }

    // 1. 회원 이름
    const userNameElem = document.getElementById('user-name');
    if (userNameElem) userNameElem.innerText = data.name || "회원";

    // 2. 이용권 정보
    const ticketNameElem = document.getElementById('ticket-name');
    const totalCountElem = document.getElementById('total-count');
    const remainingCountElem = document.getElementById('remaining-count');
    const startDateElem = document.getElementById('start-date');
    const endDateElem = document.getElementById('end-date');

    const remCount = data.remainingCount ?? data.ticketCount ?? 0;

    if (data.ticketType && data.ticketType.trim() !== "") {
        if (ticketNameElem) {
            const ticketDate = data.startDate || "날짜 미정";
            
            let cleanTicketName = data.ticketType
                .replace(/\(\d+회\)/g, '')
                .replace(/추가/g, '')
                .trim();
            
            ticketNameElem.innerHTML = `
                <span style="font-size: 14px; font-weight: 600; color: #ff6b00;">
                    알림! ${cleanTicketName} 
                    <span style="color: #888888; font-weight: normal;">(${ticketDate})</span>
                    등록이 완료되었습니다 :)
                </span>
            `;
        }
        if (totalCountElem) totalCountElem.innerText = `${data.totalCount || 0}회`;
        if (remainingCountElem) remainingCountElem.innerText = `${remCount}회`;

        if (startDateElem) startDateElem.innerText = data.startDate || "-";
        if (endDateElem) endDateElem.innerText = data.endDate || "-";
    } else {
        if (ticketNameElem) {
            ticketNameElem.innerText = "보유하신 이용권이 없습니다.";
            ticketNameElem.style.color = "#6b7280";
            ticketNameElem.style.fontSize = "14px";
        }
        if (totalCountElem) totalCountElem.innerText = "0회";
        if (remainingCountElem) remainingCountElem.innerText = "0회";
        if (startDateElem) startDateElem.innerText = "-";
        if (endDateElem) endDateElem.innerText = "-";
    }
    
    // 3. 일반 취소 정책
    const totalCancel = data.totalCancelLimit ?? data.totalCancel ?? 0;
    const remainingCancel = data.remainingCancelCount ?? data.remainingCancel ?? 0;

    const totalCancelElem = document.getElementById('total-cancel');
    const remainingCancelElem = document.getElementById('remaining-cancel');

    if (totalCancelElem) totalCancelElem.innerText = `${totalCancel}회`;
    if (remainingCancelElem) {
        remainingCancelElem.innerText = `${remainingCancel}회`;
        if (remainingCancel <= 0) remainingCancelElem.classList.add('danger');
        else remainingCancelElem.classList.remove('danger');
    }

    // 4. 당일 취소 정책
    const totalTodayCancel = data.totalTodayCancelLimit ?? data.totalTodayCancel ?? 0;
    const remainingTodayCancel = data.remainingTodayCancelCount ?? data.remainingTodayCancel ?? 0;

    const totalTodayCancelElem = document.getElementById('total-today-cancel');
    const remainingTodayCancelElem = document.getElementById('remaining-today-cancel');

    if (totalTodayCancelElem) totalTodayCancelElem.innerText = `${totalTodayCancel}회`;
    if (remainingTodayCancelElem) {
        remainingTodayCancelElem.innerText = `${remainingTodayCancel}회`;
        if (remainingTodayCancel <= 0) remainingTodayCancelElem.classList.add('danger');
        else remainingTodayCancelElem.classList.remove('danger');
    }
}
