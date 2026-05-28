# server.py
# ============================================================
# FSM PENALES — SERVIDOR (Portero)
# Escucha conexiones TCP, procesa tiros y mantiene el estado FSM
# ============================================================

import random
import socket
import threading
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import time

from fsm import FSMPortero
from utils import (
    HOST_SERVER, PORT, FILAS, COLUMNAS,
    MAX_TIROS, POSICIONES_PORTERO, MENSAJES_PRUEBA,
    COD_TAPO, COD_OK, COD_GOL, COD_INVALIDO, COD_REPETIDO,
    es_coordenada_valida, normalizar_coordenada, todas_las_coordenadas,
    obtener_ip_local,
    COLOR_BG, COLOR_PANEL, COLOR_ACENTO, COLOR_VERDE, COLOR_ROJO,
    COLOR_AZUL, COLOR_GRIS, COLOR_TEXTO, COLOR_TEXTO_SEC,
    COLOR_BORDE, COLOR_AMARILLO, COLOR_BTN_HOVER
)

# ─── Estado global del servidor ──────────────────────────────────────────────

fsm             = FSMPortero()
posiciones_portero: set   = set()   # 12 posiciones protegidas
tiros_recibidos: list     = []      # coordenadas ya recibidas
servidor_socket           = None
cliente_conectado         = None
juego_activo              = False
configurando              = True    # True mientras se eligen posiciones

# Referencias a widgets (se asignan en build_gui)
root            = None
btn_celdas      = {}   # {coordenada: tk.Button}
lbl_estado      = None
lbl_goles       = None
lbl_tapadas     = None
lbl_tiros       = None
log_widget      = None
lbl_conexion    = None
lbl_ip          = None
btn_iniciar     = None
btn_aleatorio   = None
btn_reiniciar   = None
lbl_conteo_pos  = None

# ─── Funciones de lógica del servidor ────────────────────────────────────────

def validar_coordenada(coord: str) -> bool:
    """Verifica si la coordenada es válida según las reglas del juego."""
    return es_coordenada_valida(coord)

def procesar_tiro(coord: str) -> str:
    """
    Procesa un tiro recibido del cliente.
    Retorna el código de respuesta del protocolo.
    """
    global tiros_recibidos, juego_activo

    coord = normalizar_coordenada(coord)

    # ── Mensajes de prueba especiales ──
    if coord in MENSAJES_PRUEBA:
        registrar_log(f"[TEST] Mensaje de prueba recibido: {coord}")
        return COD_OK

    # ── Validar formato ──
    if not validar_coordenada(coord):
        registrar_log(f"[INVALIDO] Coordenada inválida: {coord}")
        actualizar_estado_fsm('INVALIDO')
        return COD_INVALIDO

    # ── Verificar repetición ──
    if coord in tiros_recibidos:
        registrar_log(f"[REPETIDO] Tiro repetido en: {coord}")
        actualizar_estado_fsm('REPETIDO')
        return COD_REPETIDO

    # ── Registrar tiro ──
    tiros_recibidos.append(coord)

    # ── Evaluar resultado ──
    if coord in posiciones_portero:
        registrar_log(f"[TAPADA] El portero tapó: {coord}")
        actualizar_estado_fsm('TAPO')
        actualizar_celda_gui(coord, 'tapo')
        return COD_TAPO
    else:
        registrar_log(f"[GOL] ¡Gol en: {coord}!")
        actualizar_estado_fsm('GOL')
        actualizar_celda_gui(coord, 'gol')
        return COD_GOL

def actualizar_estado_fsm(evento: str):
    """Aplica la transición FSM y actualiza la GUI."""
    nuevo = fsm.transicion(evento)
    root.after(0, _refrescar_panel_estado)

    if fsm.es_estado_final():
        root.after(200, lambda: mostrar_popup_derrota())

