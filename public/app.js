const ROWS = ["A", "B", "C", "D"];
const COLS = ["1", "2", "3", "4", "5", "6", "7", "8"];

const state = {
  bootstrap: {
    defaultSession: "penales-demo",
    port: 5000,
    role: "goalkeeper",
    ports: {
      goalkeeper: 5000,
      shooter: 5001,
    },
    addresses: [],
  },
  goalkeeper: {
    ws: null,
    connected: false,
    draftCoverage: new Set(),
    dirty: false,
    snapshot: createEmptySnapshot("penales-demo"),
  },
  shooter: {
    ws: null,
    connected: false,
    snapshot: createEmptySnapshot("penales-demo"),
    lastResponse: "Última respuesta: sin actividad todavía.",
    // JhonJara Modificacion
    pendingInput: "",
    // Fin de Modificacion
  },
};

const elements = {
  serverHost: document.querySelector("#server-host"),
  serverIps: document.querySelector("#server-ips"),
  defaultSession: document.querySelector("#default-session"),
  // JhonJara Modificacion
  activeRole: document.querySelector("#active-role"),
  rolePorts: document.querySelector("#role-ports"),
  rivalHost: document.querySelector("#rival-host"),
  rivalPort: document.querySelector("#rival-port"),
  // Fin de Modificacion
  goalkeeperTeam: document.querySelector("#goalkeeper-team"),
  goalkeeperSession: document.querySelector("#goalkeeper-session"),
  goalkeeperConnect: document.querySelector("#goalkeeper-connect"),
  goalkeeperConnection: document.querySelector("#goalkeeper-connection"),
  goalkeeperBoard: document.querySelector("#goalkeeper-board"),
  goalkeeperCount: document.querySelector("#goalkeeper-count"),
  goalkeeperConfigure: document.querySelector("#goalkeeper-configure"),
  goalkeeperClear: document.querySelector("#goalkeeper-clear"),
  goalkeeperReset: document.querySelector("#goalkeeper-reset"),
  goalkeeperTeamLive: document.querySelector("#goalkeeper-team-live"),
  goalkeeperState: document.querySelector("#goalkeeper-state"),
  goalkeeperProgress: document.querySelector("#goalkeeper-progress"),
  goalkeeperGoals: document.querySelector("#goalkeeper-goals"),
  goalkeeperSaves: document.querySelector("#goalkeeper-saves"),
  goalkeeperShots: document.querySelector("#goalkeeper-shots"),
  goalkeeperTerminal: document.querySelector("#goalkeeper-terminal"),
  goalkeeperLog: document.querySelector("#goalkeeper-log"),
  shooterSession: document.querySelector("#shooter-session"),
  shooterInput: document.querySelector("#shooter-input"),
  shooterConnect: document.querySelector("#shooter-connect"),
  shooterConnection: document.querySelector("#shooter-connection"),
  shooterResponse: document.querySelector("#shooter-response"),
  shooterSend: document.querySelector("#shooter-send"),
  shooterBoard: document.querySelector("#shooter-board"),
  shooterShotCount: document.querySelector("#shooter-shot-count"),
  shooterGoalCount: document.querySelector("#shooter-goal-count"),
  shooterState: document.querySelector("#shooter-state"),
  shooterProgress: document.querySelector("#shooter-progress"),
  shooterGoals: document.querySelector("#shooter-goals"),
  shooterSaves: document.querySelector("#shooter-saves"),
  shooterSessionLive: document.querySelector("#shooter-session-live"),
  shooterTerminal: document.querySelector("#shooter-terminal"),
  shooterHistory: document.querySelector("#shooter-history"),
  // JhonJara Modificacion
  resultIcon: document.querySelector("#result-icon"),
  gameOverOverlay: document.querySelector("#game-over-overlay"),
  gameOverIcon: document.querySelector("#game-over-icon"),
  gameOverTitle: document.querySelector("#game-over-title"),
  gameOverReason: document.querySelector("#game-over-reason"),
  gameOverStats: document.querySelector("#game-over-stats"),
  gameOverClose: document.querySelector("#game-over-close"),
  // Fin de Modificacion
};

