# FLUXY License Server

Backend server untuk sistem license FLUXY APK.

## Fitur

- Generate key unlimited (owner/reseller)
- Verify key dari APK
- Session management
- Multi-duration (1d, 3d, 7d, 15d, 30d, permanent)
- Bot Telegram admin

## Deploy ke Railway

1. Fork repo ini ke GitHub
2. Buka railway.app → New Project → Deploy from GitHub
3. Pilih repo ini
4. Set Variables:
   - `TELEGRAM_BOT_TOKEN` = token dari @BotFather
   - `OWNER_CHAT_ID` = chat ID Anda dari @userinfobot
5. Railway auto-deploy
6. Test bot TG: `/start`

## Endpoint API

### Verify Key (dari APK)