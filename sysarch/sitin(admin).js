const BASE_URL = 'http://localhost:3000';

let allRecords      = [];
let filteredRecords = [];
let currentPage     = 1;
let entriesPerPage  = 10;
let sortKey         = 'id';
let sortAsc         = false;
let searchTimer;
const SESSION_DURATION = 60;

function openModal(id)  { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ── Search ──────────────────────────────────────────────
function openSearchModal() {
    openModal('searchModal');
    document.getElementById('modalSearchInput').focus();
}

async function executeSearch(event) {
    if (event) event.preventDefault();

    const id = document.getElementById('modalSearchInput').value.trim();
    if (!id) return Swal.fire('Error', 'Please enter an ID', 'error');

    try {
        const res = await fetch(`${BASE_URL}/student/${id}`);
        const data = await res.json();

        if (res.ok) {
            closeModal('searchModal');

            let timeLeftText = "No active session";

            if (data.timeIn && !data.timeOut) {
                const timeIn = new Date(data.timeIn);
                const now = new Date();
                const diffMinutes = Math.floor((now - timeIn) / 60000);
                const remaining = SESSION_DURATION - diffMinutes;

                if (remaining > 0) {
                    timeLeftText = `${remaining} minutes left`;
                }
            }

            document.getElementById('infoBody').innerHTML = `
                <p><b>ID Number:</b> ${data.idNumber}</p>
                <p><b>Name:</b> ${data.firstName} ${data.lastName}</p>
                <p><b>Course:</b> ${data.course || 'N/A'}</p>
                <p><b>Email:</b> ${data.email || 'N/A'}</p>
                <p><b>Year:</b> ${data.yearLevel || 'N/A'}</p>
                <p><b>Address:</b> ${data.address || 'N/A'}</p>
                <p><b>Sessions Left:</b> <span class="badge badge-session">${data.remainingSession ?? 30}</span></p>
                <p><b>Time Left:</b> 
                    <span style="color:#007bff;font-weight:bold;">${timeLeftText}</span>
                </p>
            `;
            openModal('studentInfoModal');
        } else {
            Swal.fire('Oops!', 'Student not found.', 'warning');
        }
    } catch (e) {
        Swal.fire('Error', 'Server Error', 'error');
    }
}

async function searchAndPopulate() {
    const id   = document.getElementById('uniIdSearch').value.trim();
    const list = document.getElementById('searchResultsList');
    if (!id) return;
    try {
        const res  = await fetch(`${BASE_URL}/student/${id}`);
        const data = await res.json();
        if (res.ok) {
            const initials = (data.firstName[0] + data.lastName[0]).toUpperCase();
            list.innerHTML = `
                <div class="search-result-item" onclick='selectStudent(${JSON.stringify(data)})'>
                    <div class="user-avatar">${initials}</div>
                    <div class="user-info-text">
                        <span class="name">${data.firstName} ${data.lastName}</span>
                        <div class="meta">
                            <span>ID: ${data.idNumber}</span>
                            <span>${data.course} ${data.yearLevel}</span>
                        </div>
                    </div>
                    <div class="user-status-badges">
                        <span class="badge-sessions">${data.remainingSession ?? 30} sessions</span>
                        <span style="color:#4e73df; font-size:10px;">Click to select</span>
                    </div>
                </div>`;
            document.getElementById('studentDetailsBox').style.display = 'none';
            document.getElementById('uniFooter').style.display = 'none';
        } else {
            list.innerHTML = '<p style="text-align:center;color:#858796;font-size:12px;padding:10px;">No student found with that ID.</p>';
        }
    } catch (e) { console.error("Search Error:", e); }
}

function selectStudent(data) {
    document.getElementById('searchResultsList').innerHTML = '';
    document.getElementById('studentDetailsBox').style.display = 'block';
    document.getElementById('uniFooter').style.display = 'flex';
    document.getElementById('accountInfoDisplay').innerHTML = `
        <span class="profile-name">${data.firstName} ${data.lastName}</span>
        <div class="profile-meta">
            <div class="meta-item"><label>ID Number</label><span>${data.idNumber}</span></div>
            <div class="meta-item"><label>Remaining</label><span>${data.remainingSession ?? 30} / 30</span></div>
        </div>`;
    document.getElementById('uniIdSearch').value = data.idNumber;
}

async function submitUnifiedSitIn() {
    const idNumber = document.getElementById('uniIdSearch').value.trim();
    const purpose  = document.getElementById('uniPurpose').value;
    const lab      = document.getElementById('uniLab').value;
    if (!idNumber) return Swal.fire('Warning', 'No student selected.', 'warning');

    try {
        const res = await fetch(`${BASE_URL}/sit-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idNumber, purpose, lab })
        });
        if (res.ok) {
            await Swal.fire({ icon: 'success', title: 'Sit-in Recorded!', timer: 1500, showConfirmButton: false });
            closeModal('unifiedSitInModal');
            fetchSitIns();
        } else {
            const txt = await res.text();
            Swal.fire('Error', txt, 'error');
        }
    } catch (e) { Swal.fire('Error', 'Connection failed.', 'error'); }
}

// ── NEW SIT-IN MODAL ──
function openSitInModal() {
    document.getElementById('genIdNumber').value  = '';
    document.getElementById('genFullName').value  = '';
    document.getElementById('genPurpose').value   = 'C Programming';
    document.getElementById('genLab').value       = '524';
    document.getElementById('genRemaining').value = '';
    openModal('sitInModal');
    setTimeout(() => document.getElementById('genIdNumber').focus(), 100);
}

async function autoFillStudent() {
    const id = document.getElementById('genIdNumber').value.trim();
    if (!id) {
        document.getElementById('genFullName').value  = '';
        document.getElementById('genRemaining').value = '';
        return;
    }
    try {
        const res = await fetch(`${BASE_URL}/student/${id}`);
        if (res.ok) {
            const data = await res.json();
            document.getElementById('genFullName').value  = `${data.firstName} ${data.lastName}`;
            document.getElementById('genRemaining').value = data.remainingSession ?? 30;
        } else {
            document.getElementById('genFullName').value  = '';
            document.getElementById('genRemaining').value = '';
        }
    } catch (e) { console.error('Auto-fill error:', e); }
}

async function submitSitIn() {
    const idNumber = document.getElementById('genIdNumber').value.trim();
    const purpose  = document.getElementById('genPurpose').value;
    const lab      = document.getElementById('genLab').value;
    const sessions = document.getElementById('genRemaining').value;

    if (!idNumber)               return Swal.fire('Warning', 'Please enter a student ID number.', 'warning');
    if (!sessions)               return Swal.fire('Warning', 'Student not found. Please enter a valid ID.', 'warning');
    if (parseInt(sessions) <= 0) return Swal.fire('No Sessions', 'This student has no remaining sessions.', 'error');

    try {
        const res = await fetch(`${BASE_URL}/sit-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idNumber, purpose, lab })
        });
        if (res.ok) {
            await Swal.fire({ icon: 'success', title: 'Sit-in Recorded!', timer: 1500, showConfirmButton: false });
            closeModal('sitInModal');
            fetchSitIns();
        } else {
            const txt = await res.text();
            Swal.fire('Error', txt, 'error');
        }
    } catch (e) { Swal.fire('Error', 'Connection failed.', 'error'); }
}

