# fsm.py
# Máquina de Estado Finito (DFA) para el portero

class FSMPortero:
    """
    DFA - Deterministic Finite Automaton para el portero.

    Estados:
        q0 = Inicio (estado de arranque, se mueve a q1 al conectar)
        q1 = Portería intacta (0 goles)
        q2 = 1 gol concedido
        q3 = 2 goles concedidos
        q4 = 3 goles concedidos
        q5 = Derrota (estado final)

    Transiciones:
        GOL    → avanza al siguiente estado
        TAPO   → no cambia
        OK     → no cambia
        INVALIDO → no cambia
        REPETIDO → no cambia
    """

    # Definición de estados
    ESTADOS = {
        'q0': 'Inicio',
        'q1': 'Portería intacta',
        'q2': '1 gol concedido',
        'q3': '2 goles concedidos',
        'q4': '3 goles concedidos',
        'q5': 'Derrota'
    }

    # Tabla de transiciones: {estado_actual: {evento: estado_siguiente}}
    TRANSICIONES = {
        'q0': {'GOL': 'q0', 'TAPO': 'q0', 'OK': 'q1', 'INVALIDO': 'q0', 'REPETIDO': 'q0'},
        'q1': {'GOL': 'q2', 'TAPO': 'q1', 'OK': 'q1', 'INVALIDO': 'q1', 'REPETIDO': 'q1'},
        'q2': {'GOL': 'q3', 'TAPO': 'q2', 'OK': 'q2', 'INVALIDO': 'q2', 'REPETIDO': 'q2'},
        'q3': {'GOL': 'q4', 'TAPO': 'q3', 'OK': 'q3', 'INVALIDO': 'q3', 'REPETIDO': 'q3'},
        'q4': {'GOL': 'q5', 'TAPO': 'q4', 'OK': 'q4', 'INVALIDO': 'q4', 'REPETIDO': 'q4'},
        'q5': {'GOL': 'q5', 'TAPO': 'q5', 'OK': 'q5', 'INVALIDO': 'q5', 'REPETIDO': 'q5'},
    }

    ESTADO_INICIAL = 'q1'
    ESTADO_FINAL   = 'q5'

    def __init__(self):
        self.estado_actual = self.ESTADO_INICIAL
        self.goles = 0
        self.tapadas = 0
        self.historial = []  # lista de (evento, estado_antes, estado_despues)

    def transicion(self, evento: str) -> str:
        """
        Aplica una transición dado un evento.
        Retorna el nuevo estado.
        """
        evento = evento.upper()
        estado_antes = self.estado_actual

        if evento not in ('GOL', 'TAPO', 'OK', 'INVALIDO', 'REPETIDO'):
            return self.estado_actual  # evento desconocido, sin cambio

        nuevo_estado = self.TRANSICIONES[self.estado_actual].get(evento, self.estado_actual)
        self.estado_actual = nuevo_estado

        # Contadores
        if evento == 'GOL':
            self.goles += 1
        elif evento == 'TAPO':
            self.tapadas += 1

        self.historial.append((evento, estado_antes, nuevo_estado))
        return nuevo_estado

    def es_estado_final(self) -> bool:
        return self.estado_actual == self.ESTADO_FINAL

    def descripcion_estado(self) -> str:
        return self.ESTADOS.get(self.estado_actual, 'Desconocido')

    def reset(self):
        self.estado_actual = self.ESTADO_INICIAL
        self.goles = 0
        self.tapadas = 0
        self.historial = []
