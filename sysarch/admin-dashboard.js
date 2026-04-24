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
                }
                // If expired, just show "No active session" instead of "Session expired"
                // since timeOut hasn't been recorded yet — it's stale data
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
                fetchSitInStats(); // ← ADD THIS LINE
            } else {
                const txt = await res.text();
                Swal.fire('Error', txt, 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Connection to server failed.', 'error');
        }
    }

// WELCOME ALERT
window.onload = function () {
    const hasShownWelcome = sessionStorage.getItem("adminWelcomeShown");

    if (hasShownWelcome === "false") {
        Swal.fire({
            title: 'Welcome back, Admin!',
            text: 'You have successfully logged into the CCS Monitoring System.',
            icon: 'success',
            confirmButtonColor: '#0056b3'
        });

        sessionStorage.setItem("adminWelcomeShown", "true");
    }
    loadAnnouncements();
};

async function postAnnouncement() {
    const text = document.getElementById('announcementText').value.trim();
    if (!text) return Swal.fire('Warning', 'Please enter an announcement.', 'warning');

    try {
        const res = await fetch('http://localhost:3000/api/announcements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        if (res.ok) {
            await Swal.fire({ icon: 'success', title: 'Announcement posted!', timer: 1500, showConfirmButton: false });
            document.getElementById('announcementText').value = '';
            loadAnnouncements();
        } else {
            Swal.fire('Error', 'Failed to post announcement.', 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'Server error.', 'error');
    }
}

async function loadAnnouncements() {
    try {
        const res  = await fetch('http://localhost:3000/api/announcements');
        const data = await res.json();
        const list = document.getElementById('announcementList');
        if (!data.length) {
            list.innerHTML = '<p style="color:#aaa;font-size:13px;">No announcements yet.</p>';
            return;
        }
        list.innerHTML = data.map(a => `
            <div class="announcement-item">
                <small>CCS Admin | ${new Date(a.createdAt).toLocaleDateString()}</small>
                <p>${a.message}</p>
            </div>
        `).join('');
    } catch (e) { console.error('Failed to load announcements:', e); }
}

// LOGOUT
function logout() {
    Swal.fire({
        title: 'Are you sure?',
        text: "You will be logged out.",
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#dd3333',
        showCancelButton: true,
        confirmButtonText: 'Yes, logout'
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = "login.html";
        }
    });
}

// CHART
// CHART — REAL-TIME SIT-IN BY COURSE
let sitInChart;

async function fetchSitInStats() {
    try {
        const res = await fetch('http://localhost:3000/api/sitin-stats');
        const data = await res.json();

        const labels = data.length > 0 ? data.map(d => d.course) : ['No Active Sit-ins'];
        const values = data.length > 0 ? data.map(d => d.total) : [1];
        const total  = data.reduce((a, b) => a + b.total, 0);
        const courseColors = ['#0056b3', '#ffc107', '#28a745', '#dc3545', '#6f42c1'];
        const emptyColor   = ['#e0e0e0'];

        // Update Active counter
        document.getElementById('currentSitIn').textContent = total;

        // Update per-course numbers above chart
        document.getElementById('courseStats').innerHTML = data.length > 0
            ? data.map((d, i) => `
                <div class="stat-item">
                    <h3 style="color:${courseColors[i % courseColors.length]};">${d.total}</h3>
                    <p>${d.course}</p>
                </div>
              `).join('')
            : `<p style="color:#aaa; font-size:13px; text-align:center; width:100%;">No active sit-ins</p>`;

        const bgColors = data.length > 0 ? courseColors.slice(0, labels.length) : emptyColor;

        if (!sitInChart) {
            const ctx = document.getElementById('statsChart').getContext('2d');
            sitInChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data: values,
                        backgroundColor: bgColors
                    }]
                },
                options: {
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        } else {
            sitInChart.data.labels = labels;
            sitInChart.data.datasets[0].data = values;
            sitInChart.data.datasets[0].backgroundColor = bgColors;
            sitInChart.update();
        }
    } catch (e) {
        console.error('Failed to fetch sit-in stats:', e);
    }
}

fetchSitInStats();
setInterval(fetchSitInStats, 2000);