function createEmptySnapshot(sessionId) {
  return {
    sessionId,
    teamId: "-",
    coverage: [],
    coverageCount: 0,
    processedShots: 0,
    remainingShots: 5,
    goals: 0,
    saves: 0,
    gameOver: false,
    currentState: "q0",
    progressState: "q0",
    terminalReason: "",
    readyToPlay: false,
    shotLimit: 5,
    goalLimit: 3,
    goalkeeperBoard: makeBlankBoard(),
    shooterBoard: makeBlankBoard(),
    shotHistory: [],
    log: [],
  };
}

function makeBlankBoard() {
  return ROWS.map((row) => ({
    row,
    cells: COLS.map((col) => ({
      coord: `${row}${col}`,
      mark: "~",
    })),
  }));
}

function normalizeSessionId(value) {
  return String(value || state.bootstrap.defaultSession)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .slice(0, 30) || state.bootstrap.defaultSession;
}

function updateBadge(element, connected) {
  element.textContent = connected ? "Conectado" : "Desconectado";
  element.classList.toggle("is-live", connected);
}

// JhonJara Modificacion
function parseSocketTarget(rawHost, rawPort) {
  const fallbackPort = Number(rawPort || state.bootstrap.rivalPort || 5000) || 5000;
  const cleanedHost = String(rawHost || state.bootstrap.rivalHost || "localhost")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^wss?:\/\//i, "")
    .replace(/\/.*$/, "");

  const parts = cleanedHost.split(":");
  const host = (parts[0] || "localhost").trim();
  const port = Number(parts[1] || fallbackPort) || fallbackPort;

  return { host, port, target: `${host}:${port}` };
}

function getSocketTarget(role) {
  if (role === "shooter") {
    const parsed = parseSocketTarget(elements.rivalHost?.value, elements.rivalPort?.value);

    if (elements.rivalHost) {
      elements.rivalHost.value = parsed.host;
    }

    if (elements.rivalPort) {
      elements.rivalPort.value = String(parsed.port);
    }

    return parsed.target;
  }

  return `${window.location.hostname || "localhost"}:${state.bootstrap.port}`;
}

function makeSocket(role, onMessage, onOpen, onClose) {
// Codigo Anterior Modificado: function makeSocket(onMessage, onOpen, onClose) {
// Fin de Modificacion
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  // JhonJara Modificacion
  const wsHost = getSocketTarget(role);
  let socket = null;

  try {
    socket = new WebSocket(`${protocol}://${wsHost}/ws`);
  } catch {
    if (role === "shooter") {
      state.shooter.lastResponse = `IP o puerto inválido: ${wsHost}. Usa formato 10.2.12.129 y puerto 5000.`;
      renderShooterResponse();
    }

    return null;
  }
  // Codigo Anterior Modificado: const socket = new WebSocket(`${protocol}://${window.location.hostname || "localhost"}:${state.bootstrap.port}/ws`);
  // Fin de Modificacion

  socket.addEventListener("open", onOpen);
  socket.addEventListener("message", (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // JhonJara Modificacion
      if (role === "shooter" && isSimpleProtocolResponse(event.data)) {
        handleSimpleShooterResponse(event.data);
      } else {
        onMessage({ type: "alert", level: "warning", message: event.data });
      }
      // Codigo Anterior Modificado: onMessage({ type: "alert", level: "warning", message: event.data });
      // Fin de Modificacion
    }
  });
  socket.addEventListener("close", onClose);
  // JhonJara Modificacion
  socket.addEventListener("error", () => {
    if (role === "shooter") {
      state.shooter.lastResponse = `No fue posible conectar con ${wsHost}. Verifica IP, puerto y firewall.`;
      renderShooterResponse();
    }
  });
  // Fin de Modificacion

  return socket;
}

function sendThrough(socket, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(JSON.stringify(payload));
  return true;
}

// JhonJara Modificacion
function sendPlainThrough(socket, message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(message);
  return true;
}
// Fin de Modificacion

function connectGoalkeeper() {
  const sessionId = normalizeSessionId(elements.goalkeeperSession.value);
  elements.goalkeeperSession.value = sessionId;

  if (state.goalkeeper.ws) {
    state.goalkeeper.ws.close();
  }

  const socket = makeSocket(
    "goalkeeper",
    handleGoalkeeperMessage,
    () => {
      if (state.goalkeeper.ws !== socket) {
        return;
      }

      state.goalkeeper.connected = true;
      updateBadge(elements.goalkeeperConnection, true);
      sendThrough(socket, {
        type: "register",
        role: "goalkeeper",
        sessionId,
      });
    },
    () => {
      if (state.goalkeeper.ws !== socket) {
        return;
      }

      state.goalkeeper.connected = false;
      updateBadge(elements.goalkeeperConnection, false);
    },
  );
  state.goalkeeper.ws = socket;
}

