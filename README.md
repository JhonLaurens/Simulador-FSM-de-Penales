# ⚽ FSM PENALES

Sistema de tiros penales de fútbol basado en **Máquinas de Estado Finito (DFA)**,
comunicación **cliente-servidor TCP** e **interfaz gráfica Tkinter**.

---

## 📁 Estructura del proyecto

```
FSM-Penales/
├── server.py   → Servidor (Portero FSM)
├── client.py   → Cliente (Pateador FSM)
├── fsm.py      → Implementación del DFA
├── utils.py    → Constantes y utilidades compartidas
└── README.md   → Este archivo
```

---

## ⚙️ Instalación

Solo necesitas **Python 3** (3.8 o superior). No se requieren librerías externas.

```bash
# Verificar versión de Python
python --version

# Clonar o descargar el proyecto
# Entrar al directorio
cd FSM-Penales
```

---

## 🚀 Cómo ejecutar

### Dispositivo 1 — Servidor (Portero)

```bash
python server.py
```

1. Se abre la ventana del portero.
2. Haz clic en **12 celdas** del tablero 4×8 para elegir las posiciones protegidas.
3. Pulsa **INICIAR SERVIDOR**.
4. La IP local y el puerto se muestran en la cabecera.

### Dispositivo 2 — Cliente (Pateador)

```bash
python client.py
```

1. Se abre la ventana del pateador.
2. Ingresa la **IP del servidor** en el campo de texto.
3. Pulsa **CONECTAR**.
4. Haz clic en cualquier celda del tablero para disparar.

---

## 🌐 Cómo conectar dos dispositivos

Ambos dispositivos deben estar en la **misma red WiFi o LAN**.

### Obtener la IP local

**Windows:**
```cmd
ipconfig
# Busca "Dirección IPv4" bajo tu adaptador WiFi
```

**Linux / macOS:**
```bash
hostname -I
# o
ip addr show
```

**Ejemplo de IP:** `192.168.1.15`

### Verificar conectividad

Desde el Dispositivo 2, haz ping al Dispositivo 1:
```bash
ping 192.168.1.15
```

### Firewall (si no conecta)

**Windows:** Permitir Python en el Firewall de Windows Defender.

**Linux:**
```bash
sudo ufw allow 5000/tcp
```

---

## 🧠 Explicación FSM (Máquina de Estado Finito)

El proyecto implementa un **DFA (Deterministic Finite Automaton)** para el portero.

### Estados

| Estado | Nombre            | Descripción             |
|--------|-------------------|-------------------------|
| q0     | Inicio            | Estado de arranque      |
| q1     | Portería intacta  | 0 goles concedidos      |
| q2     | 1 gol concedido   | —                       |
| q3     | 2 goles concedidos| —                       |
| q4     | 3 goles concedidos| —                       |
| **q5** | **Derrota**       | **Estado final**        |

- **Estado inicial:** q1
- **Estado de aceptación:** q5

### Tabla de transiciones

| Estado actual | GOL | TAPO | OK  | INVALIDO | REPETIDO |
|---------------|-----|------|-----|----------|----------|
| q1            | q2  | q1   | q1  | q1       | q1       |
| q2            | q3  | q2   | q2  | q2       | q2       |
| q3            | q4  | q3   | q3  | q3       | q3       |
| q4            | q5  | q4   | q4  | q4       | q4       |
| q5            | q5  | q5   | q5  | q5       | q5       |

Solo el evento **GOL** produce una transición a un estado diferente.  
El resto de eventos mantienen el estado actual.

### Diagrama de estados

```
        GOL           GOL           GOL           GOL
  q1 ──────► q2 ──────► q3 ──────► q4 ──────► q5 (FINAL)
  ↑↓          ↑↓          ↑↓          ↑↓
TAPO/OK    TAPO/OK    TAPO/OK    TAPO/OK
INVALIDO   INVALIDO   INVALIDO   INVALIDO
REPETIDO   REPETIDO   REPETIDO   REPETIDO
```

---

## 🔌 Explicación Sockets TCP

El proyecto usa **sockets TCP (stream)** de Python estándar.

### Servidor

```python
# Escucha en todas las interfaces de red
servidor = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
servidor.bind(("0.0.0.0", 5000))
servidor.listen(1)
conn, addr = servidor.accept()  # Espera al cliente
```

