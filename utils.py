# utils.py
# Utilidades compartidas entre servidor y cliente

import socket

# ─── Constantes del juego ────────────────────────────────────────────────────

HOST_SERVER   = "0.0.0.0"   # El servidor escucha en todas las interfaces
PORT          = 5000
FILAS         = ['A', 'B', 'C', 'D']
COLUMNAS      = [str(i) for i in range(1, 9)]  # '1'..'8'
MAX_TIROS     = 5
POSICIONES_PORTERO = 12

# Mensajes especiales de prueba
MENSAJES_PRUEBA = {'AA', 'BB', 'CC'}

# Códigos de respuesta del protocolo
COD_TAPO     = "200:TAPO"
COD_OK       = "201:OK"
COD_GOL      = "202:GOL"
COD_INVALIDO = "404:INVALIDO"
COD_REPETIDO = "409:REPETIDO"

# ─── Funciones de validación ─────────────────────────────────────────────────

def es_coordenada_valida(coord: str) -> bool:
    """
    Devuelve True si la coordenada tiene el formato correcto: letra A-D + dígito 1-8.
    Ejemplos válidos: A1, B5, D8
    Ejemplos inválidos: X9, D12, AA, 1A
    """
    coord = coord.strip().upper()
    if len(coord) != 2:
        return False
    fila, col = coord[0], coord[1]
    return fila in FILAS and col in COLUMNAS

def normalizar_coordenada(coord: str) -> str:
    return coord.strip().upper()

def todas_las_coordenadas() -> list:
    """Devuelve lista con las 32 coordenadas posibles."""
    return [f"{f}{c}" for f in FILAS for c in COLUMNAS]

# ─── IP local ────────────────────────────────────────────────────────────────

def obtener_ip_local() -> str:
    """Obtiene la IP local de la máquina en la red LAN."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# ─── Colores Tkinter ─────────────────────────────────────────────────────────

COLOR_BG         = "#0d1117"   # fondo principal (negro azulado)
COLOR_PANEL      = "#161b22"   # fondo de paneles
COLOR_ACENTO     = "#00e5ff"   # cian brillante
COLOR_VERDE      = "#39d353"   # posición protegida
COLOR_ROJO       = "#f85149"   # gol
COLOR_AZUL       = "#58a6ff"   # tapada
COLOR_GRIS       = "#30363d"   # celda vacía
COLOR_TEXTO      = "#e6edf3"   # texto principal
COLOR_TEXTO_SEC  = "#8b949e"   # texto secundario
COLOR_BORDE      = "#21262d"   # bordes
COLOR_AMARILLO   = "#d29922"   # advertencia
COLOR_BTN_HOVER  = "#1f6feb"   # hover de botones
