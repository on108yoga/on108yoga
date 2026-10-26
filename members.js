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

// HTML DOM 요소 매핑
const memberListContainer = document.getElementById('member-list');
const paginationContainer = document.getElementById('pagination');
const detailPlaceholder = document.getElementById('detail-placeholder');
const detailContent = document.getElementById('detail-content');
const searchInput = document.getElementById('search-input');
const modal = document.getElementById('register-modal');

// 모달 제어 함수
window.openModal = () => {
    modal.style.display = 'flex';
    document.getElementById('reg-start').value = new Date().toISOString().split('T')[0];
};

window.closeModal = () => {
    modal.style.display = 'none';
    document.getElementById('register-form').reset();
};

// 1. Firebase 실시간 회원 리스트 수신 및 갱신
const usersCol = collection(db, 'users');
onSnapshot(usersCol, (snapshot) => {
    currentDocsList = [...snapshot.docs].sort((a, b) => {
        const aData = a.data();
        const bData = b.data();
        
        const aTime = aData.createdAt?.toDate ? aData.createdAt.toDate().getTime() : (aData.createdAt || 0);
        const bTime = bData.createdAt?.toDate ? bData.createdAt.toDate().getTime() : (bData.createdAt || 0);
        
        if (aTime !== bTime) {
            return bTime - aTime;
        }

        const aStart = aData.startDate || '';
        const bStart = bData.startDate || '';
        return bStart.localeCompare(aStart);
    });
    
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

// 2. 회원 목록 출력
function renderMemberList(docs, page = 1) {
    if (!memberListContainer) return;
    memberListContainer.innerHTML = '';
    
    if (docs.length === 0) {
        memberListContainer.innerHTML = '<li style="padding:20px; color:#9ca3af; text-align:center;">등록된 회원이 없습니다.</li>';
        return;
    }

    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedDocs = docs.slice(startIndex, endIndex);

    const todayStr = new Date().toISOString().split('T')[0];

    paginatedDocs.forEach((docSnap) => {
        const user = docSnap.data();
        const id = docSnap.id; 
        const li = document.createElement('li');
        li.className = `member-item ${activeUserId === id ? 'active' : ''}`;
        
        li.onclick = () => selectMember(id, user);

        const formatBadgeDate = (dateVal) => {
            if (!dateVal) return todayStr.replace(/-/g, '/');
            
            if (dateVal.toDate && typeof dateVal.toDate === 'function') {
                const d = dateVal.toDate();
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}/${month}/${day}`;
            }
            
            return String(dateVal).split('T')[0].replace(/-/g, '/');
        };

        const createdDateStr = formatBadgeDate(user.createdAt || user.startDate);
        const isTemporary = id.length === 11 && !isNaN(id);
        
        const joinedBadge = isTemporary 
            ? ` <span style="font-size:11px; color:#f59e0b; font-weight:normal;">(미가입-${createdDateStr})</span>` 
            : ` <span style="font-size:11px; color:#10b981; font-weight:normal;">(가입됨-${createdDateStr})</span>`;

        const isExpired = user.endDate && user.endDate < todayStr;
        let countBadge = `<span style="font-size:13px; color: var(--primary); font-weight:bold;">${user.remainingCount || 0}회 남음</span>`;

        if (isExpired) {
            countBadge = `<span style="font-size:12px; color: #ef4444; font-weight:bold;">[기간 만료]</span>`;
        }

        li.innerHTML = `
            <div>
                <span class="member-name">${user.name || '이름 없음'}${joinedBadge}</span><br>
                <span class="member-phone">${formatPhone(user.phone)}</span>
            </div>
            ${countBadge}
        `;
        memberListContainer.appendChild(li);
    });
}

// 3. 페이지네이션 버튼 UI 생성
function renderPagination(totalItems) {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (totalPages <= 1) return; 

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerText = '‹';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => changePage(currentPage - 1);
    paginationContainer.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.innerText = i;
        btn.onclick = () => changePage(i);
        paginationContainer.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerText = '›';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => changePage(currentPage + 1);
    paginationContainer.appendChild(nextBtn);
}

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

// 우측 회원 상세 페이지 출력 함수 (아이디/비밀번호 바인딩)
function showMemberDetail(id, user) {
    if (detailPlaceholder) detailPlaceholder.style.display = 'none';
    if (detailContent) detailContent.style.display = 'block';

    document.getElementById('det-name').innerText = `선택회원: ${user.name || '미등록'} 회원님`;
    document.getElementById('det-phone').innerText = formatPhone(user.phone);
    
    // 아이디(전화번호) 및 비밀번호 표시 매핑
    const userIdElem = document.getElementById('cur-userid');
    const passwordElem = document.getElementById('cur-password');
    if (userIdElem) userIdElem.innerText = formatPhone(user.phone) || user.userId || '-';
    if (passwordElem) passwordElem.innerText = user.password || '-';

    const todayStr = new Date().toISOString().split('T')[0];
    const hasTicket = Boolean(user.ticketType);
    const isExpired = user.endDate && user.endDate < todayStr;

    const ticketElem = document.getElementById('cur-ticket');
    if (hasTicket) {
        ticketElem.innerText = isExpired ? `${user.ticketType} (기간 만료됨)` : user.ticketType;
        ticketElem.style.color = isExpired ? "#ef4444" : "inherit";
    } else {
        ticketElem.innerText = "없음 (이용권 미등록)";
        ticketElem.style.color = "inherit";
    }

    const countElem = document.getElementById('cur-count');
    if (hasTicket) {
        if (isExpired) {
            countElem.innerText = `0회 (만료됨 / 잔여 ${user.remainingCount ?? 0}회 사용 불가)`;
            countElem.style.color = "#ef4444";
            countElem.style.fontWeight = "bold";
        } else {
            countElem.innerText = `${user.remainingCount ?? 0}회 / ${user.totalCount ?? 0}회`;
            countElem.style.color = "inherit";
            countElem.style.fontWeight = "normal";
        }
    } else {
        countElem.innerText = "-";
        countElem.style.color = "inherit";
    }

    const periodElem = document.getElementById('cur-period');
    if (periodElem) {
        periodElem.innerText = user.startDate ? `${user.startDate} ~ ${user.endDate}` : "이용 기간 정보 없음";
        periodElem.style.color = isExpired ? "#ef4444" : "inherit";
        periodElem.style.fontWeight = isExpired ? "bold" : "normal";
    }

    document.getElementById('cur-cancel-count').innerText = hasTicket 
        ? `${user.remainingCancelCount ?? 0}회 / ${user.totalCancelLimit ?? 0}회` 
        : "-";

    const curTodayCancelElem = document.getElementById('cur-today-cancel-count');
    if (curTodayCancelElem) {
        curTodayCancelElem.innerText = hasTicket 
            ? `${user.remainingTodayCancelCount ?? 0}회 / ${user.totalTodayCancelLimit ?? 0}회` 
            : "-";
    }

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
    loadUserReservations(id, user.name);
}

function closeDetailView() {
    activeUserId = null;
    if (detailPlaceholder) detailPlaceholder.style.display = 'block';
    if (detailContent) detailContent.style.display = 'none';
}

function addDaysToDate(dateString, days) {
    if (!dateString) return '';
    const date = new Date(dateString);
    date.setDate(date.getDate() + parseInt(days, 10));
    return date.toISOString().split('T')[0];
}

window.calculateEditEndDate = () => {
    const startDate = document.getElementById('edit-start-date').value;
    const selectValue = document.getElementById('edit-template-select').value;
    if (startDate && selectValue) {
        const [_, days] = selectValue.split(',');
        document.getElementById('edit-end-date').value = addDaysToDate(startDate, days);
    }
};

window.calculateRegEndDate = () => {
    const startDate = document.getElementById('reg-start').value;
    const selectValue = document.getElementById('reg-template').value;
    if (startDate && selectValue) {
        const [_, days] = selectValue.split(',');
        document.getElementById('reg-end').value = addDaysToDate(startDate, days);
    }
};

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

    document.getElementById('edit-total-count').value = curTotalCount + addCount;
    document.getElementById('edit-remaining-count').value = curRemainingCount + addCount;
    document.getElementById('edit-total-cancel').value = curTotalCancel + addCancel;
    document.getElementById('edit-remaining-cancel').value = curRemainingCancel + addCancel;
    document.getElementById('edit-total-today-cancel').value = curTotalTodayCancel + addTodayCancel;
    document.getElementById('edit-remaining-today-cancel').value = curRemainingTodayCancel + addTodayCancel;

    document.getElementById('edit-ticket-type').value = `${addCount}회권 추가 (${curTotalCount + addCount}회)`;

    const existingEndDate = document.getElementById('edit-end-date').value;
    const startDateInput = document.getElementById('edit-start-date');
    if (!startDateInput.value) {
        startDateInput.value = new Date().toISOString().split('T')[0];
    }
    
    const baseDate = existingEndDate ? existingEndDate : startDateInput.value;
    document.getElementById('edit-end-date').value = addDaysToDate(baseDate, addDays);
};

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
    if (!activeUserId) return alert("선택된 회원이 없습니다.");
    if (selectedHistoryIds.length === 0) return alert("삭제할 내역을 선택해 주세요.");

    if (!confirm(`선택한 ${selectedHistoryIds.length}개의 내역을 삭제하시겠습니까?\n(회원 잔여 횟수에는 영향을 주지 않습니다.)`)) return;

    try {
        const deletePromises = selectedHistoryIds.map((id) => 
            deleteDoc(doc(db, 'users', activeUserId, 'paymentHistory', id))
        );
        await Promise.all(deletePromises);
        alert("선택한 내역이 삭제되었습니다.");
        loadPaymentHistory(activeUserId);
    } catch (err) {
        alert("삭제 실패: " + err.message);
    }
};

window.clearAllPaymentHistory = async () => {
    if (!activeUserId) return alert("선택된 회원이 없습니다.");
    if (!confirm("이 회원의 결제 및 환불 내역을 전부 초기화(삭제)하시겠습니까?")) return;

    try {
        const historyRef = collection(db, 'users', activeUserId, 'paymentHistory');
        const querySnapshot = await getDocs(historyRef);

        if (querySnapshot.empty) return alert("삭제할 내역이 없습니다.");

        const deletePromises = [];
        querySnapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(doc(db, 'users', activeUserId, 'paymentHistory', docSnap.id)));
        });

        await Promise.all(deletePromises);
        alert("전체 결제/환불 내역이 초기화되었습니다.");
        loadPaymentHistory(activeUserId);
    } catch (err) {
        alert("초기화 실패: " + err.message);
    }
};

window.updateUserTicket = async () => {
    if (!activeUserId) return alert("선택된 회원이 없습니다.");

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
            ticketCount: inputRemainingCount,
            remCount: inputRemainingCount,
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

window.refundUserTicket = async () => {
    if (!activeUserId) return alert("선택된 회원이 없습니다.");

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
            remainingCount: newRemaining,
            ticketCount: newRemaining,
            remCount: newRemaining
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
        alert("환불 실패: " + err.message);
    }
};

window.resetUserTicket = async () => {
    if(!activeUserId || !confirm("이 회원의 이용권을 만료/제거 상태로 리셋하시겠습니까?")) return;

    try {
        const userDocRef = doc(db, 'users', activeUserId);
        await updateDoc(userDocRef, {
            ticketType: "",
            totalCount: 0,
            remainingCount: 0,
            ticketCount: 0,
            remCount: 0,
            startDate: "",
            endDate: "",
            totalCancelLimit: 0,
            remainingCancelCount: 0,
            totalTodayCancelLimit: 0,
            remainingTodayCancelCount: 0
        });
        alert("이용권 정보가 초기화되었습니다.");
    } catch (err) {
        alert("초기화 실패: " + err.message);
    }
};

window.deleteCurrentMember = async () => {
    if(!activeUserId || !confirm("정말로 이 회원을 데이터베이스에서 삭제하시겠습니까?")) return;
    
    const idToDelete = activeUserId;
    closeDetailView();
    
    try {
        await deleteDoc(doc(db, 'users', idToDelete));
        alert("회원이 완전히 삭제되었습니다.");
    } catch (err) {
        alert("삭제 실패: " + err.message);
    }
};

async function loadUserReservations(userId, userName) {
    const reservationListContainer = document.getElementById('user-reservation-list');
    const reservationSummary = document.getElementById('reservation-summary');
    if (!reservationListContainer) return;

    reservationListContainer.innerHTML = '<tr><td colspan="4" style="padding: 15px; text-align:center; color:#9ca3af;">예약 내역 조회 중...</td></tr>';
    if (reservationSummary) reservationSummary.innerText = '';

    try {
        const reservationsRef = collection(db, 'reservations');
        const querySnapshot = await getDocs(reservationsRef);

        let userReservations = [];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const isMatch = (data.userId === userId) || 
                            (data.name && userName && data.name.trim() === userName.trim());

            if (isMatch) {
                userReservations.push({
                    id: docSnap.id,
                    ...data
                });
            }
        });

        userReservations.sort((a, b) => {
            const dateA = a.date || a.reservationDate || '';
            const dateB = b.date || b.reservationDate || '';
            return dateB.localeCompare(dateA);
        });

        if (reservationSummary) {
            reservationSummary.innerText = `총 ${userReservations.length}건`;
        }

        if (userReservations.length === 0) {
            reservationListContainer.innerHTML = '<tr><td colspan="4" style="padding: 15px; text-align:center; color: #9ca3af;">예약 내역이 없습니다.</td></tr>';
            return;
        }

        let html = '';
        userReservations.forEach((item) => {
            const resDate = item.date || item.reservationDate || '-';
            const resTime = item.time || item.slot || '-';
            const regTime = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : (item.createdAt || '-');
            const status = item.status || '확정';
            
            const isCanceled = status === '취소' || status === 'canceled';
            const statusBadge = isCanceled 
                ? `<span style="color: #ef4444; font-weight: bold;">[취소됨]</span>`
                : `<span style="color: #10b981; font-weight: bold;">[예약확정]</span>`;

            html += `
                <tr style="border-bottom: 1px solid #f3f4f6; text-align: center;">
                    <td style="padding: 8px; font-weight: 500;">${resDate}</td>
                    <td style="padding: 8px;">${resTime}</td>
                    <td style="padding: 8px; color: #6b7280; font-size: 11px;">${regTime}</td>
                    <td style="padding: 8px;">
                        ${statusBadge}
                    </td>
                </tr>
            `;
        });
        reservationListContainer.innerHTML = html;

    } catch (err) {
        console.error("예약 내역 로드 실패:", err);
        reservationListContainer.innerHTML = '<tr><td colspan="4" style="padding: 15px; text-align:center; color: #ef4444;">예약 내역을 불러오지 못했습니다.</td></tr>';
    }
}

// 12. 신규 회원 등록 (전화번호를 아이디로 반영)
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('reg-phone').value.replace(/[^0-9]/g, '');
    const name = document.getElementById('reg-name').value.trim();
    const password = document.getElementById('reg-password').value.trim();
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
            await updateDoc(doc(db, 'users', targetUserId), {
                ticketType, 
                totalCount, 
                remainingCount: totalCount, 
                ticketCount: totalCount,
                remCount: totalCount,
                startDate, 
                endDate,
                password,
                updatedAt: new Date(),
                ...cancelData
            });
            alert(`이미 가입된 ${name} 회원님의 계정에 이용권이 부여되었습니다.`);
        } else {
            targetUserId = phone; // 전화번호를 문서 ID(아이디)로 지정
            await setDoc(doc(db, 'users', targetUserId), {
                name, 
                phone, 
                password,
                ticketType, 
                totalCount, 
                remainingCount: totalCount, 
                ticketCount: totalCount,
                remCount: totalCount,
                startDate, 
                endDate, 
                role: "member",
                createdAt: new Date(),
                ...cancelData
            });
            alert("신규 회원 정보와 계정이 등록되었습니다.");
        }

        const priceStr = prompt("등록 결제 금액을 입력해 주세요 (원):", "0");
        const payAmount = parseInt(priceStr, 10) || 0;

        await addDoc(collection(db, 'users', targetUserId, 'paymentHistory'), {
            type: "결제",
            ticketType: ticketType,
            addedCount: totalCount,
            amount: payAmount,
            date: startDate || new Date().toISOString().split('T')[0],
            createdAt: new Date()
        });

        closeModal();
    } catch (err) {
        alert("등록 실패: " + err.message);
    }
});

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

searchInput.addEventListener('input', async (e) => {
    const keyword = e.target.value.toLowerCase().trim();
    try {
        const querySnapshot = await getDocs(usersCol);
        
        currentDocsList = querySnapshot.docs.filter((docSnap) => {
            const data = docSnap.data();
            const name = data.name ? data.name.toLowerCase() : '';
            const phone = data.phone ? data.phone.toLowerCase() : '';
            return name.includes(keyword) || phone.includes(keyword);
        });
        
        currentPage = 1;
        renderMemberList(currentDocsList, currentPage);
        renderPagination(currentDocsList.length);
    } catch (err) {
        console.error("검색 오류: ", err);
    }
});