def _refrescar_panel_estado():
    """Actualiza los labels del panel de estado (ejecutado en hilo GUI)."""
    lbl_estado.config(text=f"{fsm.estado_actual}  —  {fsm.descripcion_estado()}")
    lbl_goles.config(text=str(fsm.goles))
    lbl_tapadas.config(text=str(fsm.tapadas))
    lbl_tiros.config(text=str(len(tiros_recibidos)))

def mostrar_popup_derrota():
    messagebox.showwarning(
        "¡DERROTA!",
        f"El portero llegó al estado {fsm.ESTADO_FINAL}.\n"
        f"Goles recibidos: {fsm.goles}\n"
        f"Tapadas: {fsm.tapadas}",
        parent=root
    )

def seleccionar_posiciones_aleatorias():
    """Selecciona al azar las posiciones protegidas del portero."""
    if not configurando:
        return

    posiciones = set(random.sample(todas_las_coordenadas(), POSICIONES_PORTERO))
    posiciones_portero.clear()
    posiciones_portero.update(posiciones)

    for coord, btn in btn_celdas.items():
        if coord in posiciones_portero:
            btn.config(bg=COLOR_VERDE, fg='white')
        else:
            btn.config(bg=COLOR_GRIS, fg=COLOR_TEXTO_SEC)

    lbl_conteo_pos.config(
        text=f"Posiciones seleccionadas: {len(posiciones_portero)} / {POSICIONES_PORTERO}"
    )


def habilitar_reiniciar():
    if btn_reiniciar:
        btn_reiniciar.config(state='normal')


def reiniciar_juego():
    """Reinicia el servidor para empezar un nuevo partido de penaltis."""
    global juego_activo, configurando, servidor_socket, cliente_conectado
    global tiros_recibidos, posiciones_portero

    juego_activo = False
    configurando = True

    if cliente_conectado:
        try:
            cliente_conectado.close()
        except Exception:
            pass
        cliente_conectado = None

    if servidor_socket:
        try:
            servidor_socket.close()
        except Exception:
            pass
        servidor_socket = None

    tiros_recibidos.clear()
    posiciones_portero.clear()
    fsm.reset()

    for coord, btn in btn_celdas.items():
        btn.config(bg=COLOR_GRIS, fg=COLOR_TEXTO_SEC, state='normal')

    btn_iniciar.config(
        state='normal',
        text=f"▶  INICIAR SERVIDOR  (necesita {POSICIONES_PORTERO} posiciones)"
    )
    if btn_aleatorio:
        btn_aleatorio.config(state='normal')
    if btn_reiniciar:
        btn_reiniciar.config(state='disabled')

    lbl_conteo_pos.config(
        text=f"Posiciones seleccionadas: 0 / {POSICIONES_PORTERO}"
    )
    lbl_conexion.config(text="Sin conexión", fg=COLOR_ROJO)
    _refrescar_panel_estado()
    registrar_log("Servidor reiniciado. Selecciona 12 posiciones y pulsa INICIAR.")


def registrar_log(mensaje: str):
    """Añade una línea al log de eventos (thread-safe)."""
    timestamp = time.strftime("%H:%M:%S")
    linea = f"[{timestamp}] {mensaje}\n"
    root.after(0, lambda: _escribir_log(linea))

def _escribir_log(linea: str):
    log_widget.config(state='normal')
    log_widget.insert(tk.END, linea)
    log_widget.see(tk.END)
    log_widget.config(state='disabled')

# ─── Red — Servidor TCP ───────────────────────────────────────────────────────

def iniciar_servidor():
    """Abre el socket TCP y espera conexiones en un hilo separado."""
    global servidor_socket, juego_activo, configurando

    if len(posiciones_portero) != POSICIONES_PORTERO:
        messagebox.showerror(
            "Error",
            f"Debes seleccionar exactamente {POSICIONES_PORTERO} posiciones para el portero.",
            parent=root
        )
        return

    configurando = False
    juego_activo = True

    # Deshabilitar botones de configuración
    for coord, btn in btn_celdas.items():
        if coord not in posiciones_portero:
            btn.config(state='disabled')

    btn_iniciar.config(state='disabled', text="Servidor activo...")
    if btn_aleatorio:
        btn_aleatorio.config(state='disabled')
    if btn_reiniciar:
        btn_reiniciar.config(state='disabled')
    registrar_log(f"Servidor iniciado en {obtener_ip_local()}:{PORT}")

    hilo = threading.Thread(target=_escuchar_conexiones, daemon=True)
    hilo.start()

