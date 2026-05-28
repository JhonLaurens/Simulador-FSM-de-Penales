# client.py
# ============================================================
# FSM PENALES — CLIENTE (Pateador)
# Se conecta al servidor por TCP y envía tiros
# ============================================================

import socket
import threading
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import time

from fsm import FSMPortero
from utils import (
    PORT, FILAS, COLUMNAS, MAX_TIROS,
    COD_TAPO, COD_OK, COD_GOL, COD_INVALIDO, COD_REPETIDO,
    es_coordenada_valida, normalizar_coordenada,
    COLOR_BG, COLOR_PANEL, COLOR_ACENTO, COLOR_VERDE, COLOR_ROJO,
    COLOR_AZUL, COLOR_GRIS, COLOR_TEXTO, COLOR_TEXTO_SEC,
    COLOR_BORDE, COLOR_AMARILLO, COLOR_BTN_HOVER
)

# ─── Estado global del cliente ────────────────────────────────────────────────

sock            = None
conectado       = False
tiros_realizados: list = []     # historial de tiros realizados
tiros_restantes = MAX_TIROS
juego_activo    = False

# Referencias a widgets
root            = None
btn_celdas      = {}
lbl_conexion    = None
lbl_tiros_rest  = None
lbl_resultado   = None
log_widget      = None
entry_ip        = None
entry_coord     = None
btn_conectar    = None
btn_disparar    = None
frame_resultado = None

# ─── Red — Cliente TCP ───────────────────────────────────────────────────────

def conectar_servidor():
    """Intenta conectar al servidor TCP."""
    global sock, conectado, juego_activo

    ip = entry_ip.get().strip()
    if not ip:
        messagebox.showerror("Error", "Ingresa la IP del servidor.", parent=root)
        return

    registrar_log(f"Conectando a {ip}:{PORT}...")
    lbl_conexion.config(text="Conectando...", fg=COLOR_AMARILLO)

    def _conectar():
        global sock, conectado, juego_activo
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(10)
            s.connect((ip, PORT))
            s.settimeout(None)
            sock = s
            conectado = True
            juego_activo = True

            root.after(0, _on_conectado)
        except (ConnectionRefusedError, OSError) as e:
            root.after(0, lambda: _on_error_conexion(str(e)))

    threading.Thread(target=_conectar, daemon=True).start()

def _on_conectado():
    lbl_conexion.config(text="✔  Conectado al servidor", fg=COLOR_VERDE)
    btn_conectar.config(state='disabled', text="Conectado")
    btn_disparar.config(state='normal')
    entry_ip.config(state='disabled')
    registrar_log("¡Conexión establecida! Selecciona una celda y dispara.")

def _on_error_conexion(msg: str):
    lbl_conexion.config(text="✘  Error de conexión", fg=COLOR_ROJO)
    registrar_log(f"Error al conectar: {msg}")
    messagebox.showerror("Error de conexión",
                         f"No se pudo conectar al servidor.\n{msg}", parent=root)

def enviar_tiro(coord: str):
    """Envía la coordenada al servidor y procesa la respuesta."""
    global tiros_restantes, juego_activo

    if not conectado:
        messagebox.showwarning("Sin conexión", "Primero conéctate al servidor.", parent=root)
        return

    if not juego_activo:
        messagebox.showinfo("Juego terminado", "El juego ya terminó.", parent=root)
        return

    coord = normalizar_coordenada(coord)
    registrar_log(f"→ Disparando a: {coord}")

    def _enviar():
        global tiros_restantes, juego_activo
        try:
            sock.sendall((coord + "\n").encode('utf-8'))
            respuesta = ""
            while "\n" not in respuesta:
                chunk = sock.recv(1024).decode('utf-8')
                if not chunk:
                    break
                respuesta += chunk
            respuesta = respuesta.strip()

            root.after(0, lambda: mostrar_resultado(coord, respuesta))

        except (BrokenPipeError, ConnectionResetError, OSError) as e:
            root.after(0, lambda: registrar_log(f"Error de red: {e}"))

    threading.Thread(target=_enviar, daemon=True).start()

# ─── Lógica de presentación ──────────────────────────────────────────────────

