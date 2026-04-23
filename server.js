const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const app = express();
const PORT = 3000;
const SESSION_DURATION_MINUTES = 60;

app.use(cors());
app.use(bodyParser.json());
app.use("/images", express.static("images"));

const adminAccount = {
    username: "admin",
    password: "admin123"
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "images/");
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

const db = new sqlite3.Database("sho.db", (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log("Connected to SQLite database.");
    }
});

db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idNumber TEXT,
    lastName TEXT,
    firstName TEXT,
    middleName TEXT,
    email TEXT,
    password TEXT,
    address TEXT,
    course TEXT,
    yearLevel TEXT,
    profileImage TEXT,
    remainingSession INTEGER DEFAULT 30
)
`);

db.run(`CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idNumber TEXT,
    purpose TEXT,
    lab TEXT,
    pcNumber TEXT,
    timeIn TEXT,
    timeOut TEXT,
    date TEXT,
    status TEXT DEFAULT 'Pending'
)`);

db.run(`
CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idNumber TEXT,
    loginTime TEXT,
    logoutTime TEXT
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idNumber TEXT,
    lab TEXT,
    date TEXT,
    rating INTEGER,
    message TEXT
)`);


//           ROUTES                   //


// register route
app.post("/register", (req, res) => {
    console.log("DATA RECEIVED", req.body);
    const {
        idNumber, lastName, firstName, middleName,
        email, password, address, course, yearLevel
    } = req.body;

    const sql = `
    INSERT INTO users (idNumber, lastName, firstName, middleName, email, password, address, course, yearLevel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [idNumber, lastName, firstName, middleName, email, password, address, course, yearLevel], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User registered successfully!" });
    });
});

// login route
app.post("/login", (req, res) => {
    const { idNumber, password } = req.body;

    if (idNumber === adminAccount.username) {
        if (password !== adminAccount.password) {
            return res.status(400).json({ error: "Incorrect password" });
        }
        return res.json({ role: "admin", user: adminAccount });
    }

    const sql = `SELECT * FROM users WHERE idNumber = ?`;
    db.get(sql, [idNumber], (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!row) return res.status(400).json({ error: "ID Number not found" });
        if (row.password !== password) return res.status(400).json({ error: "Incorrect password" });

        const now = new Date().toISOString();
        db.run(`INSERT INTO login_history (idNumber, loginTime) VALUES (?, ?)`, [idNumber, now]);

        res.json({ role: "user", user: row });
    });
});

// logout route
app.post("/logout", (req, res) => {
    const { idNumber } = req.body;
    const now = new Date().toISOString();
    const sql = `UPDATE login_history SET logoutTime = ? WHERE idNumber = ? AND logoutTime IS NULL ORDER BY id DESC LIMIT 1`;
    db.run(sql, [now, idNumber], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Logout recorded" });
    });
});

// update profile route
app.post("/update-profile", upload.single("profileImage"), (req, res) => {
    const {
        oldIdNumber, idNumber, lastName, firstName,
        middleName, yearLevel, course, email, address
    } = req.body;

    if (!oldIdNumber) return res.status(400).json({ error: "oldIdNumber is required" });

    const profileImage = req.file ? req.file.filename : null;

    const sql = `
        UPDATE users
        SET idNumber = ?, lastName = ?, firstName = ?, middleName = ?,
            yearLevel = ?, course = ?, email = ?, address = ?,
            profileImage = COALESCE(?, profileImage)
        WHERE idNumber = ?
    `;

    db.run(sql, [idNumber, lastName, firstName, middleName, yearLevel, course, email, address, profileImage, oldIdNumber], function(err) {
        if (err) return res.status(500).json({ error: "Database error" });
        if (this.changes === 0) return res.status(400).json({ error: "No user found with that ID" });
        res.json({ success: true, image: profileImage, message: "Profile updated successfully!" });
    });
});

// make reservation
app.post("/make-reservation", (req, res) => {
    const { idNumber, purpose, lab, timeIn, date, pcNumber } = req.body;

    // Combine date + time into a full ISO string
    const fullTimeIn = (date && timeIn) ? new Date(`${date}T${timeIn}`).toISOString() : new Date().toISOString();

    const sql = `
        INSERT INTO reservations (idNumber, purpose, lab, timeIn, date, pcNumber, status)
        VALUES (?, ?, ?, ?, ?, ?, 'Pending')
    `;
    db.run(sql, [idNumber, purpose, lab, fullTimeIn, date, pcNumber], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: "Reservation submitted and pending approval!" });
    });
});

