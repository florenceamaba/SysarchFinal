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
        const res = await fetch(`http://localhost:3000/student/${id}`);
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
                } else {
                    timeLeftText = "Session expired";
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

    // ── Generic Sit-In (Admin) ───────────────────────────────
    function openGenericSitInForm() {
        document.getElementById('genIdNumber').value  = "";
        document.getElementById('genFullName').value  = "";
        document.getElementById('genLab').value       = "524";
        document.getElementById('genRemaining').value = "";
        openModal('genericSitInModal');
    }

    async function autoFillStudent() {
        const id = document.getElementById('genIdNumber').value.trim();
        if (!id) {
            document.getElementById('genFullName').value  = "";
            document.getElementById('genRemaining').value = "";
            return;
        }
        try {
            const res  = await fetch(`http://localhost:3000/get-student/${id}`);
            if (res.ok) {
                const data = await res.json();
                document.getElementById('genFullName').value  = `${data.firstName} ${data.lastName}`;
                document.getElementById('genRemaining').value = data.remainingSession ?? 30;
            } else {
                document.getElementById('genFullName').value  = "";
                document.getElementById('genRemaining').value = "";
            }
        } catch (e) { console.error("Live search error:", e); }
    }

    async function submitGenericSitIn(e) {
        if (e) e.preventDefault();
        const payload = {
            idNumber: document.getElementById('genIdNumber').value.trim(),
            purpose:  document.getElementById('genPurpose').value,
            lab:      document.getElementById('genLab').value
        };
        if (!payload.idNumber || !payload.lab) {
            return Swal.fire('Warning', 'ID Number and Lab are required.', 'warning');
        }
        try {
            const res = await fetch('http://localhost:3000/sit-in', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                await Swal.fire({ icon: 'success', title: 'Sit-in recorded!', confirmButtonText: 'OK' });
                closeModal('genericSitInModal');
                document.getElementById('genIdNumber').value = "";
            } else {
                const txt = await res.text();
                Swal.fire('Error', txt, 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Connection to server failed.', 'error');
        }
    }

    // ── Fetch & Render Reservation Requests ─────────────────
    async function fetchReservations() {
        try {
            const res  = await fetch("http://localhost:3000/admin/reservations");
            const data = await res.json();

            const labFilter   = document.getElementById("labFilter").value;
            const requestBody = document.getElementById("requestBody");
            const logBody     = document.getElementById("logBody");

            requestBody.innerHTML = "";
            logBody.innerHTML     = "";

            // Filter by selected lab
            const filtered = data.filter(r => r.lab === labFilter);

            // Count pending for the badge
            const pendingItems = filtered.filter(r => r.status === 'Pending');
            document.getElementById('pendingCount').textContent = pendingItems.length;
            document.getElementById('logCount').textContent     = filtered.length;

            if (filtered.length === 0) {
                requestBody.innerHTML = `<div class="empty-state"><i class="fa fa-inbox"></i>No reservation requests for Lab ${labFilter}</div>`;
                logBody.innerHTML     = `<div class="empty-state"><i class="fa fa-list"></i>No logs for Lab ${labFilter}</div>`;
                return;
            }

            let hasPending = false;

            filtered.forEach(rev => {

                // ── Requests Panel (Pending only) ──
                if (rev.status === 'Pending') {
                    hasPending = true;
                    requestBody.innerHTML += `
                        <div class="res-card" id="req-card-${rev.id}">
                            <p><b>ID Number:</b> ${rev.idNumber}</p>
                            <p><b>Name:</b> ${rev.studentName || 'N/A'}</p>
                            <p><b>Reservation Date:</b> ${rev.date || 'N/A'}</p>
                            <p><b>Reservation Time:</b> ${rev.timeIn || 'N/A'}</p>
                            <p><b>Laboratory:</b> ${rev.lab}</p>
                            <p><b>Computer Number:</b> ${rev.pcNumber || 'N/A'}</p>
                            <p><b>Purpose:</b> ${rev.purpose}</p>
                            <div class="action-btns">
                                <button class="btn-accept" onclick="updateStatus(${rev.id}, 'Accepted')">
                                    <i class="fa fa-check"></i> Accept
                                </button>
                                <button class="btn-deny" onclick="updateStatus(${rev.id}, 'Denied')">
                                    <i class="fa fa-times"></i> Deny
                                </button>
                            </div>
                        </div>`;
                }

                // ── Logs Panel (All statuses) ──
                const statusClass = `status-${rev.status.toLowerCase()}`;
                logBody.innerHTML += `
                    <div class="log-entry">
                        <p><b>ID Number:</b> ${rev.idNumber}</p>
                        <p><b>Name:</b> ${rev.studentName || 'N/A'}</p>
                        <p><b>Reservation Date:</b> ${rev.date || 'N/A'}</p>
                        <p><b>Reservation Time:</b> ${rev.timeIn || 'N/A'}</p>
                        <p><b>Laboratory:</b> ${rev.lab} &nbsp;|&nbsp; <b>PC:</b> ${rev.pcNumber || 'N/A'}</p>
                        <p><b>Purpose:</b> ${rev.purpose}</p>
                        <p><b>Status:</b> <span class="${statusClass}">${rev.status}</span></p>
                    </div>`;
            });

            if (!hasPending) {
                requestBody.innerHTML = `<div class="empty-state"><i class="fa fa-check-circle"></i>No pending requests for Lab ${labFilter}</div>`;
            }

        } catch (err) {
            console.error("Load error:", err);
            Swal.fire('Error', 'Could not load reservations. Make sure server.js is running.', 'error');
        }
    }

    // ── Accept or Deny ───────────────────────────────────────
    async function updateStatus(id, newStatus) {
        const actionText = newStatus === 'Accepted' ? 'accept' : 'deny';
        const { isConfirmed } = await Swal.fire({
            title: `${newStatus === 'Accepted' ? 'Accept' : 'Deny'} Reservation?`,
            text: newStatus === 'Accepted'
                ? 'This will record the sit-in and deduct one session from the student.'
                : 'This will deny the reservation request.',
            icon: newStatus === 'Accepted' ? 'question' : 'warning',
            showCancelButton: true,
            confirmButtonColor: newStatus === 'Accepted' ? '#28a745' : '#dc3545',
            confirmButtonText: `Yes, ${actionText} it!`
        });

        if (!isConfirmed) return;

        try {
            const res  = await fetch("http://localhost:3000/admin/update-reservation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: newStatus })
            });
            const data = await res.json();

            if (res.ok) {
                await Swal.fire({
                    icon: newStatus === 'Accepted' ? 'success' : 'info',
                    title: newStatus === 'Accepted' ? 'Accepted!' : 'Denied',
                    text: data.message,
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchReservations(); // Refresh the panels
            } else {
                Swal.fire('Error', data.message || 'Something went wrong.', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Connection failed. Check server.js is running.', 'error');
        }
    }

    // ── Logout ───────────────────────────────────────────────
    function logout() {
        Swal.fire({
            title: 'Logout Admin?',
            text: "Are you sure you want to end your admin session?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, logout!',
            cancelButtonText: 'Stay'
        }).then((result) => {
            if (result.isConfirmed) {
                sessionStorage.removeItem("adminWelcomeShown");
                window.location.href = "login.html";
            }
        });
    }

    // ── On Load ──────────────────────────────────────────────
    document.addEventListener("DOMContentLoaded", () => {
        fetchReservations();
        // Auto-refresh every 30 seconds
        setInterval(fetchReservations, 30000);
    });