function connectShooter() {
  const sessionId = normalizeSessionId(elements.shooterSession.value);
  elements.shooterSession.value = sessionId;

  if (state.shooter.ws) {
    state.shooter.ws.close();
  }

  const target = getSocketTarget("shooter");
  state.shooter.connected = false;
  updateBadge(elements.shooterConnection, false);
  state.shooter.lastResponse = `Intentando conectar con Portero FSM rival en ws://${target}/ws ...`;
  renderShooterResponse();

  const socket = makeSocket(
    "shooter",
    handleShooterMessage,
    () => {
      if (state.shooter.ws !== socket) {
        return;
      }

      state.shooter.connected = true;
      updateBadge(elements.shooterConnection, true);
      state.shooter.snapshot = createEmptySnapshot(sessionId);
      state.shooter.snapshot.coverageCount = 12;
      state.shooter.snapshot.currentState = "q1";
      state.shooter.snapshot.progressState = "q1";
      state.shooter.lastResponse = `Conectado al Portero FSM rival en ${target}.`;
      renderShooter();
      renderShooterResponse();
      // JhonJara Modificacion
      // El cliente de ataque usa el protocolo simple de la rubrica contra apps externas.
      // Codigo Anterior Modificado:
      // sendThrough(socket, {
      //   type: "register",
      //   role: "shooter",
      //   sessionId,
      // });
      // Fin de Modificacion
    },
    () => {
      if (state.shooter.ws !== socket) {
        return;
      }

      const wasConnected = state.shooter.connected;
      state.shooter.connected = false;
      updateBadge(elements.shooterConnection, false);

      if (wasConnected) {
        state.shooter.lastResponse = `Desconectado del Portero FSM rival (${target}).`;
        renderShooterResponse();
      } else if (state.shooter.lastResponse.startsWith("Intentando conectar")) {
        state.shooter.lastResponse = `No fue posible conectar con ${target}. Verifica IP, puerto, firewall y que el rival use WebSocket en /ws.`;
        renderShooterResponse();
      }
    },
  );

  if (!socket) {
    return;
  }

  const timeoutId = window.setTimeout(() => {
    if (state.shooter.ws === socket && socket.readyState !== WebSocket.OPEN) {
      socket.close();
      state.shooter.connected = false;
      updateBadge(elements.shooterConnection, false);
      state.shooter.lastResponse = `No hubo respuesta de ${target}. Verifica que el Portero rival este encendido, que use WebSocket en /ws y que el firewall permita el puerto.`;
      renderShooterResponse();
    }
  }, 5000);

  socket.addEventListener("open", () => window.clearTimeout(timeoutId), { once: true });
  socket.addEventListener("error", () => window.clearTimeout(timeoutId), { once: true });

  state.shooter.ws = socket;
}

function handleGoalkeeperMessage(message) {
  if (message.type === "sessionSnapshot") {
    state.goalkeeper.snapshot = message.snapshot;

    if (!state.goalkeeper.dirty) {
      state.goalkeeper.draftCoverage = new Set(message.snapshot.coverage);
    }

    renderGoalkeeper();
    return;
  }

  if (message.type === "alert") {
    state.shooter.lastResponse = message.message;
    renderShooterResponse();
  }
}

function handleShooterMessage(message) {
  if (message.type === "sessionSnapshot") {
    state.shooter.snapshot = message.snapshot;
    renderShooter();
    return;
  }

  if (message.type === "shotResult") {
    const response = message.response;
    state.shooter.lastResponse = `Última respuesta: ${response.code}:${response.label}${
      response.input ? ` para ${response.input}` : ""
    }${response.detail ? ` - ${response.detail}` : ""}`;

    if (response.snapshot) {
      state.shooter.snapshot = response.snapshot;
      renderShooter();
    }

    renderShooterResponse(response.label);
    return;
  }

  if (message.type === "alert") {
    state.shooter.lastResponse = message.message;
    renderShooterResponse();
  }
}

// JhonJara Modificacion
function isValidCoordinate(value) {
  const input = String(value || "").trim().toUpperCase();
  return ROWS.includes(input.charAt(0)) && COLS.includes(input.slice(1));
}

