import { db } from "./firebase.js";
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// 현재 관리자 화면에서 선택된 회원의 문서 ID (UID 또는 연락처)
let activeUserId = null; 

const memberListContainer = document.getElementById('member-list-container');
const detailPlaceholder = document.getElementById('detail-placeholder');
const detailContent = document.getElementById('detail-content');
const searchInput = document.getElementById('search-input');
const modal = document.getElementById('register-modal');

window.openModal = () => {
    modal.style.display = 'flex';
    document.getElementById('reg-start').value = new Date().toISOString().split('T')[0];
};
window.closeModal = () => {
    modal.style.display = 'none';
    document.getElementById('register-form').reset();
};

// 1. 실시간 리스트 갱신 구동
const usersCol = collection(db, 'users');
onSnapshot(usersCol, (snapshot) => {
    const docsList = snapshot.docs;
    renderMemberList(docsList);
    
    if (activeUserId) {
        const activeDoc = docsList.find(doc => doc.id === activeUserId);
        if (activeDoc) {
            showMemberDetail(activeUserId, activeDoc.data());
        } else {
            closeDetailView();
        }
    }
});

// 2. 회원이 보이는 리스트 출력
function renderMemberList(docs) {
    memberListContainer.innerHTML = '';
    if(docs.length === 0) {
        memberListContainer.innerHTML = '<div style="padding:20px; color:#9ca3af; text-align:center;">등록된 회원이 없습니다.</div>';
        return;
    }

    docs.forEach((doc) => {
        const user = doc.data();
        const id = doc.id; // UID 또는 연락처
        const div = document.createElement('div');
        div.className = `member-item ${activeUserId === id ? 'active' : ''}`;
        
        div.onclick = () => selectMember(id, user);

        // id가 11자리 숫자(연락처) 형태라면 아직 홈페이지 가입을 안 한 '임시 등록 회원'입니다.
        const isTemporary = id.length === 11 && !isNaN(id);
        const joinedBadge = isTemporary ? ' <span style="font-size:10px; color:#f59e0b;">(미가입)</span>' : ' <span style="font-size:10px; color:#10b981;">(가입됨)</span>';

        div.innerHTML = `
            <div>
                <span class="member-name">${user.name}${joinedBadge}</span><br>
                <span class="member-phone">${formatPhone(user.phone)}</span>
            </div>
            <span style="font-size:13px; color: #4f46e5; font-weight:bold;">${user.remainingCount || 0}회 남음</span>
        `;
        memberListContainer.appendChild(div);
    });
}

/* showMemberDetail 수정 코드 */
function selectMember(id, userData) {
    activeUserId = id;
    document.querySelectorAll('.member-item').forEach(item => item.classList.remove('active'));
    showMemberDetail(id, userData);
}

function showMemberDetail(id, user) {
    detailPlaceholder.style.display = 'none';
    detailContent.style.display = 'block';

    // 1. 기본 인적사항
    document.getElementById('det-name').innerText = `${user.name} 회원님`;
    document.getElementById('det-phone').innerText = formatPhone(user.phone);

    // 2. 현재 이용권 상단 요약 정보 (화면 표시용)
    const hasTicket = Boolean(user.ticketType);

    document.getElementById('cur-ticket').innerText = user.ticketType || "없음(이용권 미등록)";
    document.getElementById('cur-count').innerText = hasTicket 
        ? `${user.remainingCount ?? 0}회 / ${user.totalCount ?? 0}회` 
        : "-";
    document.getElementById('cur-period').innerText = user.startDate 
        ? `${user.startDate} ~ ${user.endDate}` 
        : "이용 기간 정보 없음";

    // [일반 취소] 화면 표시
    document.getElementById('cur-cancel-count').innerText = hasTicket 
        ? `${user.remainingCancelCount ?? 0}회 / ${user.totalCancelLimit ?? 0}회` 
        : "-";

    // [당일 취소] 화면 표시
    const curTodayCancelElem = document.getElementById('cur-today-cancel-count');
    if (curTodayCancelElem) {
        curTodayCancelElem.innerText = hasTicket 
            ? `${user.remainingTodayCancelCount ?? 0}회 / ${user.totalTodayCancelLimit ?? 0}회` 
            : "-";
    }

    // 3. 하단 수정 폼 Input 값 바인딩
    document.getElementById('edit-ticket-type').value = user.ticketType || '';
    document.getElementById('edit-total-count').value = user.totalCount ?? 0;
    document.getElementById('edit-remaining-count').value = user.remainingCount ?? 0;
    document.getElementById('edit-start-date').value = user.startDate || '';
    document.getElementById('edit-end-date').value = user.endDate || '';

    // [일반 취소] 수정 Input
    document.getElementById('edit-total-cancel').value = user.totalCancelLimit ?? 0;
    document.getElementById('edit-remaining-cancel').value = user.remainingCancelCount ?? 0;

    // [당일 취소] 수정 Input (안전하게 엘리먼트 존재 여부 확인 후 입력)
    const editTotalToday = document.getElementById('edit-total-today-cancel');
    const editRemainingToday = document.getElementById('edit-remaining-today-cancel');

    if (editTotalToday) {
        editTotalToday.value = user.totalTodayCancelLimit ?? 0;
    }
    if (editRemainingToday) {
        editRemainingToday.value = user.remainingTodayCancelCount ?? 0;
    }

    // 템플릿 셀렉트박스 초기화
    const templateSelect = document.getElementById('edit-template-select');
    if (templateSelect) templateSelect.value = '';
}
/* 여기까지 */