// get history for a student
app.get("/history/:idNumber", (req, res) => {
    const idNumber = req.params.idNumber;
    db.all(`
        SELECT r.idNumber,
               u.firstName || ' ' || u.lastName AS name,
               r.purpose, r.lab, r.timeIn, r.timeOut, r.date
        FROM reservations r
        JOIN users u ON r.idNumber = u.idNumber
        WHERE r.idNumber = ?
        ORDER BY r.date DESC, r.timeIn DESC
    `, [idNumber], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// get all students (admin)
app.get("/admin/students", (req, res) => {
    db.all(`SELECT idNumber, firstName, lastName, course, yearLevel, remainingSession FROM users WHERE idNumber != 'Admin' ORDER BY lastName ASC`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// get student by ID (supports both route patterns)
app.get(["/student/:idNumber", "/get-student/:idNumber"], (req, res) => {
    const idNumber = req.params.idNumber;

    db.get(`SELECT * FROM users WHERE idNumber = ?`, [idNumber], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ message: "Student not found." });

        db.get(
            `SELECT timeIn, timeOut FROM reservations 
             WHERE idNumber = ? AND timeOut IS NULL AND status = 'Accepted' 
             ORDER BY id DESC LIMIT 1`,
            [idNumber],
            (err2, active) => {
                if (err2) return res.status(500).json({ error: err2.message });

                res.json({
                    ...user,
                    timeIn:  active ? active.timeIn  : null,
                    timeOut: active ? active.timeOut : null
                });
            }
        );
    });
});

// get all sit-ins
app.get("/get-sitin", (req, res) => {
    const sql = `
        SELECT r.id AS sitInId, r.idNumber, u.firstName, u.lastName,
               r.purpose, r.lab, r.timeIn, r.timeOut, r.date,
               u.remainingSession
        FROM reservations r
        JOIN users u ON r.idNumber = u.idNumber
        WHERE r.status = 'Accepted'
        ORDER BY r.date DESC, r.timeIn DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST a new sit-in  (FIX: use ISO date string for consistency)
app.post("/sit-in", (req, res) => {
    const { idNumber, purpose, lab } = req.body;
    const now = new Date();
    const timeIn = now.toISOString();
    const date = now.toISOString().split("T")[0];

    db.get(`SELECT remainingSession FROM users WHERE idNumber = ?`, [idNumber], (err, user) => {
        if (err) return res.status(500).send("Database error");
        if (!user) return res.status(404).send("Student not found");
        if (user.remainingSession <= 0) return res.status(400).send("No sessions left!");

        db.run(
            `INSERT INTO reservations (idNumber, purpose, lab, timeIn, date, status) VALUES (?, ?, ?, ?, ?, 'Accepted')`,
            [idNumber, purpose, lab, timeIn, date],
            function(err) {
                if (err) return res.status(500).send(err.message);
                db.run(`UPDATE users SET remainingSession = remainingSession - 1 WHERE idNumber = ?`, [idNumber]);
                res.json({ message: "Sit-in recorded!" });
            }
        );
    });
});

// time out a sit-in
app.post("/time-out", (req, res) => {
    const { idNumber, sitInId } = req.body;
    const timeOut = new Date().toISOString();

    db.run(
        `UPDATE reservations SET timeOut = ? WHERE id = ? AND idNumber = ?`,
        [timeOut, sitInId, idNumber],
        function(err) {
            if (err) return res.status(500).send(err.message);
            res.json({ message: "Timed out successfully" });
        }
    );
});

// delete student
app.delete("/delete-student/:idNumber", (req, res) => {
    db.run(`DELETE FROM users WHERE idNumber = ?`, [req.params.idNumber], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Student deleted" });
    });
});

// reset all sessions to 30
app.post("/reset-sessions", (req, res) => {
    db.run(`UPDATE users SET remainingSession = 30`, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Sessions reset" });
    });
});

// admin reservations list
app.get("/admin/reservations", (req, res) => {
    const sql = `
        SELECT r.*, u.firstName || ' ' || u.lastName AS studentName
        FROM reservations r
        JOIN users u ON r.idNumber = u.idNumber
        ORDER BY r.id DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
});

// update reservation status (with session deduction on accept)
app.post("/admin/update-reservation", (req, res) => {
    const { id, status } = req.body;

    db.get(`SELECT * FROM reservations WHERE id = ?`, [id], (err, reservation) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!reservation) return res.status(404).json({ message: "Reservation not found" });

        db.run(`UPDATE reservations SET status = ? WHERE id = ?`, [status, id], function(err) {
            if (err) return res.status(500).json({ message: err.message });

            if (status === "Accepted") {
                db.run(
                    `UPDATE users SET remainingSession = remainingSession - 1 WHERE idNumber = ?`,
                    [reservation.idNumber]
                );
            }

            res.json({ message: `Reservation ${status}` });
        });
    });
});

// ─── REPORTS ENDPOINT (FIXED) ────────────────────────────────────────────────
// Returns all sit-in records joined with student info.
// Optional ?date=YYYY-MM-DD query param filters by date.
app.get("/admin/reports", (req, res) => {
    const { date } = req.query;

    let sql = `
        SELECT r.id,
               r.idNumber,
               u.firstName,
               u.lastName,
               r.purpose,
               r.lab,
               r.timeIn,
               r.timeOut,
               r.date
        FROM reservations r
        JOIN users u ON r.idNumber = u.idNumber
    `;
    const params = [];

    if (date) {
        sql += ` WHERE r.date = ?`;
        params.push(date);
    }

    sql += ` ORDER BY r.date DESC, r.timeIn DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post("/api/feedback", (req, res) => {
    const { idNumber, lab, date, rating, message } = req.body;
    db.run(
        `INSERT INTO feedback (idNumber, lab, date, rating, message) VALUES (?, ?, ?, ?, ?)`,
        [idNumber, lab, date, rating, message],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Feedback submitted!" });
        }
    );
});

// GET all feedback (admin)
app.get("/api/feedback", (req, res) => {
    db.all(`SELECT * FROM feedback ORDER BY date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get("/api/sitin-stats", (req, res) => {
    const sql = `
        SELECT u.course, COUNT(*) AS total
        FROM reservations r
        JOIN users u ON r.idNumber = u.idNumber
        WHERE r.timeOut IS NULL AND r.status = 'Accepted'
        GROUP BY u.course
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Sit-in stats error:", err);
            return res.status(500).json({ error: err.message });
        }

        res.json(rows);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});