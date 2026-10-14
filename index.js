/**
 * FLUXY License Server — Main Entry
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ========================================
// HEALTH CHECK
// ========================================
app.get('/', (req, res) => {
    res.json({
        ok: true,
        name: 'FLUXY License Server',
        version: '1.0.0',
        status: 'online'
    });
});

// ========================================
// ENDPOINT: VERIFY KEY (dari APK)
// ========================================
app.post('/api/verify', (req, res) => {
    const { key, usn, hwid } = req.body;

    if (!key || !usn) {
        return res.json({ ok: false, err: 'Key atau Username kosong' });
    }

    const result = db.verifyKey(key, usn, hwid);

    if (!result.ok) {
        return res.json(result);
    }

    return res.json({
        ok: true,
        usn: result.usn,
        role: result.role,
        expired_at: result.expired_at,
        sisa_hari: result.sisa_hari,
        message: 'Login berhasil'
    });
});

// ========================================
// ENDPOINT: CHECK SESSION
// ========================================
app.post('/api/check', (req, res) => {
    const { key, usn } = req.body;

    if (!key || !usn) {
        return res.json({ ok: false, err: 'Parameter kurang' });
    }

    const result = db.checkSession(key, usn);
    return res.json(result);
});

// ========================================
// ENDPOINT: STATS
// ========================================
app.get('/api/stats', (req, res) => {
    const stats = db.getStats();
    res.json(stats);
});

// ========================================
// ENDPOINT: LIST USER
// ========================================
app.get('/api/users', (req, res) => {
    const users = db.listUsers();
    res.json({ ok: true, users });
});

// ========================================
// START
// ========================================
app.listen(PORT, () => {
    console.log('========================================');
    console.log(' FLUXY License Server');
    console.log(' Port: ' + PORT);
    console.log(' Status: ONLINE');
    console.log('========================================');

    // Start bot
    require('./bot');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    process.exit(0);
});