function closeDetailView() {
    activeUserId = null;
    detailPlaceholder.style.display = 'flex';
    detailContent.style.display = 'none';
}

function addDays(dateStr, days) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    date.setDate(date.getDate() + parseInt(days));
    return date.toISOString().split('T')[0];
}

// 이용권 템플릿 변경 자동화 - 수정용
window.applyTemplateToEdit = () => {
    const select = document.getElementById('edit-template-select');
    if (!select.value) return;

    const [count, days] = select.value.split(',');
    const startDate = document.getElementById('edit-start-date').value || new Date().toISOString().split('T')[0];
    
    document.getElementById('edit-start-date').value = startDate;
    document.getElementById('edit-ticket-type').value = `${count}회권 (${days}일)`;
    document.getElementById('edit-total-count').value = count;
    
    // 💡 핵심: 템플릿 선택 시 잔여 횟수도 총 횟수와 동일하게 설정합니다.
    document.getElementById('edit-remaining-count').value = count; 
    
    document.getElementById('edit-end-date').value = addDays(startDate, days);
};


window.calculateEditEndDate = () => {
    const select = document.getElementById('edit-template-select');
    if(select.value) {
        const [_, days] = select.value.split(',');
        const startDate = document.getElementById('edit-start-date').value;
        document.getElementById('edit-end-date').value = addDays(startDate, days);
    }
};

// 이용권 템플릿 변경 자동화 - 신규 등록용
window.applyTemplateToReg = () => {
    const select = document.getElementById('reg-template');
    if(!select.value) return;

    const [count, days] = select.value.split(',');
    const startDate = document.getElementById('reg-start').value || new Date().toISOString().split('T')[0];

    document.getElementById('reg-start').value = startDate;
    document.getElementById('reg-ticket').value = `${count}회권 (${days}일)`;
    document.getElementById('reg-count').value = count;
    document.getElementById('reg-end').value = addDays(startDate, days);
};

window.calculateRegEndDate = () => {
    const select = document.getElementById('reg-template');
    if(select.value) {
        const [_, days] = select.value.split(',');
        const startDate = document.getElementById('reg-start').value;
        document.getElementById('reg-end').value = addDays(startDate, days);
    }
};

// 3. 이용권 수정 저장
// 3. 이용권 수정 저장
window.updateUserTicket = async () => {
    if (!activeUserId) {
        alert("선택된 회원이 없습니다. 왼쪽 목록에서 회원을 먼저 선택해주세요.");
        return;
    }

    const ticketType = document.getElementById('edit-ticket-type')?.value.trim() || "";
    
    // 입력된 숫자를 안전하게 변환하는 함수
    const parseNum = (id) => {
        const elem = document.getElementById(id);
        if (!elem) return 0;
        const val = parseInt(elem.value, 10);
        return isNaN(val) ? 0 : val;
    };

    const totalCount = parseNum('edit-total-count');
    const remainingCount = parseNum('edit-remaining-count'); // 👈 여기서 input의 값을 정상 수집합니다.
    const startDate = document.getElementById('edit-start-date')?.value || "";
    const endDate = document.getElementById('edit-end-date')?.value || "";
    
    // 취소 관련 제한 횟수
    const totalCancelLimit = parseNum('edit-total-cancel');
    const remainingCancelCount = parseNum('edit-remaining-cancel');
    
    // 당일 취소 제한 횟수
    const totalTodayCancelLimit = parseNum('edit-total-today-cancel');
    const remainingTodayCancelCount = parseNum('edit-remaining-today-cancel');

    try {
        const userDocRef = doc(db, 'users', activeUserId);
        await updateDoc(userDocRef, {
            ticketType,
            totalCount,
            remainingCount, // Firestore에 잔여 횟수 정확히 반영
            startDate,
            endDate,
            totalCancelLimit,
            remainingCancelCount,
            totalTodayCancelLimit,
            remainingTodayCancelCount
        });
        alert("이용권 및 잔여 횟수 정보가 성공적으로 수정되었습니다.");
    } catch (err) {
        console.error("수정 오류:", err);
        alert("수정 실패: " + err.message);
    }
};


// 명시적으로 전역(window) 객체에 등록
window.updateUserTicket = updateUserTicket;

