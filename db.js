/**
 * FLUXY Database — SQLite Handler
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Railway: pake volume /data kalau ada, kalo nggak pake folder lokal
const DB_DIR = fs.existsSync('/data') ? '/data' : __dirname;
const DB_PATH = path.join(DB_DIR, 'fluxy.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// INIT TABLES
db.exec(`
CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    duration TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    role TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    used_by TEXT,
    hwid TEXT,
    created_at INTEGER NOT NULL,
    used_at INTEGER
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usn TEXT UNIQUE NOT NULL,
    key TEXT NOT NULL,
    hwid TEXT,
    role TEXT NOT NULL,
    login_at INTEGER NOT NULL,
    expired_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_keys_key ON keys(key);
CREATE INDEX IF NOT EXISTS idx_users_usn ON users(usn);
`);

console.log('[DB] Ready at:', DB_PATH);

// GENERATE KEY
function generateKeys(duration, days, count, createdBy) {
    const stmt = db.prepare(`
        INSERT INTO keys (key, duration, duration_days, role, created_at)
        VALUES (?, ?, ?, ?, ?)
    `);

    const results = [];
    const now = Date.now();

    const tx = db.transaction(() => {
        for (let i = 0; i < count; i++) {
            const key = generateKeyString();
            stmt.run(key, duration, days, 'member', now);
            results.push(key);
        }
    });

    tx();
    return results;
}

// KEY GENERATOR
function generateKeyString() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'FLUXY-';

    const blocks = [];
    for (let i = 0; i < 3; i++) {
        let block = '';
        for (let j = 0; j < 4; j++) {
            block += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        blocks.push(block);
    }

    result += blocks.join('-');

    const exists = db.prepare('SELECT id FROM keys WHERE key = ?').get(result);
    if (exists) return generateKeyString();

    return result;
}

// VERIFY KEY
function verifyKey(key, usn, hwid) {
    const keyRow = db.prepare('SELECT * FROM keys WHERE key = ?').get(key);

    if (!keyRow) {
        return { ok: false, err: 'Key tidak ditemukan' };
    }

    const now = Date.now();

    if (keyRow.used === 1) {
        const existingUser = db.prepare('SELECT * FROM users WHERE key = ?').get(key);

        if (!existingUser) {
            return { ok: false, err: 'Key sudah dipakai' };
        }

        if (existingUser.usn === usn) {
            if (existingUser.expired_at < now) {
                return { ok: false, err: 'Masa aktif habis' };
            }
            return {
                ok: true,
                usn: existingUser.usn,
                role: existingUser.role,
                expired_at: existingUser.expired_at,
                sisa_hari: Math.ceil((existingUser.expired_at - now) / 86400000)
            };
        }

        return { ok: false, err: 'Key sudah dipakai user lain' };
    }

    const existingUsn = db.prepare('SELECT * FROM users WHERE usn = ?').get(usn);
    const expiredAt = now + (keyRow.duration_days * 86400000);

    if (existingUsn) {
        db.prepare(`
            UPDATE users
            SET key = ?, hwid = ?, role = ?, login_at = ?, expired_at = ?
            WHERE usn = ?
        `).run(key, hwid || '', 'member', now, expiredAt, usn);
    } else {
        db.prepare(`
            INSERT INTO users (usn, key, hwid, role, login_at, expired_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(usn, key, hwid || '', 'member', now, expiredAt);
    }

    db.prepare(`
        UPDATE keys
        SET used = 1, used_by = ?, hwid = ?, used_at = ?
        WHERE key = ?
    `).run(usn, hwid || '', now, key);

    return {
        ok: true,
        usn: usn,
        role: 'member',
        expired_at: expiredAt,
        sisa_hari: keyRow.duration_days
    };
}

// CHECK SESSION
function checkSession(key, usn) {
    const now = Date.now();
    const user = db.prepare('SELECT * FROM users WHERE usn = ? AND key = ?').get(usn, key);

    if (!user) {
        return { ok: false, err: 'Session tidak ditemukan' };
    }

    if (user.expired_at < now) {
        return { ok: false, err: 'Session expired' };
    }

    return {
        ok: true,
        usn: user.usn,
        role: user.role,
        expired_at: user.expired_at,
        sisa_hari: Math.ceil((user.expired_at - now) / 86400000)
    };
}

// LIST KEYS
function listKeys(role) {
    return db.prepare('SELECT * FROM keys ORDER BY id DESC').all();
}

// LIST USERS
function listUsers() {
    return db.prepare('SELECT * FROM users ORDER BY id DESC').all();
}

// STATS
function getStats() {
    const now = Date.now();
    const totalKeys = db.prepare('SELECT COUNT(*) as c FROM keys').get().c;
    const usedKeys = db.prepare('SELECT COUNT(*) as c FROM keys WHERE used = 1').get().c;
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const activeUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE expired_at > ?').get(now).c;

    return {
        total_keys: totalKeys,
        used_keys: usedKeys,
        free_keys: totalKeys - usedKeys,
        total_users: totalUsers,
        active_users: activeUsers
    };
}

module.exports = {
    generateKeys,
    verifyKey,
    checkSession,
    listKeys,
    listUsers,
    getStats
};