def _escuchar_conexiones():
    """Hilo que acepta conexiones entrantes."""
    global servidor_socket, cliente_conectado

    try:
        servidor_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        servidor_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        servidor_socket.bind((HOST_SERVER, PORT))
        servidor_socket.listen(1)

        root.after(0, lambda: lbl_conexion.config(
            text="Esperando cliente...", fg=COLOR_AMARILLO))
        registrar_log("Esperando conexión del pateador...")

        conn, addr = servidor_socket.accept()
        cliente_conectado = conn

        ip_cliente = addr[0]
        root.after(0, lambda: lbl_conexion.config(
            text=f"Conectado: {ip_cliente}", fg=COLOR_VERDE))
        registrar_log(f"¡Pateador conectado desde {ip_cliente}!")

        _manejar_cliente(conn)

    except OSError as e:
        registrar_log(f"Error de red: {e}")

def _manejar_cliente(conn: socket.socket):
    """Hilo que procesa mensajes de un cliente conectado."""
    global juego_activo

    try:
        while juego_activo:
            datos = conn.recv(1024).decode('utf-8').strip()
            if not datos:
                break

            registrar_log(f"← Recibido: '{datos}'")

            respuesta = procesar_tiro(datos)
            conn.sendall((respuesta + "\n").encode('utf-8'))
            registrar_log(f"→ Enviado: '{respuesta}'")

            # Verificar fin de juego
            if len(tiros_recibidos) >= MAX_TIROS or fsm.es_estado_final():
                juego_activo = False
                registrar_log("=== Juego terminado ===")
                root.after(0, habilitar_reiniciar)
                break

    except (ConnectionResetError, BrokenPipeError):
        registrar_log("El cliente se desconectó.")
    finally:
        conn.close()
        root.after(0, lambda: lbl_conexion.config(
            text="Desconectado", fg=COLOR_ROJO))

# ─── GUI ─────────────────────────────────────────────────────────────────────

def actualizar_celda_gui(coord: str, resultado: str):
    """Colorea una celda del tablero según el resultado del tiro."""
    colores = {
        'tapo': COLOR_AZUL,
        'gol':  COLOR_ROJO,
    }
    color = colores.get(resultado, COLOR_GRIS)
    root.after(0, lambda: btn_celdas[coord].config(bg=color, fg='white'))

def mostrar_tablero():
    """Dibuja el tablero 4x8 en el frame indicado."""
    pass  # El tablero se construye en build_gui()

def _toggle_posicion(coord: str):
    """Activa/desactiva una posición del portero al hacer clic."""
    if not configurando:
        return

    if coord in posiciones_portero:
        posiciones_portero.discard(coord)
        btn_celdas[coord].config(bg=COLOR_GRIS, fg=COLOR_TEXTO_SEC)
    else:
        if len(posiciones_portero) >= POSICIONES_PORTERO:
            messagebox.showinfo(
                "Límite alcanzado",
                f"Ya seleccionaste {POSICIONES_PORTERO} posiciones.",
                parent=root
            )
            return
        posiciones_portero.add(coord)
        btn_celdas[coord].config(bg=COLOR_VERDE, fg='white')

    lbl_conteo_pos.config(
        text=f"Posiciones seleccionadas: {len(posiciones_portero)} / {POSICIONES_PORTERO}"
    )

