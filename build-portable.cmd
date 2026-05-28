@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem JhonJara Modificacion
set "APP_NAME=FSM-Penales-Portable"
set "DIST_DIR=%~dp0dist\%APP_NAME%"
set "BUNDLED_NODE=%DIST_DIR%\node\node.exe"
set "NODE_SOURCE="

if exist "%ProgramFiles%\nodejs\node.exe" (
  set "NODE_SOURCE=%ProgramFiles%\nodejs\node.exe"
)

if "%NODE_SOURCE%"=="" (
  for /f "delims=" %%N in ('where node 2^>nul') do (
    if "!NODE_SOURCE!"=="" set "NODE_SOURCE=%%N"
  )
)

if "%NODE_SOURCE%"=="" (
  echo [ERROR] No se encontro Node.js en esta maquina para construir el portable.
  echo Instale Node.js LTS solo en esta maquina de preparacion y vuelva a ejecutar.
  pause
  exit /b 1
)

echo ==========================================
echo  Construyendo paquete portable FSM Penales
echo ==========================================
echo Node origen: %NODE_SOURCE%
echo Destino: %DIST_DIR%
echo.

if not exist "%~dp0node_modules\ws\package.json" (
  echo Instalando dependencias de produccion...
  call npm.cmd install --omit=dev
  if errorlevel 1 (
    echo [ERROR] No fue posible instalar dependencias.
    pause
    exit /b 1
  )
)

if exist "%DIST_DIR%" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -LiteralPath '%DIST_DIR%' -Recurse -Force"
)

mkdir "%DIST_DIR%" >nul
mkdir "%DIST_DIR%\node" >nul

copy /Y "%NODE_SOURCE%" "%BUNDLED_NODE%" >nul
xcopy /E /I /Y "%~dp0public" "%DIST_DIR%\public" >nul
xcopy /E /I /Y "%~dp0node_modules" "%DIST_DIR%\node_modules" >nul

if exist "%~dp0docs" (
  xcopy /E /I /Y "%~dp0docs" "%DIST_DIR%\docs" >nul
)

copy /Y "%~dp0server.js" "%DIST_DIR%\server.js" >nul
copy /Y "%~dp0start.cmd" "%DIST_DIR%\start.cmd" >nul
copy /Y "%~dp0package.json" "%DIST_DIR%\package.json" >nul
copy /Y "%~dp0package-lock.json" "%DIST_DIR%\package-lock.json" >nul
copy /Y "%~dp0README.md" "%DIST_DIR%\README.md" >nul

(
  echo FSM Penales - Paquete Portable
  echo.
  echo Para ejecutar:
  echo 1. Abrir esta carpeta.
  echo 2. Para Portero: start.cmd portero
  echo 3. Para Pateador: start.cmd pateador
  echo.
  echo No requiere instalar Node.js en la maquina destino.
  echo No mover archivos internos: node\, public\, node_modules\ y server.js son necesarios.
  echo.
  echo URLs locales:
  echo Portero FSM: http://localhost:5000
  echo Pateador FSM: http://localhost:5001
  echo.
  echo Para usar dos maquinas diferentes:
  echo 1. En el equipo del Portero ejecute: start.cmd portero
  echo 2. Copie la IP de red que muestra la consola del Portero.
  echo 3. En el equipo del Pateador ejecute: start.cmd pateador
  echo 4. En la pantalla del Pateador ingrese la IP y puerto del Portero rival.
) > "%DIST_DIR%\LEEME_EJECUTAR.txt"

echo.
echo [OK] Paquete portable listo:
echo %DIST_DIR%
echo.
echo Copie completa la carpeta "%APP_NAME%" a USB o al equipo del salon.
echo En la maquina destino solo haga doble click en start.cmd.
pause
rem Fin de Modificacion