// 이용권 제거(초기화)
window.resetUserTicket = async () => {
    if(!activeUserId || !confirm("이 회원의 이용권을 만료/제거 상태로 리셋하시겠습니까?")) return;

    try {
        const userDocRef = doc(db, 'users', activeUserId);
        await updateDoc(userDocRef, {
            ticketType: "",
            totalCount: 0,
            remainingCount: 0,
            startDate: "",
            endDate: "",
            // 총 취소 관련 정보 초기화
            totalCancelLimit: 0,
            remainingCancelCount: 0, // 👈 콤마가 누락되지 않도록 주의하세요!
            // 당일 취소 관련 정보 초기화
            totalTodayCancelLimit: 0,
            remainingTodayCancelCount: 0
        });
        alert("이용권 및 모든 취소 권한 정보가 초기화(제거)되었습니다.");
    } catch (err) {
        alert("초기화 실패: " + err);
    }
};

// 회원 영구 삭제
window.deleteCurrentMember = async () => {
    if(!activeUserId || !confirm("정말로 이 회원을 데이터베이스에서 삭제하시겠습니까?")) return;
    
    const idToDelete = activeUserId;
    closeDetailView();
    
    try {
        const userDocRef = doc(db, 'users', idToDelete);
        await deleteDoc(userDocRef);
        alert("회원이 완전히 삭제되었습니다.");
    } catch (err) {
        alert("삭제 실패: " + err);
    }
};

// 신규 회원 등록 저장 프로세스 (관리자용)
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('reg-phone').value.replace(/[^0-9]/g, '');
    const name = document.getElementById('reg-name').value.trim();
    const ticketType = document.getElementById('reg-ticket').value.trim();
    const totalCount = parseInt(document.getElementById('reg-count').value);
    const startDate = document.getElementById('reg-start').value;
    const endDate = document.getElementById('reg-end').value;
    
    // [수정] 총 취소 횟수와 당일 취소 횟수를 각각 안전하게 가져옵니다.
    const cancelCount = parseInt(document.getElementById('reg-cancel-count').value) || 0;
    const todayCancelCount = parseInt(document.getElementById('reg-today-cancel-count').value) || 0;

    try {
        const querySnapshot = await getDocs(usersCol);
        const registeredUser = querySnapshot.docs.find(doc => doc.data().phone === phone && doc.id !== phone);

        // 공통으로 들어갈 취소 정책 객체 정의
        const cancelData = {
            totalCancelLimit: cancelCount,
            remainingCancelCount: cancelCount,
            totalTodayCancelLimit: todayCancelCount,
            remainingTodayCancelCount: todayCancelCount
        };

        if (registeredUser) {
            // 1. 이미 가입된 유저가 있을 때 (UID 문서 업데이트)
            const userDocRef = doc(db, 'users', registeredUser.id);
            await updateDoc(userDocRef, {
                ticketType, 
                totalCount, 
                remainingCount: totalCount, 
                startDate, 
                endDate,
                ...cancelData // 콤마 누락 에러 방지를 위해 spread 연산자로 안전하게 병합
            });
            alert(`이미 가입된 ${name} 회원님의 계정에 이용권 및 취소 정책을 즉시 부여했습니다.`);
        } else {
            // 2. 가입 전 회원일 때 (전화번호 임시 문서 생성)
            const userDocRef = doc(db, 'users', phone);
            await setDoc(userDocRef, {
                name, 
                phone, 
                ticketType, 
                totalCount, 
                remainingCount: totalCount, 
                startDate, 
                endDate, 
                role: "member",
                ...cancelData // 임시 회원 문서에도 총 취소/당일 취소 필드 모두 저장
            });
            alert("미가입 회원의 임시 정보가 추가되었습니다. 추후 이 번호로 가입하면 즉시 연동됩니다.");
        }
        closeModal();
    } catch (err) {
        console.error("등록 중 발생한 상세 에러:", err);
        alert("등록 실패: " + err);
    }
});

// ==========================================
// members.js 최하단부 대체 코드 (250라인 이하)
// ==========================================

// 전화번호 가독성 변환 포맷터
function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = ('' + phone).replace(/\D/g, '');
    
    if (cleaned.length === 11) {
        return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (cleaned.length === 10) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    return phone;
}

// 실시간 클라이언트 검색 기능
searchInput.addEventListener('input', async (e) => {
    const keyword = e.target.value.toLowerCase();
    try {
        const querySnapshot = await getDocs(usersCol);
        
        // 안전하게 각 필드의 존재 여부를 확인하며 필터링 진행
        const filteredDocs = querySnapshot.docs.filter((doc) => {
            const data = doc.data();
            const name = data.name ? data.name.toLowerCase() : '';
            const phone = data.phone ? data.phone.toLowerCase() : '';
            return name.includes(keyword) || phone.includes(keyword);
        });
        
        renderMemberList(filteredDocs);
    } catch (err) {
        console.error("검색 오류: ", err);
    }
});