def build_gui():
    """Construye toda la interfaz gráfica del servidor."""
    global root, btn_celdas, lbl_estado, lbl_goles, lbl_tapadas
    global lbl_tiros, log_widget, lbl_conexion, lbl_ip, btn_iniciar, btn_aleatorio, btn_reiniciar, lbl_conteo_pos

    root = tk.Tk()
    root.title("FSM PENALES — SERVIDOR (Portero)")
    root.configure(bg=COLOR_BG)
    root.resizable(True, True)
    root.minsize(820, 640)

    # ── Fuentes ──
    font_title  = ("Courier New", 16, "bold")
    font_header = ("Courier New", 11, "bold")
    font_normal = ("Courier New", 10)
    font_small  = ("Courier New", 9)
    font_big    = ("Courier New", 22, "bold")

    # ══════════════════════════════════════════════════════
    # CABECERA
    # ══════════════════════════════════════════════════════
    header = tk.Frame(root, bg=COLOR_PANEL, pady=10)
    header.pack(fill='x')

    tk.Label(
        header, text="⚽ FSM PENALES — SERVIDOR (PORTERO)",
        font=font_title, fg=COLOR_ACENTO, bg=COLOR_PANEL
    ).pack()

    # Info de red
    ip_local = obtener_ip_local()
    info_frame = tk.Frame(header, bg=COLOR_PANEL)
    info_frame.pack(pady=(4, 0))

    lbl_ip = tk.Label(
        info_frame,
        text=f"IP: {ip_local}   Puerto: {PORT}",
        font=font_small, fg=COLOR_TEXTO_SEC, bg=COLOR_PANEL
    )
    lbl_ip.pack(side='left', padx=20)

    lbl_conexion = tk.Label(
        info_frame,
        text="Sin conexión", font=font_small,
        fg=COLOR_ROJO, bg=COLOR_PANEL
    )
    lbl_conexion.pack(side='left', padx=20)

    # ══════════════════════════════════════════════════════
    # CUERPO PRINCIPAL (tablero | panel derecho)
    # ══════════════════════════════════════════════════════
    body = tk.Frame(root, bg=COLOR_BG)
    body.pack(fill='both', expand=True, padx=12, pady=8)

    body.columnconfigure(0, weight=3)
    body.columnconfigure(1, weight=2)
    body.rowconfigure(0, weight=1)

    # ── Panel izquierdo: tablero ──────────────────────────
    left = tk.Frame(body, bg=COLOR_PANEL, bd=0, relief='flat')
    left.grid(row=0, column=0, sticky='nsew', padx=(0, 6))

    tk.Label(
        left, text="PORTERÍA  ( haz clic para proteger celdas )",
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

    # Filas del tablero
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
                activebackground=COLOR_VERDE,
                relief='flat',
                bd=0,
                cursor='hand2',
                command=lambda c=coord: _toggle_posicion(c)
            )
            btn.grid(row=ri, column=ci + 1, padx=2, pady=2)
            btn_celdas[coord] = btn

    # Contador de posiciones
    lbl_conteo_pos = tk.Label(
        left,
        text=f"Posiciones seleccionadas: 0 / {POSICIONES_PORTERO}",
        font=font_small, fg=COLOR_AMARILLO, bg=COLOR_PANEL, pady=6
    )
    lbl_conteo_pos.pack()

    # Botón iniciar
    btn_iniciar = tk.Button(
        left,
        text=f"▶  INICIAR SERVIDOR  (necesita {POSICIONES_PORTERO} posiciones)",
        font=font_header,
        bg=COLOR_ACENTO, fg=COLOR_BG,
        activebackground=COLOR_BTN_HOVER,
        relief='flat', bd=0, pady=8,
        cursor='hand2',
        command=iniciar_servidor
    )
    btn_iniciar.pack(fill='x', padx=12, pady=(6, 6))

    btn_aleatorio = tk.Button(
        left,
        text="🎲  ALEATORIO",
        font=font_header,
        bg=COLOR_BTN_HOVER, fg=COLOR_BG,
        activebackground=COLOR_ACENTO,
        relief='flat', bd=0, pady=8,
        cursor='hand2',
        command=seleccionar_posiciones_aleatorias
    )
    btn_aleatorio.pack(fill='x', padx=12, pady=(0, 6))

    btn_reiniciar = tk.Button(
        left,
        text="↻  REINICIAR",
        font=font_header,
        bg=COLOR_GRIS, fg=COLOR_TEXTO,
        activebackground=COLOR_BORDE,
        relief='flat', bd=0, pady=8,
        cursor='hand2',
        state='disabled',
        command=reiniciar_juego
    )
    btn_reiniciar.pack(fill='x', padx=12, pady=(0, 12))

    # ── Panel derecho ─────────────────────────────────────
    right = tk.Frame(body, bg=COLOR_PANEL)
    right.grid(row=0, column=1, sticky='nsew')

    # Estado FSM
    fsm_frame = tk.LabelFrame(
        right, text=" ESTADO FSM ",
        font=font_small, fg=COLOR_ACENTO,
        bg=COLOR_PANEL, bd=1, relief='groove', pady=8
    )
    fsm_frame.pack(fill='x', padx=8, pady=(8, 4))

    lbl_estado = tk.Label(
        fsm_frame,
        text=f"{fsm.estado_actual}  —  {fsm.descripcion_estado()}",
        font=font_header, fg=COLOR_TEXTO, bg=COLOR_PANEL, wraplength=240
    )
    lbl_estado.pack()

    # Estadísticas
    stats_frame = tk.LabelFrame(
        right, text=" ESTADÍSTICAS ",
        font=font_small, fg=COLOR_ACENTO,
        bg=COLOR_PANEL, bd=1, relief='groove', pady=8
    )
    stats_frame.pack(fill='x', padx=8, pady=4)

    def stat_row(parent, label, var_lbl, color):
        f = tk.Frame(parent, bg=COLOR_PANEL)
        f.pack(fill='x', padx=8, pady=2)
        tk.Label(f, text=label, font=font_normal,
                 fg=COLOR_TEXTO_SEC, bg=COLOR_PANEL, width=14, anchor='w').pack(side='left')
        lbl = tk.Label(f, text="0", font=font_big, fg=color, bg=COLOR_PANEL)
        lbl.pack(side='right')
        return lbl

    lbl_goles   = stat_row(stats_frame, "Goles:",   None, COLOR_ROJO)
    lbl_tapadas = stat_row(stats_frame, "Tapadas:", None, COLOR_AZUL)
    lbl_tiros   = stat_row(stats_frame, "Tiros:",   None, COLOR_ACENTO)

    # Leyenda
    leyenda_frame = tk.LabelFrame(
        right, text=" LEYENDA ",
        font=font_small, fg=COLOR_ACENTO,
        bg=COLOR_PANEL, bd=1, relief='groove', pady=6
    )
    leyenda_frame.pack(fill='x', padx=8, pady=4)

    leyenda_items = [
        (COLOR_GRIS,  "Vacío"),
        (COLOR_VERDE, "Protegido"),
        (COLOR_AZUL,  "Tapada"),
        (COLOR_ROJO,  "Gol"),
    ]
    for color, nombre in leyenda_items:
        f = tk.Frame(leyenda_frame, bg=COLOR_PANEL)
        f.pack(anchor='w', padx=8, pady=1)
        tk.Label(f, bg=color, width=3, relief='flat').pack(side='left', padx=(0, 6))
        tk.Label(f, text=nombre, font=font_small,
                 fg=COLOR_TEXTO, bg=COLOR_PANEL).pack(side='left')

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

    registrar_log("Servidor listo. Selecciona 12 posiciones y pulsa INICIAR.")

    root.protocol("WM_DELETE_WINDOW", _on_close)
    return root

def _on_close():
    global juego_activo
    juego_activo = False
    if servidor_socket:
        try:
            servidor_socket.close()
        except Exception:
            pass
    root.destroy()

# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = build_gui()
    app.mainloop()
