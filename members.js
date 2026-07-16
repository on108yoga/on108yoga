// 1. Firebase 설정 (본인 키 값으로 수정 필수!)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let activeUserPhone = null; // 현재 선택되어 상세보기에 표시 중인 회원의 연락처(ID)

// DOM 캐싱
const memberListContainer = document.getElementById('member-list-container');
const detailPlaceholder = document.getElementById('detail-placeholder');
const detailContent = document.getElementById('detail-content');
const searchInput = document.getElementById('search-input');
const modal = document.getElementById('register-modal');

// 모달 핸들러
window.openModal = () => {
    modal.style.display = 'flex';
    document.getElementById('reg-start').value = new Date().toISOString().split('T')[0];
};
window.closeModal = () => {
    modal.style.display = 'none';
    document.getElementById('register-form').reset();
};

// 2. 실시간 리스트 갱신 구동
db.collection('users').onSnapshot((snapshot) => {
    renderMemberList(snapshot.docs);
    // 현재 열려 있는 유저가 있다면 실시간 동기화하여 상세뷰도 자동 갱신
    if (activeUserPhone) {
        const activeDoc = snapshot.docs.find(doc => doc.id === activeUserPhone);
        if (activeDoc) {
            showMemberDetail(activeDoc.data());
        } else {
            closeDetailView();
        }
    }
});

// 3. [1번 기능] 회원이 보이는 리스트 출력
function renderMemberList(docs) {
    memberListContainer.innerHTML = '';
    if(docs.length === 0) {
        memberListContainer.innerHTML = '<div style="padding:20px; color:#9ca3af; text-align:center;">등록된 회원이 없습니다.</div>';
        return;
    }

    docs.forEach((doc) => {
        const user = doc.data();
        const div = document.createElement('div');
        div.className = `member-item ${activeUserPhone === user.phone ? 'active' : ''}`;
        div.onclick = () => selectMember(user.phone, user);

        div.innerHTML = `
            <div>
                <span class="member-name">${user.name}</span><br>
                <span class="member-phone">${formatPhone(user.phone)}</span>
            </div>
            <span style="font-size:13px; color: #4f46e5; font-weight:bold;">${user.remainingCount}회 남음</span>
        `;
        memberListContainer.appendChild(div);
    });
}

// 4. [2번 기능] 회원 선택하여 정보 우측 화면에 송출
function selectMember(phone, userData) {
    activeUserPhone = phone;
    // 리스트에서 active 클래스 교체
    document.querySelectorAll('.member-item').forEach(item => item.classList.remove('active'));
    
    showMemberDetail(userData);
}

function showMemberDetail(user) {
    detailPlaceholder.style.display = 'none';
    detailContent.style.display = 'block';

    // [2] 텍스트 정보 노출
    document.getElementById('det-name').innerText = `${user.name} 회원님`;
    document.getElementById('det-phone').innerText = formatPhone(user.phone);

    // [3] 현재 이용권 및 기간 출력
    document.getElementById('cur-ticket').innerText = user.ticketType || "없음(이용권 미등록)";
    document.getElementById('cur-count').innerText = user.ticketType ? `${user.remainingCount}회 / ${user.totalCount}회` : "-";
    document.getElementById('cur-period').innerText = user.startDate ? `${user.startDate} ~ ${user.endDate}` : "이용 기간 정보 없음";

    // [4] 수정 폼에 기존 정보 채워넣기
    document.getElementById('edit-ticket-type').value = user.ticketType || '';
    document.getElementById('edit-total-count').value = user.totalCount || 0;
    document.getElementById('edit-remaining-count').value = user.remainingCount || 0;
    document.getElementById('edit-start-date').value = user.startDate || '';
    document.getElementById('edit-end-date').value = user.endDate || '';
    document.getElementById('edit-template-select').value = ''; // 프리셋 초기화
}

function closeDetailView() {
    activeUserPhone = null;
    detailPlaceholder.style.display = 'flex';
    detailContent.style.display = 'none';
}