def mostrar_resultado(coord: str, respuesta: str):
    """Actualiza la GUI con el resultado del tiro."""
    global tiros_restantes, juego_activo

    registrar_log(f"← Respuesta: '{respuesta}'")

    # Determinar resultado visual
    if respuesta == COD_TAPO:
        color   = COLOR_AZUL
        emoji   = "🧤"
        texto   = "¡TAPADA!"
        detalle = "El portero detuvo el tiro"
        actualizar_tablero(coord, 'tapo')
        tiros_restantes -= 1

    elif respuesta == COD_GOL:
        color   = COLOR_VERDE
        emoji   = "⚽"
        texto   = "¡GOL!"
        detalle = "¡El balón entró en la red!"
        actualizar_tablero(coord, 'gol')
        tiros_restantes -= 1

    elif respuesta == COD_OK:
        color   = COLOR_ACENTO
        emoji   = "✔"
        texto   = "OK"
        detalle = "Mensaje de prueba aceptado"

    elif respuesta == COD_INVALIDO:
        color   = COLOR_AMARILLO
        emoji   = "✘"
        texto   = "INVÁLIDO"
        detalle = f"Coordenada '{coord}' no existe"

    elif respuesta == COD_REPETIDO:
        color   = COLOR_AMARILLO
        emoji   = "↩"
        texto   = "REPETIDO"
        detalle = f"Ya disparaste a {coord}"

    else:
        color   = COLOR_TEXTO_SEC
        emoji   = "?"
        texto   = respuesta
        detalle = ""

    # Actualizar panel de resultado
    lbl_resultado.config(
        text=f"{emoji}  {texto}",
        fg=color
    )

    # Actualizar tiros restantes
    lbl_tiros_rest.config(text=str(tiros_restantes))

    # ── Verificar fin de juego ──
    if tiros_restantes <= 0:
        juego_activo = False
        btn_disparar.config(state='disabled')
        registrar_log("=== Agotaste tus tiros ===")
        root.after(300, lambda: messagebox.showinfo(
            "Juego terminado",
            "Has agotado todos tus tiros.",
            parent=root
        ))

def actualizar_tablero(coord: str, resultado: str):
    """Colorea la celda del tablero según el resultado."""
    colores = {
        'gol':  COLOR_VERDE,
        'tapo': COLOR_AZUL,
    }
    color = colores.get(resultado, COLOR_GRIS)
    if coord in btn_celdas:
        btn_celdas[coord].config(bg=color, fg='white', state='disabled')

def registrar_log(mensaje: str):
    """Añade mensaje al log (thread-safe)."""
    timestamp = time.strftime("%H:%M:%S")
    linea = f"[{timestamp}] {mensaje}\n"
    root.after(0, lambda: _escribir_log(linea))

def _escribir_log(linea: str):
    log_widget.config(state='normal')
    log_widget.insert(tk.END, linea)
    log_widget.see(tk.END)
    log_widget.config(state='disabled')

def _on_celda_click(coord: str):
    """Al hacer clic en una celda, dispara directamente a esa coordenada."""
    if not juego_activo or not conectado:
        return
    enviar_tiro(coord)

def _on_disparar_manual():
    """Dispara a la coordenada ingresada manualmente."""
    coord = entry_coord.get().strip()
    if coord:
        enviar_tiro(coord)
        entry_coord.delete(0, tk.END)

# ─── GUI ─────────────────────────────────────────────────────────────────────

