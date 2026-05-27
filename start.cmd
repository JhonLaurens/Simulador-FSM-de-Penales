@echo off
setlocal
cd /d "%~dp0"

rem JhonJara Modificacion
title FSM Penales - Presentacion Final
if "%GOALKEEPER_PORT%"=="" set "GOALKEEPER_PORT=5000"
if "%SHOOTER_PORT%"=="" set "SHOOTER_PORT=5001"
set "NODE_EXE=node"
set "LAN_IP=localhost"

if exist "%~dp0node\node.exe" (
  set "NODE_EXE=%~dp0node\node.exe"
)

for /f "delims=" %%I in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$ip = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | Select-Object -First 1 -ExpandProperty IPv4Address | Select-Object -First 1 -ExpandProperty IPAddress); if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { -not $_.IPAddress.StartsWith('127.') -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress) }; if ($ip) { Write-Output $ip }"') do set "LAN_IP=%%I"

echo ==========================================
echo  FSM Penales - Matematica Informatica Av.
echo ==========================================
echo.
echo Portero FSM: http://localhost:%GOALKEEPER_PORT%
echo Pateador FSM: http://localhost:%SHOOTER_PORT%
echo.
echo Links para usar desde otras maquinas de la misma red:
echo Portero FSM: http://%LAN_IP%:%GOALKEEPER_PORT%
echo Pateador FSM: http://%LAN_IP%:%SHOOTER_PORT%
echo.

"%NODE_EXE%" --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js en esta maquina.
  echo.
  echo Este paquete debe incluir el runtime portable en:
  echo node\node.exe
  echo.
  echo En la maquina de preparacion ejecute build-portable.cmd y copie la carpeta:
  echo dist\FSM-Penales-Portable
  echo.
  echo En esa carpeta final NO se requiere instalar Node.js.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules\ws\package.json" (
  echo Dependencias no encontradas. Instalando con npm...
  call npm.cmd install --omit=dev
  if errorlevel 1 (
    echo.
    echo [ERROR] No fue posible instalar dependencias.
    echo Verifique conexion a internet o lleve la carpeta node_modules ya preparada.
    pause
    exit /b 1
  )
  echo.
)

rem JhonJara Modificacion
echo Liberando puertos de presentacion si estan ocupados...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(%GOALKEEPER_PORT%, %SHOOTER_PORT%); $processIds = $ports | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue } | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($processId in $processIds) { if ($processId -and $processId -ne $PID) { $process = Get-Process -Id $processId -ErrorAction SilentlyContinue; Write-Host ('Cerrando puerto usado por PID ' + $processId + ' ' + $process.ProcessName); Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue } }"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 1"
echo Puertos listos.
echo.
rem Fin de Modificacion

echo Abriendo navegadores para la sustentacion...
start "" "http://localhost:%GOALKEEPER_PORT%"
start "" "http://localhost:%SHOOTER_PORT%"
echo.
echo Servidor iniciado. No cierre esta ventana durante la presentacion.
echo Entregue estos links a los otros equipos de la misma red:
echo Portero FSM: http://%LAN_IP%:%GOALKEEPER_PORT%
echo Pateador FSM: http://%LAN_IP%:%SHOOTER_PORT%
echo Para detener: Ctrl+C y luego S.
echo.
"%NODE_EXE%" server.js
echo.
echo El servidor se detuvo.
pause
rem Codigo Anterior Modificado:
rem @echo off
rem cd /d "%~dp0"
rem rem JhonJara Modificacion
rem echo Portero FSM: http://localhost:5000
rem echo Pateador FSM: http://localhost:5001
rem rem Fin de Modificacion
rem node server.js
rem Fin de Modificacion
