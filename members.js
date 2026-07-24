import { db } from "./firebase.js"; // Firebase 설정 파일

import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    addDoc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// 현재 관리자 화면에서 선택된 회원의 문서 ID (UID 또는 연락처)
let activeUserId = null; 

// 🎯 페이지네이션 관련 변수
const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let currentDocsList = []; // 현재 필터링/조회된 전체 문서 리스트 저장용

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
    currentDocsList = snapshot.docs;
    
    // 데이터 변경 시 현재 페이지에 맞게 리스트 및 페이지네이션 렌더링
    renderMemberList(currentDocsList, currentPage);
    renderPagination(currentDocsList.length);
    
    if (activeUserId) {
        const activeDoc = currentDocsList.find(doc => doc.id === activeUserId);
        if (activeDoc) {
            showMemberDetail(activeUserId, activeDoc.data());
        } else {
            closeDetailView();
        }
    }
});

// 2. 회원이 보이는 리스트 출력 (페이지네이션 적용)
function renderMemberList(docs, page = 1) {
    memberListContainer.innerHTML = '';
    
    if (docs.length === 0) {
        memberListContainer.innerHTML = '<div style="padding:20px; color:#9ca3af; text-align:center;">등록된 회원이 없습니다.</div>';
        return;
    }

    // 🎯 10개씩 슬라이싱
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedDocs = docs.slice(startIndex, endIndex);

    paginatedDocs.forEach((doc) => {
        const user = doc.data();
        const id = doc.id; // UID 또는 연락처
        const div = document.createElement('div');
        div.className = `member-item ${activeUserId === id ? 'active' : ''}`;
        
        div.onclick = () => selectMember(id, user);

        // id가 11자리 숫자(연락처) 형태라면 임시 등록 회원
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

// 🎯 페이지네이션 버튼 UI 생성 및 컨트롤
function renderPagination(totalItems) {
    let paginationContainer = document.getElementById('pagination-container');
    
    // HTML에 pagination-container가 없으면 회원목록 바로 아래에 자동 생성
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'pagination-container';
        paginationContainer.style.cssText = 'display: flex; justify-content: center; gap: 5px; padding: 15px 0;';
        memberListContainer.after(paginationContainer);
    }

    paginationContainer.innerHTML = '';
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (totalPages <= 1) return; // 1페이지 이하면 버튼 감춤

    // [이전] 버튼
    const prevBtn = document.createElement('button');
    prevBtn.innerText = '‹';
    prevBtn.style.cssText = 'padding: 5px 10px; cursor: pointer; border: 1px solid #ddd; background: #fff; border-radius: 4px;';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => changePage(currentPage - 1);
    paginationContainer.appendChild(prevBtn);

    // [숫자] 버튼
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        const isActive = i === currentPage;
        btn.style.cssText = `padding: 5px 10px; cursor: pointer; border: 1px solid ${isActive ? '#4f46e5' : '#ddd'}; background: ${isActive ? '#4f46e5' : '#fff'}; color: ${isActive ? '#fff' : '#333'}; border-radius: 4px; font-weight: bold;`;
        btn.onclick = () => changePage(i);
        paginationContainer.appendChild(btn);
    }

    // [다음] 버튼
    const nextBtn = document.createElement('button');
    nextBtn.innerText = '›';
    nextBtn.style.cssText = 'padding: 5px 10px; cursor: pointer; border: 1px solid #ddd; background: #fff; border-radius: 4px;';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => changePage(currentPage + 1);
    paginationContainer.appendChild(nextBtn);
}

// 🎯 페이지 이동 함수
function changePage(newPage) {
    currentPage = newPage;
    renderMemberList(currentDocsList, currentPage);
    renderPagination(currentDocsList.length);
}

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

    // 2. 현재 이용권 상단 요약 정보
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

    document.getElementById('edit-total-cancel').value = user.totalCancelLimit ?? 0;
    document.getElementById('edit-remaining-cancel').value = user.remainingCancelCount ?? 0;

    const editTotalToday = document.getElementById('edit-total-today-cancel');
    const editRemainingToday = document.getElementById('edit-remaining-today-cancel');

    if (editTotalToday) editTotalToday.value = user.totalTodayCancelLimit ?? 0;
    if (editRemainingToday) editRemainingToday.value = user.remainingTodayCancelCount ?? 0;

    const templateSelect = document.getElementById('edit-template-select');
    if (templateSelect) templateSelect.value = '';

    loadPaymentHistory(id);
}