function isSimpleProtocolResponse(value) {
  return /^\d{3}:[A-Z_]+$/.test(String(value || "").trim().toUpperCase());
}

function updateSimpleShooterState(snapshot) {
  if (snapshot.goals <= 0) {
    snapshot.progressState = "q1";
  } else if (snapshot.goals === 1) {
    snapshot.progressState = "q2";
  } else if (snapshot.goals === 2) {
    snapshot.progressState = "q3";
  } else {
    snapshot.progressState = "q4";
  }

  if (snapshot.goals >= snapshot.goalLimit) {
    snapshot.gameOver = true;
    snapshot.terminalReason = "El pateador alcanzó 3 goles.";
  } else if (snapshot.processedShots >= snapshot.shotLimit) {
    snapshot.gameOver = true;
    snapshot.terminalReason = "Se completaron los 5 tiros válidos.";
  }

  snapshot.currentState = snapshot.gameOver ? "q5" : snapshot.progressState;
}

function markSimpleShooterBoard(snapshot, input, mark) {
  snapshot.shooterBoard = snapshot.shooterBoard.map((row) => ({
    row: row.row,
    cells: row.cells.map((cell) => (
      cell.coord === input ? { ...cell, mark } : cell
    )),
  }));
}

function handleSimpleShooterResponse(rawResponse) {
  const responseText = String(rawResponse || "").trim().toUpperCase();
  const [codeText, label] = responseText.split(":");
  const code = Number(codeText);
  const input = state.shooter.pendingInput;
  const snapshot = state.shooter.snapshot;

  state.shooter.lastResponse = `Última respuesta: ${responseText}${input ? ` para ${input}` : ""}`;

  if ((code === 200 || code === 202) && isValidCoordinate(input)) {
    const mark = code === 200 ? "T" : "G";

    markSimpleShooterBoard(snapshot, input, mark);
    snapshot.processedShots += 1;
    snapshot.remainingShots = Math.max(0, snapshot.shotLimit - snapshot.processedShots);

    if (code === 200) {
      snapshot.saves += 1;
    } else {
      snapshot.goals += 1;
    }

    snapshot.shotHistory.push({
      turn: snapshot.processedShots,
      input,
      result: responseText,
    });
    snapshot.shotHistory = snapshot.shotHistory.slice(-10);
    updateSimpleShooterState(snapshot);
  }

  if (code === 412) {
    snapshot.coverageCount = 0;
    snapshot.currentState = "q0";
    snapshot.progressState = "q0";
  } else {
    snapshot.coverageCount = 12;
  }

  state.shooter.pendingInput = "";
  renderShooter();
  renderShooterResponse(label);
}
// Fin de Modificacion

function boardLookup(board) {
  const map = new Map();

  for (const row of board) {
    for (const cell of row.cells) {
      map.set(cell.coord, cell.mark);
    }
  }

  return map;
}

function renderBoard(container, board, options = {}) {
  const { interactive = false, onSelect = null } = options;
  container.innerHTML = "";

  const corner = document.createElement("div");
  corner.className = "board-corner";
  container.appendChild(corner);

  for (const col of COLS) {
    const header = document.createElement("div");
    header.className = "board-axis";
    header.textContent = col;
    container.appendChild(header);
  }

  for (const row of board) {
    const rowLabel = document.createElement("div");
    rowLabel.className = "board-axis";
    rowLabel.textContent = row.row;
    container.appendChild(rowLabel);

    for (const cell of row.cells) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "board-cell";
      element.dataset.mark = cell.mark;
      // JhonJara Modificacion
      element.textContent = markToIcon(cell.mark);
      element.title = cell.coord;
      // Codigo Anterior Modificado: element.textContent = cell.mark;
      // Fin de Modificacion

      if (interactive && onSelect) {
        element.classList.add("is-interactive");
        element.addEventListener("click", () => onSelect(cell.coord));
      } else {
        element.disabled = true;
      }

      container.appendChild(element);
    }
  }
}

// JhonJara Modificacion
function markToIcon(mark) {
  if (mark === "P") {
    return "🧤";
  }

  if (mark === "G") {
    return "⚡";
  }

  if (mark === "T") {
    return "🛡";
  }

  return "";
}
// Fin de Modificacion

