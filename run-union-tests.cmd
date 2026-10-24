@echo off
set PLAYWRIGHT_BROWSERS_PATH=C:\FPTU\Capstone\angi-frontend\.cache\browsers
cd /d C:\FPTU\Capstone\angi-frontend-union
if exist .cache\pw-union.log del .cache\pw-union.log
call npx playwright test --reporter=list > .cache\pw-union.log 2>&1
echo FINISHED >> .cache\pw-union.log