def build_gui():
    global root, btn_celdas, lbl_conexion, lbl_tiros_rest, lbl_resultado
    global log_widget, entry_ip, entry_coord, btn_conectar, btn_disparar

    root = tk.Tk()
    root.title("FSM PENALES — CLIENTE (Pateador)")
    root.configure(bg=COLOR_BG)
    root.resizable(True, True)
    root.minsize(820, 640)

    font_title  = ("Courier New", 16, "bold")
    font_header = ("Courier New", 11, "bold")
    font_normal = ("Courier New", 10)
    font_small  = ("Courier New", 9)
    font_big    = ("Courier New", 26, "bold")

    # ══════════════════════════════════════════════════════
    # CABECERA
    # ══════════════════════════════════════════════════════
    header = tk.Frame(root, bg=COLOR_PANEL, pady=10)
    header.pack(fill='x')

    tk.Label(
        header, text="⚽ FSM PENALES — CLIENTE (PATEADOR)",
        font=font_title, fg=COLOR_ACENTO, bg=COLOR_PANEL
    ).pack()

    # Conexión
    conn_frame = tk.Frame(header, bg=COLOR_PANEL)
    conn_frame.pack(pady=(6, 0))

    tk.Label(conn_frame, text="IP servidor:",
             font=font_small, fg=COLOR_TEXTO_SEC, bg=COLOR_PANEL).pack(side='left', padx=(20, 4))

    entry_ip = tk.Entry(
        conn_frame, font=font_normal, width=16,
        bg=COLOR_GRIS, fg=COLOR_TEXTO,
        insertbackground=COLOR_ACENTO,
        relief='flat', bd=4
    )
    entry_ip.insert(0, "192.168.1.")
    entry_ip.pack(side='left', padx=4)

    btn_conectar = tk.Button(
        conn_frame, text="CONECTAR",
        font=font_header, bg=COLOR_ACENTO, fg=COLOR_BG,
        activebackground=COLOR_BTN_HOVER,
        relief='flat', bd=0, padx=12, pady=4,
        cursor='hand2',
        command=conectar_servidor
    )
    btn_conectar.pack(side='left', padx=8)

    lbl_conexion = tk.Label(
        conn_frame,
        text="Sin conexión",
        font=font_small, fg=COLOR_ROJO, bg=COLOR_PANEL
    )
    lbl_conexion.pack(side='left', padx=12)

    # ══════════════════════════════════════════════════════
    # CUERPO
    # ══════════════════════════════════════════════════════
    body = tk.Frame(root, bg=COLOR_BG)
    body.pack(fill='both', expand=True, padx=12, pady=8)
    body.columnconfigure(0, weight=3)
    body.columnconfigure(1, weight=2)
    body.rowconfigure(0, weight=1)

    # ── Panel izquierdo: tablero ──────────────────────────
    left = tk.Frame(body, bg=COLOR_PANEL)
    left.grid(row=0, column=0, sticky='nsew', padx=(0, 6))

    tk.Label(
        left, text="PORTERÍA  ( haz clic en una celda para disparar )",
        font=font_header, fg=COLOR_ACENTO, bg=COLOR_PANEL, pady=8
    ).pack()

    # Encabezado columnas
    col_header = tk.Frame(left, bg=COLOR_PANEL)
    col_header.pack()
    tk.Label(col_header, text="   ", bg=COLOR_PANEL, width=3).grid(row=0, column=0)
    for ci, c in enumerate(COLUMNAS):
        tk.Label(
            col_header, text=c, font=font_header,
            fg=COLOR_TEXTO_SEC, bg=COLOR_PANEL, width=4
        ).grid(row=0, column=ci + 1)

    tablero_frame = tk.Frame(left, bg=COLOR_PANEL)
    tablero_frame.pack(padx=10, pady=4)

    for ri, fila in enumerate(FILAS):
        tk.Label(
            tablero_frame, text=fila, font=font_header,
            fg=COLOR_TEXTO_SEC, bg=COLOR_PANEL, width=3
        ).grid(row=ri, column=0, pady=2)

        for ci, col in enumerate(COLUMNAS):
            coord = f"{fila}{col}"
            btn = tk.Button(
                tablero_frame,
                text=coord,
                font=font_small,
                width=4, height=2,
                bg=COLOR_GRIS,
                fg=COLOR_TEXTO_SEC,
                activebackground=COLOR_ROJO,
                relief='flat',
                bd=0,
                cursor='hand2',
                command=lambda c=coord: _on_celda_click(c)
            )
            btn.grid(row=ri, column=ci + 1, padx=2, pady=2)
            btn_celdas[coord] = btn

    # Input manual de coordenada
    input_frame = tk.Frame(left, bg=COLOR_PANEL)
    input_frame.pack(pady=8)

    tk.Label(input_frame, text="Coordenada manual:",
             font=font_small, fg=COLOR_TEXTO_SEC, bg=COLOR_PANEL).pack(side='left', padx=8)

    entry_coord = tk.Entry(
        input_frame, font=font_normal, width=6,
        bg=COLOR_GRIS, fg=COLOR_TEXTO,
        insertbackground=COLOR_ACENTO,
        relief='flat', bd=4
    )
    entry_coord.pack(side='left', padx=4)
    entry_coord.bind('<Return>', lambda e: _on_disparar_manual())

    btn_disparar = tk.Button(
        input_frame, text="🔫  DISPARAR",
        font=font_header, bg=COLOR_ROJO, fg='white',
        activebackground="#c0392b",
        relief='flat', bd=0, padx=12, pady=6,
        cursor='hand2', state='disabled',
        command=_on_disparar_manual
    )
    btn_disparar.pack(side='left', padx=8)

    # ── Panel derecho ─────────────────────────────────────
    right = tk.Frame(body, bg=COLOR_PANEL)
    right.grid(row=0, column=1, sticky='nsew')

    # Resultado del último tiro
    res_frame = tk.LabelFrame(
        right, text=" ÚLTIMO RESULTADO ",
        font=font_small, fg=COLOR_ACENTO,
        bg=COLOR_PANEL, bd=1, relief='groove', pady=12
    )
    res_frame.pack(fill='x', padx=8, pady=(8, 4))

    lbl_resultado = tk.Label(
        res_frame, text="—",
        font=font_big, fg=COLOR_TEXTO_SEC, bg=COLOR_PANEL
    )
    lbl_resultado.pack()

    # Tiros restantes
    tiros_frame = tk.LabelFrame(
        right, text=" TIROS RESTANTES ",
        font=font_small, fg=COLOR_ACENTO,
        bg=COLOR_PANEL, bd=1, relief='groove', pady=8
    )
    tiros_frame.pack(fill='x', padx=8, pady=4)

    lbl_tiros_rest = tk.Label(
        tiros_frame, text=str(MAX_TIROS),
        font=("Courier New", 36, "bold"),
        fg=COLOR_ACENTO, bg=COLOR_PANEL
    )
    lbl_tiros_rest.pack()

    # Leyenda
    leyenda_frame = tk.LabelFrame(
        right, text=" LEYENDA ",
        font=font_small, fg=COLOR_ACENTO,
        bg=COLOR_PANEL, bd=1, relief='groove', pady=6
    )
    leyenda_frame.pack(fill='x', padx=8, pady=4)

    leyenda_items = [
        (COLOR_GRIS,   "Sin disparar"),
        (COLOR_VERDE,  "¡Gol!"),
        (COLOR_AZUL,   "Tapada"),
    ]
    for color, nombre in leyenda_items:
        f = tk.Frame(leyenda_frame, bg=COLOR_PANEL)
        f.pack(anchor='w', padx=8, pady=1)
        tk.Label(f, bg=color, width=3, relief='flat').pack(side='left', padx=(0, 6))
        tk.Label(f, text=nombre, font=font_small,
                 fg=COLOR_TEXTO, bg=COLOR_PANEL).pack(side='left')

    # Protocolo
    proto_frame = tk.LabelFrame(
        right, text=" PROTOCOLO ",
        font=font_small, fg=COLOR_ACENTO,
        bg=COLOR_PANEL, bd=1, relief='groove', pady=6
    )
    proto_frame.pack(fill='x', padx=8, pady=4)

    protocolos = [
        ("200:TAPO",    COLOR_AZUL),
        ("201:OK",      COLOR_ACENTO),
        ("202:GOL",     COLOR_VERDE),
        ("404:INVALIDO",COLOR_AMARILLO),
        ("409:REPETIDO",COLOR_AMARILLO),
    ]
    for codigo, color in protocolos:
        tk.Label(
            proto_frame, text=codigo,
            font=("Courier New", 8, "bold"),
            fg=color, bg=COLOR_PANEL
        ).pack(anchor='w', padx=8)

    # LOG
    log_frame = tk.LabelFrame(
        right, text=" LOG DE EVENTOS ",
        font=font_small, fg=COLOR_ACENTO,
        bg=COLOR_PANEL, bd=1, relief='groove'
    )
    log_frame.pack(fill='both', expand=True, padx=8, pady=(4, 8))

    log_widget = scrolledtext.ScrolledText(
        log_frame,
        font=("Courier New", 8),
        bg="#0a0e14", fg=COLOR_TEXTO_SEC,
        insertbackground=COLOR_ACENTO,
        state='disabled',
        wrap='word',
        height=10
    )
    log_widget.pack(fill='both', expand=True, padx=4, pady=4)

    # ══════════════════════════════════════════════════════
    # PIE DE PÁGINA
    # ══════════════════════════════════════════════════════
    footer = tk.Frame(root, bg=COLOR_PANEL, pady=4)
    footer.pack(fill='x')
    tk.Label(
        footer,
        text="FSM PENALES  ·  DFA Deterministic Finite Automaton  ·  TCP Sockets",
        font=font_small, fg=COLOR_TEXTO_SEC, bg=COLOR_PANEL
    ).pack()

    registrar_log("Cliente listo. Ingresa la IP del servidor y conecta.")

    root.protocol("WM_DELETE_WINDOW", _on_close)
    return root

def _on_close():
    global conectado
    conectado = False
    if sock:
        try:
            sock.close()
        except Exception:
            pass
    root.destroy()

# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = build_gui()
    app.mainloop()