function renderGoalkeeper() {
  const snapshot = state.goalkeeper.snapshot;
  const marks = boardLookup(snapshot.goalkeeperBoard);
  const draftBoard = ROWS.map((row) => ({
    row,
    cells: COLS.map((col) => {
      const coord = `${row}${col}`;
      const mark = marks.get(coord);

      if (mark === "G" || mark === "T") {
        return { coord, mark };
      }

      return {
        coord,
        mark: state.goalkeeper.draftCoverage.has(coord) ? "P" : "~",
      };
    }),
  }));

  renderBoard(elements.goalkeeperBoard, draftBoard, {
    interactive: true,
    onSelect: toggleGoalkeeperCell,
  });

  elements.goalkeeperCount.textContent = `${state.goalkeeper.draftCoverage.size} / 12`;
  // JhonJara Modificacion
  elements.goalkeeperCount.style.setProperty(
    "--coverage-progress",
    `${Math.min(100, (state.goalkeeper.draftCoverage.size / 12) * 100)}%`,
  );
  // Fin de Modificacion
  elements.goalkeeperTeamLive.textContent = snapshot.teamId || "-";
  elements.goalkeeperState.textContent = snapshot.currentState;
  elements.goalkeeperProgress.textContent = snapshot.progressState;
  elements.goalkeeperGoals.textContent = String(snapshot.goals);
  elements.goalkeeperSaves.textContent = String(snapshot.saves);
  elements.goalkeeperShots.textContent = `${snapshot.processedShots} / ${snapshot.shotLimit}`;
  elements.goalkeeperTerminal.textContent =
    snapshot.coverageCount !== 12
      ? "Sin configurar"
      : snapshot.gameOver
        ? `q5 - ${snapshot.terminalReason}`
        : "En juego";

  // JhonJara Modificacion
  updateFsmDiagram("gk", snapshot.currentState);
  if (snapshot.gameOver) {
    showGameOverModal(snapshot);
  } else {
    hideGameOverModal();
  }
  // Fin de Modificacion

  renderList(
    elements.goalkeeperLog,
    snapshot.log,
    (item) => ({
      prefix: item.time,
      text: item.message,
    }),
  );
}

function renderShooter() {
  const snapshot = state.shooter.snapshot;

  renderBoard(elements.shooterBoard, snapshot.shooterBoard, {
    interactive: true,
    onSelect: (coord) => {
      elements.shooterInput.value = coord;
      sendShot(coord);
    },
  });

  elements.shooterShotCount.textContent = `${snapshot.processedShots} / ${snapshot.shotLimit}`;
  elements.shooterGoalCount.textContent = `${snapshot.goals} / ${snapshot.goalLimit} goles`;
  elements.shooterState.textContent = snapshot.currentState;
  elements.shooterProgress.textContent = snapshot.progressState;
  elements.shooterGoals.textContent = String(snapshot.goals);
  elements.shooterSaves.textContent = String(snapshot.saves);
  elements.shooterSessionLive.textContent = snapshot.sessionId;
  elements.shooterTerminal.textContent =
    snapshot.coverageCount !== 12
      ? "Esperando portero"
      : snapshot.gameOver
        ? `q5 - ${snapshot.terminalReason}`
        : "En juego";

  // JhonJara Modificacion
  updateFsmDiagram("sh", snapshot.currentState);
  if (snapshot.gameOver) {
    showGameOverModal(snapshot);
  } else {
    hideGameOverModal();
  }
  // Fin de Modificacion

  renderList(
    elements.shooterHistory,
    snapshot.shotHistory,
    (item) => ({
      prefix: `#${item.turn}`,
      text: `${item.input} -> ${item.result}`,
    }),
  );
}

function renderShooterResponse(kind = "") {
  // JhonJara Modificacion
  const responseText = elements.shooterResponse.querySelector(".result-text");
  const resultIcon = elements.resultIcon || elements.shooterResponse.querySelector(".result-icon");

  if (responseText) {
    responseText.textContent = state.shooter.lastResponse;
  } else {
    elements.shooterResponse.textContent = state.shooter.lastResponse;
  }

  if (resultIcon) {
    resultIcon.textContent = kind === "GOL" ? "⚡ ¡GOL!" : kind === "TAPO" ? "🧤 ¡TAPADA!" : "⚽";
  }
  // Codigo Anterior Modificado: elements.shooterResponse.textContent = state.shooter.lastResponse;
  // Fin de Modificacion
  elements.shooterResponse.classList.remove("is-goal", "is-save");

  if (kind === "GOL") {
    elements.shooterResponse.classList.add("is-goal");
  }

  if (kind === "TAPO") {
    elements.shooterResponse.classList.add("is-save");
  }
}