function closeDetailView() {
    activeUserId = null;
    detailPlaceholder.style.display = 'flex';
    detailContent.style.display = 'none';
}

function addDaysToDate(dateString, days) {
    if (!dateString) return '';
    const date = new Date(dateString);
    date.setDate(date.getDate() + parseInt(days, 10));
    return date.toISOString().split('T')[0];
}

// 1. 기존 회원의 이용권 추가/수정 시 템플릿 적용 (누적 합산)
window.applyTemplateToEdit = () => {
    const select = document.getElementById('edit-template-select');
    if (!select.value) return;

    const [addCountStr, addDaysStr, cancelLimitStr, todayCancelLimitStr] = select.value.split(',');
    
    const addCount = parseInt(addCountStr, 10) || 0;
    const addDays = parseInt(addDaysStr, 10) || 0;
    const addCancel = parseInt(cancelLimitStr, 10) || 0;
    const addTodayCancel = parseInt(todayCancelLimitStr, 10) || 0;

    const curTotalCount = parseInt(document.getElementById('edit-total-count').value, 10) || 0;
    const curRemainingCount = parseInt(document.getElementById('edit-remaining-count').value, 10) || 0;
    
    const curTotalCancel = parseInt(document.getElementById('edit-total-cancel').value, 10) || 0;
    const curRemainingCancel = parseInt(document.getElementById('edit-remaining-cancel').value, 10) || 0;
    
    const curTotalTodayCancel = parseInt(document.getElementById('edit-total-today-cancel').value, 10) || 0;
    const curRemainingTodayCancel = parseInt(document.getElementById('edit-remaining-today-cancel').value, 10) || 0;

    const newTotalCount = curTotalCount + addCount;
    const newRemainingCount = curRemainingCount + addCount;

    const newTotalCancel = curTotalCancel + addCancel;
    const newRemainingCancel = curRemainingCancel + addCancel;

    const newTotalTodayCancel = curTotalTodayCancel + addTodayCancel;
    const newRemainingTodayCancel = curRemainingTodayCancel + addTodayCancel;

    document.getElementById('edit-total-count').value = newTotalCount;
    document.getElementById('edit-remaining-count').value = newRemainingCount;
    
    document.getElementById('edit-total-cancel').value = newTotalCancel;
    document.getElementById('edit-remaining-cancel').value = newRemainingCancel;

    document.getElementById('edit-total-today-cancel').value = newTotalTodayCancel;
    document.getElementById('edit-remaining-today-cancel').value = newRemainingTodayCancel;

    document.getElementById('edit-ticket-type').value = `${addCount}회권 추가 (${newTotalCount}회)`;

    const existingEndDate = document.getElementById('edit-end-date').value;
    const startDateInput = document.getElementById('edit-start-date');
    
    if (!startDateInput.value) {
        startDateInput.value = new Date().toISOString().split('T')[0];
    }
    
    const baseDate = existingEndDate ? existingEndDate : startDateInput.value;
    document.getElementById('edit-end-date').value = addDaysToDate(baseDate, addDays);
};

// 2. 신규 회원 등록 모달에서 템플릿 적용
window.applyTemplateToReg = () => {
    const select = document.getElementById('reg-template');
    if (!select.value) return;

    const [count, days, cancelLimit, todayCancelLimit] = select.value.split(',');
    const todayStr = new Date().toISOString().split('T')[0];

    document.getElementById('reg-ticket').value = `${count}회권 (${days}일)`;
    document.getElementById('reg-count').value = count;
    document.getElementById('reg-cancel-count').value = cancelLimit || 0;
    document.getElementById('reg-today-cancel-count').value = todayCancelLimit || 0;
    
    document.getElementById('reg-start').value = todayStr;
    document.getElementById('reg-end').value = addDaysToDate(todayStr, parseInt(days, 10));
};