// 5. 날짜 더하기 헬퍼 함수 (시작일 + 일수 = 만료일 계산)
function addDays(dateStr, days) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    date.setDate(date.getDate() + parseInt(days));
    return date.toISOString().split('T')[0];
}

// [4번 기능] 이용권 템플릿 변경 자동화 - 수정용
window.applyTemplateToEdit = () => {
    const select = document.getElementById('edit-template-select');
    if(!select.value) return;

    const [count, days] = select.value.split(',');
    const startDate = document.getElementById('edit-start-date').value || new Date().toISOString().split('T')[0];
    
    document.getElementById('edit-start-date').value = startDate;
    document.getElementById('edit-ticket-type').value = `${count}회권 (${days}일)`;
    document.getElementById('edit-total-count').value = count;
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

// 6. [4번 기능] 이용권 변경 (수정 및 적용 저장)
window.updateUserTicket = () => {
    if(!activeUserPhone) return;

    const ticketType = document.getElementById('edit-ticket-type').value.trim();
    const totalCount = parseInt(document.getElementById('edit-total-count').value) || 0;
    const remainingCount = parseInt(document.getElementById('edit-remaining-count').value) || 0;
    const startDate = document.getElementById('edit-start-date').value;
    const endDate = document.getElementById('edit-end-date').value;

    db.collection('users').doc(activeUserPhone).update({
        ticketType,
        totalCount,
        remainingCount,
        startDate,
        endDate
    })
    .then(() => alert("이용권 정보가 성공적으로 변경되었습니다."))
    .catch(err => alert("수정 실패: " + err));
};

// [4번 기능] 이용권 제거(초기화)
window.resetUserTicket = () => {
    if(!activeUserPhone || !confirm("이 회원의 이용권을 만료/제거 상태로 리셋하시겠습니까?")) return;

    db.collection('users').doc(activeUserPhone).update({
        ticketType: "",
        totalCount: 0,
        remainingCount: 0,
        startDate: "",
        endDate: ""
    })
    .then(() => alert("이용권이 제거되었습니다."))
    .catch(err => alert("초기화 실패: " + err));
};

// 회원 영구 삭제
window.deleteCurrentMember = () => {
    if(!activeUserPhone || !confirm("정말로 이 회원을 데이터베이스에서 삭제하시겠습니까?")) return;
    
    const phoneToDelete = activeUserPhone;
    closeDetailView();
    
    db.collection('users').doc(phoneToDelete).delete()
    .then(() => alert("회원이 완전히 삭제되었습니다."))
    .catch(err => alert("삭제 실패: " + err));
};

// 신규 회원 등록 저장 프로세스
document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const phone = document.getElementById('reg-phone').value.replace(/[^0-9]/g, '');
    const name = document.getElementById('reg-name').value.trim();
    const ticketType = document.getElementById('reg-ticket').value.trim();
    const totalCount = parseInt(document.getElementById('reg-count').value);
    const startDate = document.getElementById('reg-start').value;
    const endDate = document.getElementById('reg-end').value;

    db.collection('users').doc(phone).set({
        name, phone, ticketType, totalCount, remainingCount: totalCount, startDate, endDate
    })
    .then(() => {
        alert("회원이 추가되었습니다.");
        closeModal();
    })
    .catch(err => alert("등록 실패: " + err));
});

// 전화번호 포맷팅 가독성 헬퍼 함수
function formatPhone(phone) {
    if(phone.length === 11) {
        return phone.replace(/(\hd{3})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    return phone;
}

// 실시간 검색 기능
searchInput.addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase();
    db.collection('users').get().then((snapshot) => {
        const filteredDocs = snapshot.docs.filter(doc => {
            const data = doc.data();
            return data.name.toLowerCase().includes(keyword) || data.phone.includes(keyword);
        });
        renderMemberList(filteredDocs);
    });
});
