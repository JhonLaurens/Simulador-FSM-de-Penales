# FSM Penales

Web app sencilla basada en el PDF del taller para simular tiros penales con una Máquina de Estado Finito en un esquema cliente-servidor.

<!-- JhonJara Modificacion -->
## Integrantes

- Juan Pablo Gomez Ramirez - `juangomez311453@correo.itm.edu.co`
- Miguel Angel Garcia Perez - `miguelgarcia323268@correo.itm.edu.co`
- Jhon Dayron Jaramillo Laurens - `jhonjaramillo120326@correo.itm.edu.co`
- Mauricio Agudelo Jiménez - `mauricioagudelo288237@correo.itm.edu.co`
<!-- Fin de Modificacion -->

## Qué incluye

- Servidor Node.js que sirve la interfaz web y mantiene el estado del juego.
- Comunicación por WebSocket para respetar el requisito de sockets.
- Vista de `Portero FSM` para configurar las 12 posiciones del arquero.
- Vista de `Pateador FSM` para enviar tiros, pruebas `AA/BB/CC` y ver respuestas.
- Tablero 4x8 con marcas `P`, `T`, `G` y `~`.

## Cómo ejecutar

```bash
npm install
npm start
```

<!-- JhonJara Modificacion -->
Luego abre cada rol en su puerto:

- Portero FSM: `http://localhost:5000`
- Pateador FSM: `http://localhost:5001`

Puedes cambiar los puertos con variables de entorno:

```powershell
$env:GOALKEEPER_PORT=5100; $env:SHOOTER_PORT=5101; npm start
```

<!-- Codigo Anterior Modificado: Luego abre `http://localhost:5000`. -->
<!-- Fin de Modificacion -->

Si PowerShell bloquea `npm.ps1`, usa alguna de estas alternativas:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' start
```

o directamente:

```powershell
node server.js
```

También puedes ejecutar:

```powershell
.\start.cmd
```

<!-- JhonJara Modificacion -->
## Despliegue portable para la sustentación en salón

La forma recomendada para presentar en cualquier equipo Windows es generar el paquete portable y llevar esa carpeta completa. Ese paquete incluye `node\node.exe`, por lo que la máquina del salón no necesita tener Node.js instalado.

### Preparación antes de clase

En la máquina de preparación, ejecuta:

```cmd
build-portable.cmd
```

El script crea:

```text
dist\FSM-Penales-Portable
```

Copia completa esa carpeta a una USB o al equipo del salón. En la máquina destino solo abre la carpeta y ejecuta `start.cmd` con doble clic.

`start.cmd` realiza estas acciones automáticamente:

- Usa el Node portable incluido en `node\node.exe`.
- Libera automáticamente los puertos si quedaron ocupados por una ejecución anterior.
- Abre `Portero FSM` en `http://localhost:5000`.
- Abre `Pateador FSM` en `http://localhost:5001`.
- Muestra los enlaces de red para usar en dos equipos diferentes.
- Mantiene una ventana de consola abierta para ver el estado del servidor.

### Uso con dos máquinas

Ejecuta `start.cmd` en el equipo anfitrión. En la consola aparecerán enlaces similares a estos:

```text
Portero FSM: http://192.168.1.25:5000
Pateador FSM: http://192.168.1.25:5001
```

Entrega el primer enlace al equipo que usará el rol de portero y el segundo enlace al equipo que usará el rol de pateador. Ambos equipos deben estar conectados a la misma red Wi-Fi o LAN del equipo anfitrión.

Si necesitas usar puertos alternos por restricción del equipo, configúralos antes de ejecutar:

```cmd
set GOALKEEPER_PORT=5100
set SHOOTER_PORT=5101
start.cmd
```

### Requisito importante

No copies archivos sueltos. Debe copiarse completa la carpeta `FSM-Penales-Portable`, incluyendo:

- `node\node.exe`
- `node_modules`
- `public`
- `server.js`
- `start.cmd`
<!-- Fin de Modificacion -->

## Flujo sugerido

1. Conecta el panel `Portero FSM`.
2. Selecciona exactamente 12 casillas y pulsa `Configurar portero`.
3. Conecta el panel `Pateador FSM`.
4. Envía tiros como `A1`, `B7`, `D3` o mensajes de prueba como `AA`.

## Respuestas implementadas

- `200:TAPO`
- `201:OK`
- `202:GOL`
- `404:INVALIDO`
- `409:REPETIDO`

También se usan dos respuestas internas para la web:

- `410:FINALIZADO`
- `412:NO_LISTO`

## Nota sobre `q4` y `q5`

El PDF mezcla dos ideas:

- `q4` como estado de `3 goles`.
- `q5` como estado terminal de derrota.

Para mantener ambos conceptos, esta implementación usa:

- `q1..q4` como progreso del marcador del portero.
- `q5` como estado terminal cuando la partida termina por 3 goles o por completar los 5 tiros válidos.

## Suposiciones prácticas

- Solo los tiros válidos consumen uno de los 5 intentos.
- Los mensajes `201:OK`, `404:INVALIDO` y `409:REPETIDO` no avanzan el conteo del shootout.