// 3. 회원의 결제/환불/취소 내역 불러오기
let selectedHistoryIds = [];

async function loadPaymentHistory(userId) {
    const historyContainer = document.getElementById('payment-history-list');
    const selectAllCheck = document.getElementById('check-all-history');
    if (!historyContainer) return;

    selectedHistoryIds = [];
    if (selectAllCheck) selectAllCheck.checked = false;
    historyContainer.innerHTML = '<tr><td colspan="6" style="padding: 15px; text-align:center;">조회 중...</td></tr>';

    try {
        const historyRef = collection(db, 'users', userId, 'paymentHistory');
        const q = query(historyRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyContainer.innerHTML = '<tr><td colspan="6" style="padding: 15px; text-align:center; color: #9ca3af;">내역이 없습니다.</td></tr>';
            return;
        }

        let html = '';
        querySnapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const historyId = docSnap.id;
            const type = item.type || '결제';
            
            const isNegative = type === '환불' || type === '취소';
            const typeBadge = isNegative 
                ? `<span style="color: #ef4444; font-weight: bold;">[${type}]</span>`
                : `<span style="color: #4f46e5; font-weight: bold;">[결제]</span>`;
            
            const amountText = isNegative 
                ? `-${Number(item.amount || 0).toLocaleString()}원`
                : `+${Number(item.amount || 0).toLocaleString()}원`;

            const countText = item.addedCount 
                ? (item.addedCount > 0 ? `+${item.addedCount}회` : `${item.addedCount}회`)
                : `0회`;

            html += `
                <tr style="border-bottom: 1px solid #f3f4f6; text-align: center;">
                    <td style="padding: 8px;">
                        <input type="checkbox" class="history-checkbox" value="${historyId}" onchange="toggleHistorySelect('${historyId}')">
                    </td>
                    <td style="padding: 8px; color: #6b7280;">${item.date || '-'}</td>
                    <td style="padding: 8px;">${typeBadge}</td>
                    <td style="padding: 8px;">${item.ticketType || '-'}</td>
                    <td style="padding: 8px;">${countText}</td>
                    <td style="padding: 8px; font-weight: bold;">${amountText}</td>
                </tr>
            `;
        });
        historyContainer.innerHTML = html;

    } catch (err) {
        console.error("내역 로드 실패:", err);
        historyContainer.innerHTML = '<tr><td colspan="6" style="padding: 15px; text-align:center; color: #ef4444;">내역을 불러오지 못했습니다.</td></tr>';
    }
}

window.toggleAllHistorySelect = (masterCheckbox) => {
    const checkboxes = document.querySelectorAll('.history-checkbox');
    selectedHistoryIds = [];

    checkboxes.forEach((cb) => {
        cb.checked = masterCheckbox.checked;
        if (masterCheckbox.checked) {
            selectedHistoryIds.push(cb.value);
        }
    });
};

window.toggleHistorySelect = (historyId) => {
    const idx = selectedHistoryIds.indexOf(historyId);
    if (idx > -1) {
        selectedHistoryIds.splice(idx, 1);
    } else {
        selectedHistoryIds.push(historyId);
    }

    const checkboxes = document.querySelectorAll('.history-checkbox');
    const selectAllCheck = document.getElementById('check-all-history');
    if (selectAllCheck) {
        selectAllCheck.checked = checkboxes.length > 0 && selectedHistoryIds.length === checkboxes.length;
    }
};

window.deleteSelectedPaymentHistory = async () => {
    if (!activeUserId) {
        alert("선택된 회원이 없습니다.");
        return;
    }

    if (selectedHistoryIds.length === 0) {
        alert("삭제할 내역을 선택해 주세요.");
        return;
    }

    if (!confirm(`선택한 ${selectedHistoryIds.length}개의 내역을 삭제하시겠습니까?\n(회원 잔여 횟수에는 영향을 주지 않습니다.)`)) return;

    try {
        const deletePromises = selectedHistoryIds.map((id) => 
            deleteDoc(doc(db, 'users', activeUserId, 'paymentHistory', id))
        );

        await Promise.all(deletePromises);

        alert("선택한 내역이 삭제되었습니다.");
        loadPaymentHistory(activeUserId);
    } catch (err) {
        console.error("선택 삭제 오류:", err);
        alert("삭제 실패: " + err.message);
    }
};

