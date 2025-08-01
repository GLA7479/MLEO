@echo off
echo ==============================
echo 🚀 Auto Git Update and Push
echo ==============================

git add .
git commit -m "Auto update and deploy"
git push origin main

echo ✅ Done! Changes pushed to GitHub.
pause
