@echo off
rem DCK-EOS Fiyat Endeksi - yerel gelistirme baslatici (Windows)
rem Arka uc: backend\.venv icindeki Python, fikstur verisiyle, 127.0.0.1:8001
rem On yuz : CRA gelistirme sunucusu, http://localhost:3000
rem Iki ayri pencere acilir; kapatmak icin pencereleri kapatin (Ctrl+C).
setlocal EnableExtensions
cd /d "%~dp0"

rem Gezgin'den cift tiklandiginda PATH bayat olabilir; Node ve corepack
rem shim dizinlerini kendimiz ekleyelim.
set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%LOCALAPPDATA%\Programs\nodejs;%PATH%"
set "COREPACK_ENABLE_DOWNLOAD_PROMPT=0"

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

rem ---- yarn'i bul: PATH -> %APPDATA%\npm\yarn.cmd -> npx --yes yarn -> corepack yarn
set "YARN="
where yarn >nul 2>nul
if not errorlevel 1 set "YARN=yarn"
if not defined YARN if exist "%APPDATA%\npm\yarn.cmd" set "YARN=%APPDATA%\npm\yarn.cmd"
if not defined YARN (
    where npx >nul 2>nul
    if not errorlevel 1 (
        call npx --yes yarn --version >nul 2>nul
        if not errorlevel 1 set "YARN=npx --yes yarn"
    )
)
if not defined YARN (
    where corepack >nul 2>nul
    if not errorlevel 1 (
        call corepack yarn --version >nul 2>nul
        if not errorlevel 1 set "YARN=corepack yarn"
    )
)
if not defined YARN (
    echo [HATA] yarn bulunamadi. Node LTS kurulu degilse https://nodejs.org/ adresinden kurun,
    echo kuruluysa su komutu bir kez calistirin ^(yonetici gerekmez^):
    echo    corepack enable --install-directory "%%APPDATA%%\npm"
    echo ardindan bu dosyayi yeniden calistirin.
    pause
    exit /b 1
)
echo yarn: %YARN%

echo Arka uc baslatiliyor (127.0.0.1:8001, --fixtures)...
start "DCK-EOS arka uc :8001" cmd /k "cd /d "%~dp0backend" && "%PY%" server.py --fixtures"

echo On yuz baslatiliyor (localhost:3000)...
start "DCK-EOS on yuz :3000" cmd /k "cd /d "%~dp0frontend" && set BROWSER=none&& %YARN% start"

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
