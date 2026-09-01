const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all incoming connections
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize SQLite Database
const db = new sqlite3.Database('./users.db', (err) => {
    if (err) console.error("Database connection error:", err.message);
    else console.log("Connected to SQLite database.");
});

// Create Users Table
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        usernameLower TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        pfp TEXT
    )
`);

// Route: Sign Up
app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;
    const usernameLower = username.toLowerCase();
    const defaultPfp = 'https://picsum.photos/200';

    const sql = `INSERT INTO users (username, usernameLower, password, pfp) VALUES (?, ?, ?, ?)`;
    db.run(sql, [username, usernameLower, password, defaultPfp], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Username is already taken.' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, username: username });
    });
});

// Route: Log In
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const usernameLower = username.toLowerCase();

    const sql = `SELECT * FROM users WHERE usernameLower = ? AND password = ?`;
    db.get(sql, [usernameLower, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(401).json({ error: 'Invalid username or password.' });

        res.json({
            success: true,
            user: { username: row.username, pfp: row.pfp }
        });
    });
});

// Route: Get User Data
app.get('/api/user/:username', (req, res) => {
    const sql = `SELECT username, pfp FROM users WHERE usernameLower = ?`;
    db.get(sql, [req.params.username.toLowerCase()], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'User not found.' });
        res.json(row);
    });
});

// Route: Update Username or Password
app.put('/api/user/update', (req, res) => {
    const { currentUsername, newUsername, newPassword, currentPassword } = req.body;
    const currentLower = currentUsername.toLowerCase();

    db.get(`SELECT * FROM users WHERE usernameLower = ?`, [currentLower], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'User not found.' });
        if (row.password !== currentPassword) return res.status(400).json({ error: 'Incorrect current password!' });

        const updatedName = newUsername ? newUsername : row.username;
        const updatedNameLower = updatedName.toLowerCase();
        const updatedPass = newPassword ? newPassword : row.password;

        const updateSql = `UPDATE users SET username = ?, usernameLower = ?, password = ? WHERE usernameLower = ?`;
        db.run(updateSql, [updatedName, updatedNameLower, updatedPass, currentLower], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Username is already taken.' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, updatedUsername: updatedName });
        });
    });
});

// Route: Update Profile Picture
app.put('/api/user/pfp', (req, res) => {
    const { username, pfp } = req.body;
    const sql = `UPDATE users SET pfp = ? WHERE usernameLower = ?`;
    db.run(sql, [pfp, username.toLowerCase()], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Route: Admin - Get All Users
app.get('/api/admin/users', (req, res) => {
    const sql = `SELECT username, password FROM users`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Route: Admin - Delete User Account
app.delete('/api/admin/user/:username', (req, res) => {
    const sql = `DELETE FROM users WHERE usernameLower = ?`;
    db.run(sql, [req.params.username.toLowerCase()], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Listen on all network addresses (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