window.clearAllPaymentHistory = async () => {
    if (!activeUserId) {
        alert("선택된 회원이 없습니다.");
        return;
    }

    if (!confirm("이 회원의 결제 및 환불 내역을 전부 초기화(삭제)하시겠습니까?\n(이 작업은 취소할 수 없습니다.)")) return;

    try {
        const historyRef = collection(db, 'users', activeUserId, 'paymentHistory');
        const querySnapshot = await getDocs(historyRef);

        if (querySnapshot.empty) {
            alert("삭제할 내역이 없습니다.");
            return;
        }

        const deletePromises = [];
        querySnapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(doc(db, 'users', activeUserId, 'paymentHistory', docSnap.id)));
        });

        await Promise.all(deletePromises);

        alert("전체 결제/환불 내역이 초기화되었습니다.");
        loadPaymentHistory(activeUserId);
    } catch (err) {
        console.error("전체 초기화 오류:", err);
        alert("초기화 실패: " + err.message);
    }
};

// 4. 이용권 저장/수정 시 결제 내역 기록
window.updateUserTicket = async () => {
    if (!activeUserId) {
        alert("선택된 회원이 없습니다.");
        return;
    }

    const ticketType = document.getElementById('edit-ticket-type')?.value.trim() || "";
    const inputTotalCount = parseInt(document.getElementById('edit-total-count')?.value, 10) || 0;
    const inputRemainingCount = parseInt(document.getElementById('edit-remaining-count')?.value, 10) || 0;
    const startDate = document.getElementById('edit-start-date')?.value || "";
    const endDate = document.getElementById('edit-end-date')?.value || "";
    
    const totalCancelLimit = parseInt(document.getElementById('edit-total-cancel')?.value, 10) || 0;
    const remainingCancelCount = parseInt(document.getElementById('edit-remaining-cancel')?.value, 10) || 0;
    const totalTodayCancelLimit = parseInt(document.getElementById('edit-total-today-cancel')?.value, 10) || 0;
    const remainingTodayCancelCount = parseInt(document.getElementById('edit-remaining-today-cancel')?.value, 10) || 0;

    const priceStr = prompt("결제/충전 금액을 입력해 주세요 (원):", "0");
    if (priceStr === null) return;
    const payAmount = parseInt(priceStr, 10) || 0;

    try {
        const userDocRef = doc(db, 'users', activeUserId);
        
        await updateDoc(userDocRef, {
            ticketType,
            totalCount: inputTotalCount,
            remainingCount: inputRemainingCount,
            startDate,
            endDate,
            totalCancelLimit,
            remainingCancelCount,
            totalTodayCancelLimit,
            remainingTodayCancelCount
        });

        const todayStr = new Date().toISOString().split('T')[0];
        const historyRef = collection(db, 'users', activeUserId, 'paymentHistory');
        
        await addDoc(historyRef, {
            type: "결제",
            ticketType: ticketType,
            addedCount: inputRemainingCount,
            amount: payAmount,
            date: todayStr,
            createdAt: new Date()
        });

        alert("이용권 정보 및 결제 내역이 저장되었습니다.");
        loadPaymentHistory(activeUserId);

    } catch (err) {
        console.error("수정 오류:", err);
        alert("수정 실패: " + err.message);
    }
};