async function fetchSitIns() {
    try {
        const res  = await fetch(`${BASE_URL}/get-sitin`);
        const data = await res.json();
        const activeOnly = data.filter(r => !r.timeOut || r.timeOut === '');
        allRecords      = activeOnly;
        filteredRecords = [...activeOnly];
        currentPage     = 1;
        renderTable();
    } catch (e) {
        document.getElementById('sitInTableBody').innerHTML =
            `<tr><td colspan="9" class="no-data" style="color:#dc3545;">
                <i class="fa fa-exclamation-triangle"></i> Could not connect to server.
            </td></tr>`;
    }
}

// ── TIME OUT ──
async function timeOut(idNumber, sitInId) {
    const result = await Swal.fire({
        title: 'Time Out Student?',
        text: `Record logout time for ID: ${idNumber}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, Time Out',
        cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${BASE_URL}/time-out`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idNumber, sitInId })
        });
        if (res.ok) {
            await Swal.fire({ icon: 'success', title: 'Timed Out!', timer: 1500, showConfirmButton: false });
            fetchSitIns();
        } else {
            const txt = await res.text();
            Swal.fire('Error', txt, 'error');
        }
    } catch (e) { Swal.fire('Error', 'Connection failed.', 'error'); }
}

// ── TABLE ──
function applySearch() {
    const val = document.getElementById('searchInput').value.toLowerCase();
    filteredRecords = allRecords.filter(r =>
        Object.values(r).some(v => String(v).toLowerCase().includes(val))
    );
    currentPage = 1;
    renderTable();
}

