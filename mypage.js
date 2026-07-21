// mypage.js (전화번호 문서 ID 및 Auth UID 이중 지원 버전)
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
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

let unsubscribeUser = null;

onAuthStateChanged(auth, async (user) => {
   if (user) {
        console.log("🔑 로그인 감지된 계정:", user);
        await initMyPageSync(user);
    } else {
        alert("로그인이 필요합니다. 로그인 페이지로 이동합니다.");
        window.location.href = "index.html";
    }
});
async function initMyPageSync(user) {
    if (unsubscribeUser) unsubscribeUser();

    // 1단계: user.uid 기반 탐색
    const uidDocRef = doc(db, 'users', user.uid);
    const uidSnap = await getDocs(query(collection(db, 'users'), where("__name__", "==", user.uid)));

    if (!uidSnap.empty) {
        console.log("✅ [1단계 성공] Auth UID 매칭:", user.uid);
        bindRealtimeListener(uidDocRef);
        return;
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

    // 3단계: 전체 검색
    await searchUserInFirestore(user);
}

function bindRealtimeListener(docRef) {
    unsubscribeUser = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            console.log("🎉 실시간 수신 데이터:", docSnap.data());
            renderMyPageUI(docSnap.data());
        } else {
            console.warn("⚠️ 문서를 찾을 수 없습니다:", docRef.id);
            const user = auth.currentUser;
            if (user) searchUserInFirestore(user);
        }
    }, (error) => {
        console.error("🚨 실시간 구독 오류:", error);
    });
}

async function searchUserInFirestore(user) {
    try {
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);

        let targetDocId = null;
        const authPhoneClean = (user.phoneNumber || "").replace(/[^0-9]/g, '').replace(/^82/, '0');

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const dbPhoneClean = (data.phone || "").replace(/[^0-9]/g, '');

            if ((authPhoneClean && dbPhoneClean && authPhoneClean === dbPhoneClean) || 
                (authPhoneClean && docSnap.id === authPhoneClean)) {
                targetDocId = docSnap.id;
            }
        });

        if (targetDocId) {
            console.log("✅ [3단계 성공] DB 내부 전화번호 매칭 Doc ID:", targetDocId);
            bindRealtimeListener(doc(db, 'users', targetDocId));
        } else {
            console.error("❌ DB에서 해당 회원 정보를 찾을 수 없습니다.");
        }
    } catch (err) {
        console.error("검색 프로세스 에러:", err);
    }
}

function renderMyPageUI(data) {
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

    // 3. 일반 취소
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

    // 4. 당일 취소
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


/* 기존 태그 */
async function startRealtimeMyPage(user) {
    if (unsubscribeUser) unsubscribeUser();

    // 1단계: 먼저 auth.uid 기준으로 문서를 찾아봅니다.
    let targetDocId = user.uid;
    let userDocRef = doc(db, 'users', targetDocId);

    // 2단계: Auth에 등록된 전화번호나 입력된 정보로 전화번호 문서가 있는지 체크
    // Firebase Auth user.phoneNumber (예: +821012345678 -> 01012345678로 변환)
    let cleanPhone = "";
    if (user.phoneNumber) {
        cleanPhone = user.phoneNumber.replace("+82", "0").replace(/[^0-9]/g, '');
    }

    // 만약 cleanPhone이 존재하고, 관리자가 전화번호(예: 01012345678)로 미리 등록한 문서가 있다면 그 ID를 우선 사용
    if (cleanPhone) {
        const phoneDocRef = doc(db, 'users', cleanPhone);
        // 전화번호 문서 실시간 연결
        bindSnapshot(phoneDocRef);
        return;
    }

    // 전화번호 형태의 Auth 계정이 아니라면 일단 UID 문서 연결
    bindSnapshot(userDocRef);
}

function bindSnapshot(docRef) {
    unsubscribeUser = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            renderMyPageUI(data);
        } else {
            console.warn("Firestore에서 회원 정보를 찾을 수 없습니다. (ID:", docRef.id, ")");
            // fallback: 전화번호 컬렉션 검색 시도
            searchUserByPhoneQuery();
        }
    }, (error) => {
        console.error("실시간 데이터 연동 실패:", error);
    });
}

// 회원의 phone 필드로 users 컬렉션을 2차 검색
async function searchUserByPhoneQuery() {
    const user = auth.currentUser;
    if (!user) return;

    let phone = user.phoneNumber ? user.phoneNumber.replace("+82", "0").replace(/[^0-9]/g, '') : "";
    
    if (!phone) return;

    try {
        const q = query(collection(db, "users"), where("phone", "==", phone));
        const querySnap = await getDocs(q);

        if (!querySnap.empty) {
            const foundDoc = querySnap.docs[0];
            // 해당 문서 ID로 실시간 구독 다시 설정
            if (unsubscribeUser) unsubscribeUser();
            unsubscribeUser = onSnapshot(doc(db, "users", foundDoc.id), (snap) => {
                if (snap.exists()) renderMyPageUI(snap.data());
            });
        }
    } catch (err) {
        console.error("2차 검색 오류:", err);
    }
}

// 화면 랜더링 전용 함수
function renderMyPageUI(data) {
    // 1. 회원 이름
    const userNameElem = document.getElementById('user-name');
    if (userNameElem) userNameElem.innerText = data.name || "회원";

    // 2. 이용권 정보
    const ticketNameElem = document.getElementById('ticket-name');
    const totalCountElem = document.getElementById('total-count');
    const remainingCountElem = document.getElementById('remaining-count');
    const startDateElem = document.getElementById('start-date');
    const endDateElem = document.getElementById('end-date');

    if (data.ticketType && data.ticketType !== "") {
        if (ticketNameElem) {
            ticketNameElem.innerText = data.ticketType;
            ticketNameElem.style.color = "var(--primary-color)";
        }
        if (totalCountElem) totalCountElem.innerText = `${data.totalCount || 0}회`;
        
        // remainingCount 최우선 적용
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

    // 3. 취소 정책 (A안 - 총 취소 횟수)
    const totalCancel = data.totalCancelLimit ?? data.totalCancel ?? 0;
    const remainingCancel = data.remainingCancelCount ?? data.remainingCancel ?? 0;

    const totalCancelElem = document.getElementById('total-cancel');
    const remainingCancelElem = document.getElementById('remaining-cancel');

    if (totalCancelElem) totalCancelElem.innerText = `${totalCancel}회`;
    if (remainingCancelElem) {
        remainingCancelElem.innerText = `${remainingCancel}회`;
        if (remainingCancel <= 0) {
            remainingCancelElem.classList.add('danger');
        } else {
            remainingCancelElem.classList.remove('danger');
        }
    }

    // 4. 취소 정책 (B안 - 당일 취소 횟수)
    const totalTodayCancel = data.totalTodayCancelLimit ?? data.totalTodayCancel ?? 0;
    const remainingTodayCancel = data.remainingTodayCancelCount ?? data.remainingTodayCancel ?? 0;

    const totalTodayCancelElem = document.getElementById('total-today-cancel');
    const remainingTodayCancelElem = document.getElementById('remaining-today-cancel');

    if (totalTodayCancelElem) totalTodayCancelElem.innerText = `${totalTodayCancel}회`;
    if (remainingTodayCancelElem) {
        remainingTodayCancelElem.innerText = `${remainingTodayCancel}회`;
        if (remainingTodayCancel <= 0) {
            remainingTodayCancelElem.classList.add('danger');
        } else {
            remainingTodayCancelElem.classList.remove('danger');
        }
    }
}
