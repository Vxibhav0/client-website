@echo off
REM ================================================================
REM  HOT n COLD -- start script (Windows)
REM
REM  1. Is file ko apne project folder mein rakho, JAHAN server.js
REM     hai (usi folder mein, bahar nahi).
REM  2. Neeche di gayi values ko apni real values se replace karo.
REM  3. Bas is file ko double-click karo -- server sahi settings
REM     ke saath start ho jayega, kuch bhi manually type nahi karna.
REM ================================================================

REM --- Admin panel ka password (order desk login) ---
REM Isko zaroor badlo -- default password kabhi mat rehne do.
set ADMIN_PASSWORD=apna-real-password-daalo

REM --- Aapka apna mobile number ---
REM Naya order aate hi isi number par "New order" message jayega.
REM Sirf 10 digit likho, +91 mat lagao.
set OWNER_PHONE=9876543210

REM --- Twilio settings (SMS/WhatsApp bhejne ke liye) ---
REM Agar Twilio abhi setup nahi kiya hai, inhe waise hi khali
REM chhod do -- app crash nahi hogi, sab kuch terminal mein log
REM hota rahega jab tak inhe bhar nahi dete.
set TWILIO_ACCOUNT_SID=
set TWILIO_AUTH_TOKEN=
set TWILIO_WHATSAPP_FROM=
set TWILIO_SMS_FROM=

echo.
echo Starting HOT n COLD server...
echo.

node server.js

REM Agar server kisi wajah se turant band ho jaye (crash / error),
REM ye window khuli rahegi taaki error message padh sako.
pause