// JhonJara Modificacion
function updateFsmDiagram(prefix, currentState) {
  const states = ["q0", "q1", "q2", "q3", "q4", "q5"];
  const currentIndex = states.indexOf(currentState);

  for (const stateName of states) {
    const node = document.querySelector(`#${prefix}-node-${stateName}`);
    if (!node) {
      continue;
    }

    const nodeIndex = states.indexOf(stateName);
    node.classList.remove("active", "past");

    if (stateName === currentState) {
      node.classList.add("active");
    } else if (currentIndex > -1 && nodeIndex < currentIndex) {
      node.classList.add("past");
    }
  }
}

function showGameOverModal(snapshot) {
  if (!elements.gameOverOverlay || !snapshot.gameOver) {
    return;
  }

  const shooterWins = snapshot.goals >= snapshot.goalLimit;
  elements.gameOverIcon.textContent = shooterWins ? "⚡" : "🧤";
  elements.gameOverTitle.textContent = shooterWins ? "¡El Pateador Gana!" : "¡El Portero Gana!";
  elements.gameOverReason.textContent = snapshot.terminalReason || "La partida llegó a q5.";
  elements.gameOverStats.innerHTML = "";

  for (const item of [
    { label: "Goles", value: snapshot.goals },
    { label: "Tapadas", value: snapshot.saves },
    { label: "Tiros", value: `${snapshot.processedShots}/${snapshot.shotLimit}` },
  ]) {
    const stat = document.createElement("span");
    stat.innerHTML = `<strong>${item.value}</strong><br>${item.label}`;
    elements.gameOverStats.appendChild(stat);
  }

  elements.gameOverOverlay.hidden = false;
}

function hideGameOverModal() {
  if (elements.gameOverOverlay) {
    elements.gameOverOverlay.hidden = true;
  }
}
// Fin de Modificacion

function renderList(target, items, formatter) {
  target.innerHTML = "";

  if (!items || items.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "Sin registros todavía.";
    target.appendChild(empty);
    return;
  }

  for (const item of items) {
    const data = formatter(item);
    const entry = document.createElement("li");
    // JhonJara Modificacion
    if (item.kind) {
      entry.dataset.kind = item.kind;
    }
    // Fin de Modificacion
    if (data.prefix) {
      const prefix = document.createElement("span");
      prefix.className = "log-time";
      prefix.textContent = data.prefix;
      entry.appendChild(prefix);
    }

    entry.appendChild(document.createTextNode(data.text));
    target.appendChild(entry);
  }
}

function toggleGoalkeeperCell(coord) {
  if (state.goalkeeper.draftCoverage.has(coord)) {
    state.goalkeeper.draftCoverage.delete(coord);
  } else if (state.goalkeeper.draftCoverage.size < 12) {
    state.goalkeeper.draftCoverage.add(coord);
  } else {
    state.shooter.lastResponse = "Ya hay 12 posiciones seleccionadas para el portero.";
    renderShooterResponse();
    return;
  }

  state.goalkeeper.dirty = true;
  renderGoalkeeper();
}

function configureGoalkeeper() {
  if (state.goalkeeper.draftCoverage.size !== 12) {
    state.shooter.lastResponse = "Debes seleccionar exactamente 12 posiciones antes de configurar.";
    renderShooterResponse();
    return;
  }

  const sent = sendThrough(state.goalkeeper.ws, {
    type: "configure",
    teamId: elements.goalkeeperTeam.value.trim(),
    positions: [...state.goalkeeper.draftCoverage],
  });

  if (!sent) {
    state.shooter.lastResponse = "Conecta primero el portero para guardar la estrategia.";
    renderShooterResponse();
    return;
  }

  state.goalkeeper.dirty = false;
}

function resetGoalkeeperRound() {
  // JhonJara Modificacion
  hideGameOverModal();
  // Fin de Modificacion
  const sent = sendThrough(state.goalkeeper.ws, {
    type: "resetRound",
  });

  if (!sent) {
    state.shooter.lastResponse = "Conecta primero el portero para reiniciar la partida.";
    renderShooterResponse();
  }
}

