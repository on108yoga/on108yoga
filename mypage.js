// mypage.js (중복 제거 및 완전체 버전)
import { db, auth } from './firebase.js';
import { 
    doc, 
    onSnapshot,
    collection,
    query,
    where,
    getDocs,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

let unsubscribeUser = null;

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
// mypage.js
// mypage.js
async function loadMyReservations(userOrUid) {
    const listContainer = document.getElementById('reservation-list');
    const loadingElem = document.getElementById('reservation-loading');

    if (!listContainer) return;

    try {
        const currentUser = auth.currentUser;
        
        // 1. 회원 식별 키값들 전부 추출
        const uid = typeof userOrUid === 'string' ? userOrUid : (userOrUid?.uid || currentUser?.uid || "");
        const rawEmail = currentUser?.email || "";
        
        // @yoga.local 같은 가상 이메일에서 Pure ID(전화번호)만 추출 (예: 01021230991)
        const pureId = rawEmail.includes('@') ? rawEmail.split('@')[0] : rawEmail;
        const cleanPhone = pureId.replace(/[^0-9]/g, '');

        console.log(`🔍 [예약 내역 조회 조건] UID: "${uid}", PureID: "${pureId}", Phone: "${cleanPhone}"`);

        // 2. reservations 데이터 가져오기
        const querySnapshot = await getDocs(collection(db, "reservations"));
        console.log("📦 전체 예약 건수:", querySnapshot.size);

        let myReservations = [];

        // 3. 다양한 필드명/값 형태를 모두 비교
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            
            // DB에 저장될 수 있는 다양한 필드값
            const targetUser = String(data.userId || data.uid || data.phone || data.user_id || data.memberId || "");
            const targetPhone = targetUser.replace(/[^0-9]/g, '');

            // 매칭 조건: UID 일치 OR 순수아이디/이메일 일치 OR 전화번호 일치
            const isMatch = 
                (uid && targetUser === uid) ||
                (pureId && targetUser === pureId) ||
                (rawEmail && targetUser === rawEmail) ||
                (cleanPhone && cleanPhone.length >= 8 && targetPhone === cleanPhone);

            if (isMatch) {
                myReservations.push({ id: docSnap.id, ...data });
            }
        });

        console.log("🎉 [회원 예약 내역 매칭 성공]:", myReservations);

        // 4. UI 출력
        if (loadingElem) loadingElem.style.display = 'none';
        listContainer.innerHTML = '';

        if (myReservations.length === 0) {
            listContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #888;">
                    아직 예약된 내역이 없습니다.
                </div>
            `;
            return;
        }

        // 날짜 내림차순 정렬
        myReservations.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        myReservations.forEach((res) => {
            const itemCard = document.createElement('div');
            itemCard.className = 'reservation-card';
            itemCard.innerHTML = `
                <div class="res-info">
                    <span class="res-date">📅 ${res.date || '날짜 없음'}</span>
                    <span class="res-time">⏰ ${res.time || '시간 없음'}</span>
                    ${res.className ? `<span class="res-class">🧘 ${res.className}</span>` : ''}
                </div>
                <div class="res-status">
                    <span class="badge ${res.status === 'canceled' ? 'badge-canceled' : 'badge-active'}">
                        ${res.status === 'canceled' ? '취소됨' : '예약완료'}
                    </span>
                </div>
            `;
            listContainer.appendChild(itemCard);
        });

    } catch (error) {
        console.error("🚨 예약 내역 조회 오류:", error);
        if (loadingElem) {
            loadingElem.innerText = `오류 발생: ${error.message}`;
        }
    }
}


// [2] 회원 데이터 동기화 시작
async function initMyPageSync(user) {
    if (unsubscribeUser) unsubscribeUser();

    // 🆔 1. Auth 기준 기본 아이디 우선 표시 (이메일 또는 전화번호)
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
            // 👇 예약 내역 불러오기 함수 호출 추가
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
        return;
    }

    // 3단계: DB 전체 검색 (휴대폰 번호 조건 검색)
    await searchUserInFirestore(user);
}

// 실시간 감시 스냅샷 연결
function bindRealtimeListener(docRef) {
    unsubscribeUser = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            console.log("🎉 실시간 수신 데이터:", docSnap.data());
            // 문서 데이터와 함께 docSnap.id (문서 ID)도 넘겨줍니다.
            renderMyPageUI(docSnap.data(), docSnap.id);
        } else {
            console.warn("⚠️ 문서를 찾을 수 없습니다:", docRef.id);
            const user = auth.currentUser;
            if (user) searchUserInFirestore(user);
        }
    }, (error) => {
        console.error("🚨 실시간 구독 오류:", error);
    });
}

// 화면 UI 랜더링 함수
function renderMyPageUI(data, docId = "") {
    const user = auth.currentUser;

    // 🆔 2. 아이디 표시 (DB의 userId/email 필드 -> 문서 ID -> Auth 이메일/전화번호 순)
    const userIdElem = document.getElementById('user-id');
    if (userIdElem) {
        // 1. Auth 전화번호 정형화 (8210... -> 010...)
        let authPhone = (user?.phoneNumber || "").replace(/[^0-9]/g, '');
        if (authPhone.startsWith("82")) authPhone = "0" + authPhone.substring(2);

        // 2. DB 전화번호 정형화
        let dbPhone = (data.phone || data.phoneNumber || "").replace(/[^0-9]/g, '');

       // 3. 우선순위에 따라 있는 값을 선택
        const displayId = data.userId ||            // DB에 'userId' 필드가 있는 경우
                          data.email ||             // DB에 'email' 필드가 있는 경우
                          user?.email ||            // Auth 계정에 이메일이 있는 경우
                          authPhone ||              // Auth 계정에 전화번호가 있는 경우
                          dbPhone ||                // DB에 전화번호가 있는 경우
                          data.id ||                // DB에 'id' 필드가 있는 경우
                          user?.uid ||              // 최후의 수단: Auth UID
                          "-";
        console.log("🆔 최종 표시될 아이디:", displayId); // 콘솔에서 확인용
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

    if (data.ticketType && data.ticketType.trim() !== "") {
        if (ticketNameElem) {
            ticketNameElem.innerText = data.ticketType;
            ticketNameElem.style.color = "var(--primary-color)";
        }
        if (totalCountElem) totalCountElem.innerText = `${data.totalCount || 0}회`;
        
        const remCount = data.remainingCount ?? data.ticketCount ?? 0;
        if (remainingCountElem) remainingCountElem.innerText = `${remCount}회`;

        if (startDateElem) startDateElem.innerText = data.startDate || "-";
        if (endDateElem) endDateElem.innerText = data.endDate || "-";
    } else {
        if (ticketNameElem) {
            ticketNameElem.innerText = "보유하신 이용권이 없습니다.";
            ticketNameElem.style.color = "#6b7280";
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
