/**
 * FLUXY Telegram Bot — Admin Panel
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = process.env.OWNER_CHAT_ID;

if (!TOKEN) {
    console.error('[BOT] TELEGRAM_BOT_TOKEN belum diset!');
    module.exports = null;
} else {
    const bot = new TelegramBot(TOKEN, { polling: true });

    const userRoles = {};

    function isOwner(chatId) {
        return String(chatId) === String(OWNER_ID);
    }

    function getRole(chatId) {
        if (isOwner(chatId)) return 'owner';
        return userRoles[chatId] || 'user';
    }

    // /start
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const role = getRole(chatId);

        let menu = `🔥 FLUXY LICENSE BOT 🔥\n\n`;
        menu += `Selamat datang, ${msg.from.first_name}!\n`;
        menu += `Role: ${role.toUpperCase()}\n\n`;

        if (role === 'owner') {
            menu += `📋 COMMAND OWNER:\n`;
            menu += `/genkey <durasi> <jumlah>\n`;
            menu += `/listkey — Lihat semua key\n`;
            menu += `/listuser — Lihat user aktif\n`;
            menu += `/stats — Statistik\n`;
            menu += `/addreseller <chat_id>\n`;
            menu += `/help — Bantuan\n`;
        } else if (role === 'reseller') {
            menu += `📋 COMMAND RESELLER:\n`;
            menu += `/genkey <durasi> <jumlah>\n`;
            menu += `/listkey — Key Anda\n`;
            menu += `/stats — Statistik\n`;
            menu += `/help — Bantuan\n`;
        } else {
            menu += `📋 COMMAND USER:\n`;
            menu += `/help — Bantuan\n`;
        }

        bot.sendMessage(chatId, menu);
    });

    // /genkey <durasi> <jumlah>
    bot.onText(/\/genkey(?:@\w+)?\s+(\S+)\s+(\d+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const role = getRole(chatId);

        if (role !== 'owner' && role !== 'reseller') {
            return bot.sendMessage(chatId, '❌ Cuma owner/reseller yang bisa generate key.');
        }

        const durasi = match[1].toLowerCase();
        const jumlah = parseInt(match[2]);

        if (jumlah > 1000) {
            return bot.sendMessage(chatId, '❌ Max 1000 key per generate.');
        }

        const durationMap = {
            '1d': 1, '3d': 3, '7d': 7,
            '15d': 15, '30d': 30,
            'permanent': 9999
        };

        if (!durationMap[durasi]) {
            return bot.sendMessage(chatId,
                '❌ Durasi tidak valid. Pilih: 1d, 3d, 7d, 15d, 30d, permanent');
        }

        const days = durationMap[durasi];

        bot.sendMessage(chatId, `⏳ Generate ${jumlah} key (${durasi})...`);

        try {
            const keys = db.generateKeys(durasi, days, jumlah, role);
            let text = `✅ ${jumlah} key berhasil digenerate!\n\n`;
            text += `Durasi: ${durasi}\n`;
            text += `Role: ${role}\n\n`;
            text += `Key:\n`;

            keys.forEach((k, i) => {
                text += `${i + 1}. \`${k}\`\n`;
            });

            text += `\nTinggal copy, kirim ke buyer.`;

            bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        } catch (e) {
            bot.sendMessage(chatId, '❌ Error: ' + e.message);
        }
    });

    // /listkey
    bot.onText(/\/listkey/, (msg) => {
        const chatId = msg.chat.id;
        const role = getRole(chatId);

        if (role !== 'owner' && role !== 'reseller') {
            return bot.sendMessage(chatId, '❌ Khusus owner/reseller.');
        }

        const keys = db.listKeys(role);
        if (!keys.length) {
            return bot.sendMessage(chatId, '📭 Belum ada key.');
        }

        let text = `📋 DAFTAR KEY (${keys.length}):\n\n`;
        keys.slice(0, 50).forEach((k, i) => {
            const status = k.used === 1 ? '🔴 USED' : '🟢 FREE';
            text += `${i + 1}. ${status} \`${k.key}\` (${k.duration})\n`;
        });

        if (keys.length > 50) {
            text += `\n... dan ${keys.length - 50} lainnya.`;
        }

        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    // /listuser
    bot.onText(/\/listuser/, (msg) => {
        const chatId = msg.chat.id;
        const role = getRole(chatId);

        if (role !== 'owner') {
            return bot.sendMessage(chatId, '❌ Khusus owner.');
        }

        const users = db.listUsers();
        if (!users.length) {
            return bot.sendMessage(chatId, '📭 Belum ada user.');
        }

        let text = `👥 DAFTAR USER (${users.length}):\n\n`;
        users.slice(0, 50).forEach((u, i) => {
            const sisa = Math.ceil((u.expired_at - Date.now()) / 86400000);
            text += `${i + 1}. ${u.usn} — sisa ${sisa} hari\n`;
        });

        bot.sendMessage(chatId, text);
    });

    // /stats
    bot.onText(/\/stats/, (msg) => {
        const chatId = msg.chat.id;
        const role = getRole(chatId);

        if (role !== 'owner' && role !== 'reseller') {
            return bot.sendMessage(chatId, '❌ Khusus owner/reseller.');
        }

        const stats = db.getStats();
        let text = `📊 STATISTIK FLUXY\n\n`;
        text += `Total Key: ${stats.total_keys}\n`;
        text += `Key Used: ${stats.used_keys}\n`;
        text += `Key Free: ${stats.free_keys}\n`;
        text += `Total User: ${stats.total_users}\n`;
        text += `User Aktif: ${stats.active_users}\n`;

        bot.sendMessage(chatId, text);
    });

    // /addreseller <chat_id>
    bot.onText(/\/addreseller(?:@\w+)?\s+(\d+)/, (msg, match) => {
        const chatId = msg.chat.id;
        if (!isOwner(chatId)) {
            return bot.sendMessage(chatId, '❌ Khusus owner.');
        }

        const targetId = match[1];
        userRoles[targetId] = 'reseller';
        bot.sendMessage(chatId, `✅ Reseller ditambahkan: ${targetId}`);
        bot.sendMessage(targetId, `🎉 Anda sekarang RESELLER FLUXY!\nKetik /start untuk menu.`);
    });

    // /help
    bot.onText(/\/help/, (msg) => {
        const chatId = msg.chat.id;
        const role = getRole(chatId);

        let text = `📖 BANTUAN FLUXY BOT\n\n`;
        if (role === 'owner' || role === 'reseller') {
            text += `/genkey <durasi> <jumlah>\n`;
            text += `  Contoh: /genkey 7d 10\n`;
            text += `  Durasi: 1d, 3d, 7d, 15d, 30d, permanent\n\n`;
            text += `/listkey — Lihat key\n`;
            text += `/stats — Statistik\n`;
            if (role === 'owner') {
                text += `/listuser — Lihat user\n`;
                text += `/addreseller <chat_id>\n`;
            }
        } else {
            text += `Hubungi owner untuk beli key.\n`;
        }

        bot.sendMessage(chatId, text);
    });

    bot.on('polling_error', (err) => {
        console.error('[BOT] polling_error:', err.message);
    });

    console.log('========================================');
    console.log(' FLUXY Bot: ONLINE');
    console.log('========================================');

    module.exports = bot;
}