function sendShot(forcedValue = "") {
  const input = String(forcedValue || elements.shooterInput.value || "").trim().toUpperCase();

  if (!input) {
    state.shooter.lastResponse = "Escribe una coordenada o un mensaje de prueba.";
    renderShooterResponse();
    return;
  }

  // JhonJara Modificacion
  if (state.shooter.snapshot.gameOver && isValidCoordinate(input)) {
    state.shooter.lastResponse = "El shootout ya finalizó. Conecta de nuevo para iniciar otra prueba.";
    renderShooterResponse();
    return;
  }

  state.shooter.pendingInput = input;
  const sent = sendPlainThrough(state.shooter.ws, input);
  // Codigo Anterior Modificado:
  // const sent = sendThrough(state.shooter.ws, {
  //   type: "shoot",
  //   input,
  // });
  // Fin de Modificacion

  if (!sent) {
    state.shooter.lastResponse = "Conecta primero el pateador para enviar tiros.";
    renderShooterResponse();
    return;
  }

  elements.shooterInput.value = input;
}

async function loadBootstrap() {
  const response = await fetch("/api/bootstrap");
  state.bootstrap = await response.json();

  // JhonJara Modificacion
  applyRoleMode(state.bootstrap.role);
  elements.serverHost.textContent = `${window.location.hostname || "localhost"}:${state.bootstrap.port}`;
  // Codigo Anterior Modificado: elements.serverHost.textContent = `${window.location.hostname || "localhost"}:${state.bootstrap.port}`;
  // Fin de Modificacion
  elements.serverIps.textContent =
    state.bootstrap.addresses.length > 0 ? state.bootstrap.addresses.join(", ") : "Solo localhost";
  elements.defaultSession.textContent = state.bootstrap.defaultSession;
  elements.goalkeeperSession.value = state.bootstrap.defaultSession;
  elements.shooterSession.value = state.bootstrap.defaultSession;
  // JhonJara Modificacion
  if (elements.rivalHost) {
    elements.rivalHost.value = state.bootstrap.rivalHost || "localhost";
  }

  if (elements.rivalPort) {
    elements.rivalPort.value = String(state.bootstrap.rivalPort || 5000);
  }
  // Fin de Modificacion
}

// JhonJara Modificacion
function applyRoleMode(role) {
  // JhonJara Modificacion
  const normalizedRole = role === "shooter" ? "shooter" : "goalkeeper";
  const roleLabel = normalizedRole === "shooter" ? "Pateador FSM" : "Portero FSM";
  const ports = state.bootstrap.ports || {};

  document.body.dataset.role = normalizedRole;
  document.title = `${roleLabel} - FSM Penales`;
  elements.activeRole.textContent = roleLabel;
  elements.rolePorts.textContent = `Portero ${ports.goalkeeper || 5000} / Pateador ${ports.shooter || 5001}`;
  // Codigo Anterior Modificado: document.body.dataset.role = role === "shooter" ? "shooter" : "goalkeeper";
  // Fin de Modificacion
}
// Fin de Modificacion

function bindEvents() {
  elements.goalkeeperConnect.addEventListener("click", connectGoalkeeper);
  elements.shooterConnect.addEventListener("click", connectShooter);
  elements.goalkeeperConfigure.addEventListener("click", configureGoalkeeper);
  elements.goalkeeperReset.addEventListener("click", resetGoalkeeperRound);
  elements.goalkeeperClear.addEventListener("click", () => {
    state.goalkeeper.draftCoverage.clear();
    state.goalkeeper.dirty = true;
    renderGoalkeeper();
  });
  elements.shooterSend.addEventListener("click", () => sendShot());
  elements.shooterInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendShot();
    }
  });
  // JhonJara Modificacion
  if (elements.gameOverOverlay) {
    elements.gameOverOverlay.addEventListener("click", () => {
      elements.gameOverOverlay.hidden = true;
    });
  }

  if (elements.gameOverClose) {
    elements.gameOverClose.addEventListener("click", (event) => {
      event.stopPropagation();
      hideGameOverModal();
    });
  }
  // Fin de Modificacion
}

async function init() {
  renderGoalkeeper();
  renderShooter();
  renderShooterResponse();
  bindEvents();

  try {
    await loadBootstrap();
  } catch {
    elements.serverHost.textContent = "No disponible";
    elements.serverIps.textContent = "No disponible";
  }
}

init();
