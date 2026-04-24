document.addEventListener("DOMContentLoaded", () => {
    const sessionData = localStorage.getItem("user");

    // 🔒 Redirect if not logged in
    if (!sessionData) {
        window.location.href = "login.html";
        return;
    }

    const user = JSON.parse(sessionData);

    // 🖼️ PROFILE IMAGE (NEW)
    const profileImg = document.getElementById("profile-img");
    if (profileImg) {
        if (user.profileImage) {
            profileImg.src = `http://localhost:3000/images/${user.profileImage}`;
        } else {
            profileImg.src = "images/avatar.png"; // fallback
        }
    }

    // 👤 Display user info
    document.getElementById("display-name").textContent =
        `${user.firstName} ${user.middleName || ""} ${user.lastName}`;
    document.getElementById("display-email").textContent = user.email;
    document.getElementById("display-address").textContent = user.address;
    document.getElementById("display-course").textContent = user.course;
    document.getElementById("display-yearLevel").textContent = user.yearLevel;
    document.getElementById("display-id").textContent = user.idNumber;

    // 🎉 SHOW WELCOME ONLY AFTER LOGIN
    if (localStorage.getItem("justLoggedIn") === "true") {
        Swal.fire({
            icon: 'success',
            title: `Welcome, ${user.firstName}! 👋`,
            timer: 1500,
            showConfirmButton: false
        });

        localStorage.removeItem("justLoggedIn");
    }

    // 🧹 Reset alert flags ONLY on fresh login
    if (!localStorage.getItem("loginTime")) {
        localStorage.setItem("loginTime", Date.now().toString());
        localStorage.removeItem("alertShown");
        localStorage.removeItem("warningShown");
        localStorage.removeItem("expiredShown");
    }

    const timerEl = document.getElementById("session-timer");
    const wrapperEl = document.getElementById("session-timer-wrapper");
    const statusEl = document.getElementById("timer-status");

    function updateTimer() {
        const loginTime = parseInt(localStorage.getItem("loginTime"), 10);
        if (!loginTime) return;

        const elapsed = Math.floor((Date.now() - loginTime) / 1000);

        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;

        timerEl.textContent =
            String(hours).padStart(2, "0") + ":" +
            String(minutes).padStart(2, "0") + ":" +
            String(seconds).padStart(2, "0");

        // 🚨 SESSION EXPIRED (1 hour)
        if (elapsed >= 3600) {
            wrapperEl.className = "session-timer-wrapper timer-danger";
            statusEl.textContent = "Session expired!";

            if (!localStorage.getItem("expiredShown")) {
                localStorage.setItem("expiredShown", "true");

                Swal.fire({
                    icon: 'error',
                    title: 'Session Expired',
                    text: 'You exceeded 1 hour session.',
                    confirmButtonText: 'Logout'
                }).then(() => {
                    logout();
                });
            }
        }

        // ⚠️ WARNING (45 minutes)
        else if (elapsed >= 2700) {
            wrapperEl.className = "session-timer-wrapper timer-warning";

            const remaining = 3600 - elapsed;
            const remMin = Math.floor(remaining / 60);
            const remSec = remaining % 60;

            statusEl.textContent =
                `${String(remMin).padStart(2,"0")}:${String(remSec).padStart(2,"0")} remaining`;

            if (!localStorage.getItem("warningShown")) {
                localStorage.setItem("warningShown", "true");

                Swal.fire({
                    icon: 'warning',
                    title: 'Session Warning',
                    text: 'Only 15 minutes remaining!',
                    timer: 2500,
                    showConfirmButton: false
                });
            }
        }

        // ✅ NORMAL
        else {
            wrapperEl.className = "session-timer-wrapper timer-normal";
            statusEl.textContent = "Session active";
        }
    }

    // ▶️ Start timer
    updateTimer();
    setInterval(updateTimer, 1000);
});

let readAnnouncementIds = JSON.parse(localStorage.getItem('readAnnouncements') || '[]');

async function loadNotifications() {
    try {
        const res  = await fetch('http://localhost:3000/api/announcements');
        const data = await res.json();

        const unread = data.filter(a => !readAnnouncementIds.includes(a.id));
        const badge  = document.getElementById('notifBadge');
        const list   = document.getElementById('notifList');

        badge.textContent = unread.length > 0 ? unread.length : '';
        badge.style.display = unread.length > 0 ? 'inline-block' : 'none';

        list.innerHTML = data.length === 0
            ? '<p style="padding:15px;color:#aaa;font-size:13px;text-align:center;">No announcements.</p>'
            : data.map(a => `
                <div class="notif-item ${readAnnouncementIds.includes(a.id) ? 'read' : 'unread'}"
                     onclick="markRead(${a.id})">
                    <div class="notif-msg">${a.message}</div>
                    <div class="notif-time">${new Date(a.createdAt).toLocaleString()}</div>
                </div>
              `).join('');
    } catch (e) { console.error('Notification error:', e); }
}

function markRead(id) {
    if (!readAnnouncementIds.includes(id)) {
        readAnnouncementIds.push(id);
        localStorage.setItem('readAnnouncements', JSON.stringify(readAnnouncementIds));
        loadNotifications();
    }
}

function markAllRead() {
    fetch('http://localhost:3000/api/announcements')
        .then(r => r.json())
        .then(data => {
            readAnnouncementIds = data.map(a => a.id);
            localStorage.setItem('readAnnouncements', JSON.stringify(readAnnouncementIds));
            loadNotifications();
        });
}

function toggleNotifDropdown(e) {
    e.preventDefault();
    const dropdown = document.getElementById('notifDropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.notif-wrapper')) {
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

// Poll every 10 seconds
loadNotifications();
setInterval(loadNotifications, 10000);


// 🔴 GLOBAL LOGOUT FUNCTION
function logout(event) {
    if (event) event.preventDefault();

    Swal.fire({
        title: 'Are you sure?',
        text: "You will be logged out.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#dd3333',
        confirmButtonText: 'Yes, logout'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = "login.html";
        }
    });
}