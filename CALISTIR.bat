@echo off
rem DCK-EOS Fiyat Endeksi - yerel gelistirme baslatici (Windows)
rem Arka uc: backend\.venv icindeki Python, fikstur verisiyle, 127.0.0.1:8001
rem On yuz : CRA gelistirme sunucusu, http://localhost:3000
rem Iki ayri pencere acilir; kapatmak icin pencereleri kapatin (Ctrl+C).
setlocal
cd /d "%~dp0"

set "PY=%~dp0backend\.venv\Scripts\python.exe"
if not exist "%PY%" (
    echo [HATA] backend\.venv bulunamadi. Once su komutlari calistirin:
    echo    python -m venv backend\.venv
    echo    backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
    pause
    exit /b 1
)
if not exist "%~dp0frontend\node_modules" (
    echo [HATA] frontend\node_modules bulunamadi. Once su komutu calistirin:
    echo    cd frontend ^&^& yarn install
    pause
    exit /b 1
)
where yarn >nul 2>nul
if errorlevel 1 (
    echo [HATA] yarn bulunamadi. Node LTS kurulu ise: corepack enable
    pause
    exit /b 1
)

echo Arka uc baslatiliyor (127.0.0.1:8001, --fixtures)...
start "DCK-EOS arka uc :8001" cmd /k "cd /d "%~dp0backend" && "%PY%" server.py --fixtures"

echo On yuz baslatiliyor (localhost:3000)...
start "DCK-EOS on yuz :3000" cmd /k "cd /d "%~dp0frontend" && set BROWSER=none&& yarn start"

echo On yuzun hazir olmasi bekleniyor...
set /a TRIES=0
:WAIT
set /a TRIES+=1
curl -s -o nul http://localhost:3000 >nul 2>nul
if not errorlevel 1 goto OPEN
if %TRIES% geq 60 (
    echo [UYARI] 3000 portu 2 dakikada acilmadi; tarayiciyi elle acin: http://localhost:3000
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
goto WAIT

:OPEN
start "" http://localhost:3000
echo Tarayici acildi. Bu pencere kapatilabilir.
timeout /t 3 >nul
endlocal