// 이용권 환불/취소 전용 함수
window.refundUserTicket = async () => {
    if (!activeUserId) {
        alert("선택된 회원이 없습니다.");
        return;
    }

    const refundAmountStr = prompt("환불/취소 금액을 입력하세요 (원):", "0");
    if (refundAmountStr === null) return;

    const refundCountStr = prompt("차감/환불할 이용권 횟수를 입력하세요 (회):", "0");
    if (refundCountStr === null) return;

    const refundAmount = parseInt(refundAmountStr, 10) || 0;
    const refundCount = parseInt(refundCountStr, 10) || 0;

    try {
        const userDocRef = doc(db, 'users', activeUserId);
        const curRemaining = parseInt(document.getElementById('edit-remaining-count')?.value, 10) || 0;
        const newRemaining = Math.max(0, curRemaining - refundCount);

        await updateDoc(userDocRef, {
            remainingCount: newRemaining
        });

        const todayStr = new Date().toISOString().split('T')[0];
        const historyRef = collection(db, 'users', activeUserId, 'paymentHistory');
        
        await addDoc(historyRef, {
            type: "환불",
            ticketType: "이용권 환불/취소",
            addedCount: -refundCount,
            amount: refundAmount,
            date: todayStr,
            createdAt: new Date()
        });

        alert("환불 처리가 완료되었습니다.");
        
        document.getElementById('edit-remaining-count').value = newRemaining;
        loadPaymentHistory(activeUserId);

    } catch (err) {
        console.error("환불 처리 실패:", err);
        alert("환불 실패: " + err.message);
    }
};

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
            totalCancelLimit: 0,
            remainingCancelCount: 0,
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

// 신규 회원 등록 저장 프로세스
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('reg-phone').value.replace(/[^0-9]/g, '');
    const name = document.getElementById('reg-name').value.trim();
    const ticketType = document.getElementById('reg-ticket').value.trim();
    const totalCount = parseInt(document.getElementById('reg-count').value) || 0;
    const startDate = document.getElementById('reg-start').value;
    const endDate = document.getElementById('reg-end').value;
    
    const cancelCount = parseInt(document.getElementById('reg-cancel-count').value) || 0;
    const todayCancelCount = parseInt(document.getElementById('reg-today-cancel-count').value) || 0;

    try {
        const querySnapshot = await getDocs(usersCol);
        const registeredUser = querySnapshot.docs.find(doc => doc.data().phone === phone && doc.id !== phone);

        const cancelData = {
            totalCancelLimit: cancelCount,
            remainingCancelCount: cancelCount,
            totalTodayCancelLimit: todayCancelCount,
            remainingTodayCancelCount: todayCancelCount
        };

        let targetUserId = "";

        if (registeredUser) {
            targetUserId = registeredUser.id;
            const userDocRef = doc(db, 'users', targetUserId);
            await updateDoc(userDocRef, {
                ticketType, 
                totalCount, 
                remainingCount: totalCount, 
                startDate, 
                endDate,
                ...cancelData
            });
            alert(`이미 가입된 ${name} 회원님의 계정에 이용권이 부여되었습니다.`);
        } else {
            targetUserId = phone;
            const userDocRef = doc(db, 'users', targetUserId);
            await setDoc(userDocRef, {
                name, 
                phone, 
                ticketType, 
                totalCount, 
                remainingCount: totalCount, 
                startDate, 
                endDate, 
                role: "member",
                ...cancelData
            });
            alert("미가입 회원의 임시 정보가 추가되었습니다.");
        }

        const priceStr = prompt("등록 결제 금액을 입력해 주세요 (원):", "0");
        const payAmount = parseInt(priceStr, 10) || 0;

        const historyRef = collection(db, 'users', targetUserId, 'paymentHistory');
        await addDoc(historyRef, {
            type: "결제",
            ticketType: ticketType,
            addedCount: totalCount,
            amount: payAmount,
            date: startDate || new Date().toISOString().split('T')[0],
            createdAt: new Date()
        });

        closeModal();
    } catch (err) {
        console.error("등록 중 발생한 상세 에러:", err);
        alert("등록 실패: " + err.message);
    }
});

// 전화번호 포맷터
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

// 🎯 실시간 클라이언트 검색 기능 (페이지네이션 연동 수정)
searchInput.addEventListener('input', async (e) => {
    const keyword = e.target.value.toLowerCase();
    try {
        const querySnapshot = await getDocs(usersCol);
        
        currentDocsList = querySnapshot.docs.filter((doc) => {
            const data = doc.data();
            const name = data.name ? data.name.toLowerCase() : '';
            const phone = data.phone ? data.phone.toLowerCase() : '';
            return name.includes(keyword) || phone.includes(keyword);
        });
        
        currentPage = 1; // 검색 시 첫 페이지로 이동
        renderMemberList(currentDocsList, currentPage);
        renderPagination(currentDocsList.length);
    } catch (err) {
        console.error("검색 오류: ", err);
    }
});