### Cliente

```python
# Se conecta a la IP del servidor
cliente = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
cliente.connect(("192.168.1.15", 5000))
```

### Envío y recepción

- **Cliente → Servidor:** `"B7\n"` (coordenada + salto de línea)
- **Servidor → Cliente:** `"202:GOL\n"` (código + salto de línea)

La comunicación es **texto plano UTF-8** con `\n` como delimitador.

---

## 📡 Protocolo de comunicación

### Mensajes del cliente → servidor

| Mensaje  | Descripción                    |
|----------|--------------------------------|
| `B7`     | Tiro a la celda B7             |
| `A1`     | Tiro a la celda A1             |
| `AA`     | Mensaje de prueba              |
| `BB`     | Mensaje de prueba              |
| `CC`     | Mensaje de prueba              |

### Respuestas del servidor → cliente

| Código       | Significado                                |
|--------------|--------------------------------------------|
| `200:TAPO`   | La posición estaba protegida (tapada)      |
| `201:OK`     | Mensaje de prueba aceptado                 |
| `202:GOL`    | La posición no estaba protegida (¡gol!)   |
| `404:INVALIDO` | Coordenada fuera del rango A1–D8        |
| `409:REPETIDO` | Esa coordenada ya fue enviada antes     |

### Portería — coordenadas válidas

```
     1    2    3    4    5    6    7    8
A → A1   A2   A3   A4   A5   A6   A7   A8
B → B1   B2   B3   B4   B5   B6   B7   B8
C → C1   C2   C3   C4   C5   C6   C7   C8
D → D1   D2   D3   D4   D5   D6   D7   D8
```

Total: **32 posiciones**. El portero protege **12** de ellas.

---

## 🎮 Reglas del juego

- El pateador tiene **5 tiros**.
- El portero protege **12 de las 32 celdas**.
- Si el pateador dispara a una celda protegida → **TAPO** (el estado FSM no cambia).
- Si el pateador dispara a una celda libre → **GOL** (el estado FSM avanza).
- El juego termina cuando:
  - Se agotan los 5 tiros, o
  - El portero recibe 4 goles y llega al estado **q5 (Derrota)**.

---

## 🖥️ Interfaz gráfica

### Servidor (server.py)
- Tablero 4×8 para seleccionar posiciones del portero.
- Panel con estado FSM actual, goles recibidos, tapadas y tiros procesados.
- Log de eventos en tiempo real.
- IP local y puerto visibles.

### Cliente (client.py)
- Tablero 4×8 con botones clicables para disparar.
- Resultado del último tiro con colores.
- Contador de tiros restantes.
- Input manual para coordenadas.
- Log de eventos en tiempo real.

### Colores del tablero

| Color  | Significado             |
|--------|-------------------------|
| Gris   | Celda sin actividad     |
| Verde  | Posición protegida / Gol|
| Azul   | Tapada                  |
| Rojo   | Gol (en el servidor)    |

---

## 🧪 Pruebas rápidas

### Mensajes de prueba

```
Cliente envía: AA  →  Servidor responde: 201:OK
Cliente envía: BB  →  Servidor responde: 201:OK
Cliente envía: CC  →  Servidor responde: 201:OK
```

### Coordenadas inválidas

```
Cliente envía: X9   →  Servidor responde: 404:INVALIDO
Cliente envía: D12  →  Servidor responde: 404:INVALIDO
Cliente envía: 1A   →  Servidor responde: 404:INVALIDO
```

---

## 📋 Requisitos técnicos

- Python 3.8+
- Módulos estándar: `tkinter`, `socket`, `threading`, `time`, `os`
- Sin dependencias externas

---

## 👥 Flujo de demostración

```
Dispositivo 1                    Dispositivo 2
─────────────                    ─────────────
$ python3 server.py              $ python3 client.py

[Selecciona 12 celdas]           [Ingresa IP del servidor]
[Clic en INICIAR]                [Clic en CONECTAR]
                                 [Clic en celda B7]
← Recibe: "B7"
  Evalúa: ¿B7 protegida?
  Responde: "202:GOL"           → Muestra: ⚽ ¡GOL!
  FSM: q1 → q2                    Tiros: 4 restantes
```

---

*FSM PENALES · DFA Deterministic Finite Automaton · TCP Sockets · Tkinter*