function changeEntries() {
    entriesPerPage = parseInt(document.getElementById('entriesSelect').value);
    currentPage = 1;
    renderTable();
}

function renderTable() {
    const tbody    = document.getElementById('sitInTableBody');
    const start    = (currentPage - 1) * entriesPerPage;
    const pageData = filteredRecords.slice(start, start + entriesPerPage);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="no-data">No active sit-in records found.</td></tr>`;
        document.getElementById('paginationInfo').textContent = '';
        updatePagination(0);
        return;
    }

    tbody.innerHTML = pageData.map(r => {
        const sessions = r.remainingSession ?? 30;
        const isActive = !r.timeOut || r.timeOut === '';
        const sid      = r.sitInId ?? r.id;
        return `
        <tr>
            <td>${sid ?? '—'}</td>
            <td>${r.idNumber}</td>
            <td>${r.firstName ?? ''} ${r.lastName ?? ''}</td>
            <td>${r.purpose}</td>
            <td>${r.lab}</td>
            <td><span class="badge badge-session">${sessions}</span></td>
            <td>${isActive
                ? '<span class="badge badge-active"><i class="fa fa-circle" style="font-size:8px;"></i> Active</span>'
                : '<span class="badge badge-timeout"><i class="fa fa-circle" style="font-size:8px;"></i> Timed Out</span>'}
            </td>
            <td>${isActive
                ? `<button class="btn-timeout" onclick="timeOut('${r.idNumber}','${sid}')"><i class="fa fa-sign-out"></i> Time Out</button>`
                : `<button class="btn-done" disabled>Done</button>`}
            </td>
        </tr>`;
    }).join('');

    const total = filteredRecords.length;
    document.getElementById('paginationInfo').textContent =
        `Showing ${start + 1} to ${Math.min(start + entriesPerPage, total)} of ${total} entries`;
    updatePagination(total);
}

function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / entriesPerPage);
    const container  = document.getElementById('paginationBtns');
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    html += `<button onclick="goToPage(1)" ${currentPage===1?'disabled style="opacity:.5"':''}>«</button>`;
    html += `<button onclick="goToPage(${currentPage-1})" ${currentPage===1?'disabled style="opacity:.5"':''}>‹</button>`;
    const range = 2;
    for (let i = Math.max(1, currentPage-range); i <= Math.min(totalPages, currentPage+range); i++) {
        html += `<button onclick="goToPage(${i})"
            style="margin:0 2px;padding:5px 10px;cursor:pointer;
            background:${i===currentPage?'#2c3e70':'#fff'};
            color:${i===currentPage?'#fff':'#000'};
            border:1px solid #ddd;border-radius:3px;">${i}</button>`;
    }
    html += `<button onclick="goToPage(${currentPage+1})" ${currentPage===totalPages?'disabled style="opacity:.5"':''}>›</button>`;
    html += `<button onclick="goToPage(${totalPages})" ${currentPage===totalPages?'disabled style="opacity:.5"':''}>»</button>`;
    container.innerHTML = html;
}

function goToPage(p) {
    const totalPages = Math.ceil(filteredRecords.length / entriesPerPage);
    if (p < 1 || p > totalPages) return;
    currentPage = p;
    renderTable();
}

const sortKeys = ['sitInId', 'idNumber', 'lastName', 'purpose', 'lab', 'remainingSession', 'timeOut'];
function sortTable(n) {
    const key = sortKeys[n];
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = true; }
    filteredRecords.sort((a, b) => {
        const cmp = String(a[key]??'').localeCompare(String(b[key]??''), undefined, { numeric: true });
        return sortAsc ? cmp : -cmp;
    });
    renderTable();
}

async function logout() {
    const { isConfirmed } = await Swal.fire({
        title: 'Logout Admin?',
        text: "This will end your admin session.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, Logout!',
        cancelButtonText: 'Stay Logged In'
    });

    if (!isConfirmed) return;

    try {
        sessionStorage.removeItem("adminWelcomeShown");
        localStorage.removeItem("adminId");
        sessionStorage.clear();

        await Swal.fire({
            icon: 'success',
            title: 'Logged Out',
            text: 'Admin session ended successfully.',
            timer: 1500,
            showConfirmButton: false
        });

        window.location.href = "login.html";
    } catch (err) {
        console.error("Admin logout error:", err);
        sessionStorage.clear();
        localStorage.removeItem("adminId");
        window.location.href = "login.html";
    }
}

window.onload = fetchSitIns;