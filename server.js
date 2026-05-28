const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { WebSocketServer, WebSocket } = require("ws");

// JhonJara Modificacion
const ROLE_PORTS = {
  goalkeeper: Number(process.env.GOALKEEPER_PORT || process.env.PORT || 5000),
  shooter: Number(process.env.SHOOTER_PORT || 5001),
};
// Codigo Anterior Modificado: const PORT = Number(process.env.PORT || 5000);
// Fin de Modificacion
const PUBLIC_DIR = path.join(__dirname, "public");
const ROWS = ["A", "B", "C", "D"];
const COLS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const SHOT_LIMIT = 5;
const GOAL_LIMIT = 3;
const DEFAULT_SESSION = "penales-demo";
// JhonJara Modificacion
const APP_ROLE = normalizeAppRole(process.env.FSM_ROLE || process.argv[2] || "both");
// Fin de Modificacion
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const VALID_COORDS = new Set(
  ROWS.flatMap((row) => COLS.map((col) => `${row}${col}`)),
);
const sessions = new Map();

function createSession(sessionId) {
  return {
    id: sessionId,
    teamId: "Equipo FSM",
    coverage: new Set(),
    shots: new Map(),
    shotHistory: [],
    processedShots: 0,
    goals: 0,
    saves: 0,
    gameOver: false,
    progressState: "q0",
    currentState: "q0",
    terminalReason: "",
    log: [],
    goalkeeperSocket: null,
    shooterSockets: new Set(),
  };
}

function getSession(sessionId = DEFAULT_SESSION) {
  const normalized = normalizeSessionId(sessionId);

  if (!sessions.has(normalized)) {
    sessions.set(normalized, createSession(normalized));
  }

  return sessions.get(normalized);
}

function normalizeSessionId(value) {
  return String(value || DEFAULT_SESSION)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .slice(0, 30) || DEFAULT_SESSION;
}

// JhonJara Modificacion
function normalizeAppRole(value) {
  const role = String(value || "both").trim().toLowerCase();

  if (["portero", "goalkeeper", "defense", "server"].includes(role)) {
    return "goalkeeper";
  }

  if (["pateador", "shooter", "attack", "client"].includes(role)) {
    return "shooter";
  }

  return "both";
}

function getEnabledRoles() {
  if (APP_ROLE === "goalkeeper") {
    return ["goalkeeper"];
  }

  if (APP_ROLE === "shooter") {
    return ["shooter"];
  }

  return ["goalkeeper", "shooter"];
}
// Fin de Modificacion

function normalizeInput(value) {
  return String(value || "").trim().toUpperCase();
}

function isValidCoordinate(value) {
  return VALID_COORDS.has(value);
}

function isHandshakeMessage(value) {
  return /^([A-Z])\1$/i.test(value) && !isValidCoordinate(value);
}

function recordLog(session, kind, message) {
  session.log.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    kind,
    message,
    time: new Date().toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  });
  session.log = session.log.slice(0, 16);
}

function updateStates(session) {
  if (session.coverage.size !== 12) {
    session.progressState = "q0";
    session.currentState = "q0";
    return;
  }

  if (session.goals <= 0) {
    session.progressState = "q1";
  } else if (session.goals === 1) {
    session.progressState = "q2";
  } else if (session.goals === 2) {
    session.progressState = "q3";
  } else {
    session.progressState = "q4";
  }

  session.currentState = session.gameOver ? "q5" : session.progressState;
}

function resetSessionRound(session) {
  session.shots = new Map();
  session.shotHistory = [];
  session.processedShots = 0;
  session.goals = 0;
  session.saves = 0;
  session.gameOver = false;
  session.terminalReason = "";
  updateStates(session);
  recordLog(session, "reset", "Se reinició el shootout manteniendo la estrategia del portero.");
}

function buildBoard(session, revealCoverage) {
  return ROWS.map((row) => ({
    row,
    cells: COLS.map((col) => {
      const coord = `${row}${col}`;
      let mark = "~";

      if (session.shots.has(coord)) {
        mark = session.shots.get(coord) === "200:TAPO" ? "T" : "G";
      } else if (revealCoverage && session.coverage.has(coord)) {
        mark = "P";
      }

      return { coord, mark };
    }),
  }));
}

function buildSnapshot(session) {
  return {
    sessionId: session.id,
    teamId: session.teamId,
    coverage: Array.from(session.coverage),
    coverageCount: session.coverage.size,
    processedShots: session.processedShots,
    remainingShots: Math.max(0, SHOT_LIMIT - session.processedShots),
    goals: session.goals,
    saves: session.saves,
    gameOver: session.gameOver,
    currentState: session.currentState,
    progressState: session.progressState,
    terminalReason: session.terminalReason,
    readyToPlay: session.coverage.size === 12 && !session.gameOver,
    shotLimit: SHOT_LIMIT,
    goalLimit: GOAL_LIMIT,
    goalkeeperBoard: buildBoard(session, true),
    shooterBoard: buildBoard(session, false),
    shotHistory: session.shotHistory.slice(-10),
    log: session.log,
  };
}

function sendMessage(socket, payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

// JhonJara Modificacion
function sendPlainMessage(socket, message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(message);
  }
}
// Fin de Modificacion

function sendSnapshot(session) {
  const payload = {
    type: "sessionSnapshot",
    snapshot: buildSnapshot(session),
  };

  sendMessage(session.goalkeeperSocket, payload);

  for (const socket of session.shooterSockets) {
    sendMessage(socket, payload);
  }
}

function detachSocket(socket) {
  if (!socket.meta) {
    return;
  }

  const session = sessions.get(socket.meta.sessionId);
  if (!session) {
    return;
  }

  if (socket.meta.role === "goalkeeper" && session.goalkeeperSocket === socket) {
    session.goalkeeperSocket = null;
    recordLog(session, "network", "El portero se desconectó.");
    sendSnapshot(session);
    return;
  }

  if (socket.meta.role === "shooter") {
    session.shooterSockets.delete(socket);
    recordLog(session, "network", "Un pateador se desconectó.");
    sendSnapshot(session);
  }
}

function attachSocket(session, role, socket) {
  socket.meta = { role, sessionId: session.id };

  if (role === "goalkeeper") {
    if (session.goalkeeperSocket && session.goalkeeperSocket !== socket) {
      sendMessage(session.goalkeeperSocket, {
        type: "alert",
        level: "warning",
        message: "Otra consola tomó el control del portero para esta sesión.",
      });
      session.goalkeeperSocket.close();
    }

    session.goalkeeperSocket = socket;
    recordLog(session, "network", "Portero conectado.");
  } else {
    session.shooterSockets.add(socket);
    recordLog(session, "network", "Pateador conectado.");
  }

  sendSnapshot(session);
}

function processShot(session, rawInput) {
  const input = normalizeInput(rawInput);

  if (!input) {
    return {
      code: 400,
      label: "VACIO",
      detail: "Ingrese una coordenada o un mensaje de prueba.",
    };
  }

  if (isHandshakeMessage(input)) {
    recordLog(session, "test", `Prueba de comunicación recibida: ${input} -> 201:OK`);
    return {
      code: 201,
      label: "OK",
      input,
      detail: "Prueba de comunicación correcta.",
    };
  }

  if (!isValidCoordinate(input)) {
    recordLog(session, "error", `Entrada inválida: ${input} -> 404:INVALIDO`);
    return {
      code: 404,
      label: "INVALIDO",
      input,
      detail: "La coordenada no existe en la portería 4x8.",
    };
  }

  if (session.coverage.size !== 12) {
    return {
      code: 412,
      label: "NO_LISTO",
      input,
      detail: "Primero configure exactamente 12 posiciones del portero.",
    };
  }

  if (session.gameOver) {
    return {
      code: 410,
      label: "FINALIZADO",
      input,
      detail: "La partida ya terminó. Reinicie el shootout para volver a jugar.",
    };
  }

  if (session.shots.has(input)) {
    recordLog(session, "error", `Tiro repetido: ${input} -> 409:REPETIDO`);
    return {
      code: 409,
      label: "REPETIDO",
      input,
      detail: "Esa coordenada ya fue usada anteriormente.",
    };
  }

  const saved = session.coverage.has(input);
  const result = saved ? "200:TAPO" : "202:GOL";
  session.shots.set(input, result);
  session.processedShots += 1;

  if (saved) {
    session.saves += 1;
  } else {
    session.goals += 1;
  }

  if (session.goals >= GOAL_LIMIT) {
    session.gameOver = true;
    session.terminalReason = "El pateador alcanzó 3 goles.";
  } else if (session.processedShots >= SHOT_LIMIT) {
    session.gameOver = true;
    session.terminalReason = "Se completaron los 5 tiros válidos.";
  }

  updateStates(session);
  session.shotHistory.push({
    turn: session.processedShots,
    input,
    result,
  });

  recordLog(
    session,
    saved ? "save" : "goal",
    `Tiro ${session.processedShots}: ${input} -> ${result} | Estado ${session.currentState}`,
  );

  return {
    code: saved ? 200 : 202,
    label: saved ? "TAPO" : "GOL",
    input,
    detail: saved ? "El portero cubría esa posición." : "La pelota entró al arco.",
    snapshot: buildSnapshot(session),
  };
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function handleGoalkeeperMessage(socket, payload) {
  const session = sessions.get(socket.meta?.sessionId || DEFAULT_SESSION);
  if (!session) {
    return;
  }

  if (payload.type === "configure") {
    const teamId = String(payload.teamId || "Equipo FSM").trim().slice(0, 40) || "Equipo FSM";
    const positions = Array.isArray(payload.positions)
      ? payload.positions.map(normalizeInput)
      : [];
    const unique = [...new Set(positions)].filter((coord) => isValidCoordinate(coord));

    if (unique.length !== 12) {
      sendMessage(socket, {
        type: "alert",
        level: "error",
        message: "Debes seleccionar exactamente 12 posiciones válidas para el portero.",
      });
      return;
    }

    session.teamId = teamId;
    session.coverage = new Set(unique);
    session.shots = new Map();
    session.shotHistory = [];
    session.processedShots = 0;
    session.goals = 0;
    session.saves = 0;
    session.gameOver = false;
    session.terminalReason = "";
    updateStates(session);
    recordLog(session, "setup", `Estrategia del portero configurada por ${teamId}.`);
    sendSnapshot(session);
    return;
  }

  if (payload.type === "resetRound") {
    if (session.coverage.size !== 12) {
      sendMessage(socket, {
        type: "alert",
        level: "warning",
        message: "Configura primero la estrategia antes de reiniciar la partida.",
      });
      return;
    }

    resetSessionRound(session);
    sendSnapshot(session);
  }
}

function handleShooterMessage(socket, payload) {
  const session = sessions.get(socket.meta?.sessionId || DEFAULT_SESSION);
  if (!session) {
    return;
  }

  if (payload.type !== "shoot") {
    return;
  }

  const response = processShot(session, payload.input);
  sendMessage(socket, {
    type: "shotResult",
    response,
  });
  sendSnapshot(session);
}

// JhonJara Modificacion
function handleSimpleProtocolMessage(socket, text) {
  const session = getSession(socket.meta?.sessionId || DEFAULT_SESSION);
  const response = processShot(session, text);

  sendPlainMessage(socket, `${response.code}:${response.label}`);
  sendSnapshot(session);
}
// Fin de Modificacion

// JhonJara Modificacion
function getBootstrapData(role, port) {
// Codigo Anterior Modificado: function getBootstrapData() {
// Fin de Modificacion
  const addresses = [];
  const interfaces = os.networkInterfaces();

  for (const group of Object.values(interfaces)) {
    for (const detail of group || []) {
      if (detail.family === "IPv4" && !detail.internal) {
        addresses.push(detail.address);
      }
    }
  }

  return {
    defaultSession: DEFAULT_SESSION,
    // JhonJara Modificacion
    role,
    port,
    ports: ROLE_PORTS,
    appRole: APP_ROLE,
    rivalHost: process.env.RIVAL_HOST || "localhost",
    rivalPort: Number(process.env.RIVAL_PORT || ROLE_PORTS.goalkeeper),
    // Codigo Anterior Modificado: port: PORT,
    // Fin de Modificacion
    addresses: [...new Set(addresses)],
  };
}

function serveStaticFile(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let relativePath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;

  if (relativePath === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Acceso denegado");
    return;
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      res.writeHead(404);
      res.end("No encontrado");
      return;
    }

    const extension = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    });
    res.end(file);
  });
}

// JhonJara Modificacion
function createRoleServer(role, port) {
  return http.createServer((req, res) => {
// Codigo Anterior Modificado: const server = http.createServer((req, res) => {
// Fin de Modificacion
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (requestUrl.pathname === "/api/bootstrap") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    // JhonJara Modificacion
    res.end(JSON.stringify(getBootstrapData(role, port)));
    // Codigo Anterior Modificado: res.end(JSON.stringify(getBootstrapData()));
    // Fin de Modificacion
    return;
  }

  serveStaticFile(req, res);
});
// JhonJara Modificacion
}
// Fin de Modificacion

// JhonJara Modificacion
const wss = new WebSocketServer({ noServer: true });
// Codigo Anterior Modificado: const wss = new WebSocketServer({ server, path: "/ws" });
// Fin de Modificacion

wss.on("connection", (socket) => {
  // JhonJara Modificacion
  // The first response must be the FSM code when another team's simple client sends raw text.
  // Codigo Anterior Modificado:
  // sendMessage(socket, {
  //   type: "hello",
  //   message: "Conexión WebSocket lista.",
  // });
  // Fin de Modificacion

  socket.on("message", (raw) => {
    const text = raw.toString();
    const payload = safeParseJson(text);

    if (!payload) {
      // JhonJara Modificacion
      handleSimpleProtocolMessage(socket, text);
      // Codigo Anterior Modificado:
      // if (socket.meta?.role === "shooter") {
      //   handleShooterMessage(socket, { type: "shoot", input: text });
      // }
      // Fin de Modificacion
      return;
    }

    if (payload.type === "register") {
      const session = getSession(payload.sessionId);
      const role = payload.role === "goalkeeper" ? "goalkeeper" : "shooter";
      attachSocket(session, role, socket);
      return;
    }

    if (socket.meta?.role === "goalkeeper") {
      handleGoalkeeperMessage(socket, payload);
      return;
    }

    if (socket.meta?.role === "shooter") {
      handleShooterMessage(socket, payload);
    }
  });

  socket.on("close", () => {
    detachSocket(socket);
  });
});

// JhonJara Modificacion
function attachWebSocketUpgrade(server) {
  server.on("upgrade", (req, socket, head) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (requestUrl.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });
}

const enabledRoles = getEnabledRoles();
const enabledPorts = enabledRoles.map((role) => ROLE_PORTS[role]);
const uniquePorts = new Set(enabledPorts);
if (uniquePorts.size !== enabledPorts.length) {
  console.error("GOALKEEPER_PORT y SHOOTER_PORT deben ser diferentes.");
  process.exit(1);
}

for (const role of enabledRoles) {
  const port = ROLE_PORTS[role];
  const roleServer = createRoleServer(role, port);
  if (role === "goalkeeper" || APP_ROLE === "both") {
    attachWebSocketUpgrade(roleServer);
  }

  // JhonJara Modificacion
  roleServer.on("error", (error) => {
    const roleName = role === "goalkeeper" ? "Portero FSM" : "Pateador FSM";

    if (error.code === "EADDRINUSE") {
      console.error(`[ERROR] El puerto ${port} de ${roleName} ya esta ocupado.`);
      console.error("Cierre el otro proceso o cambie GOALKEEPER_PORT / SHOOTER_PORT en start.cmd.");
      process.exit(1);
    }

    console.error(`[ERROR] No fue posible iniciar ${roleName}: ${error.message}`);
    process.exit(1);
  });
  // Fin de Modificacion

  roleServer.listen(port, "0.0.0.0", () => {
    const bootstrap = getBootstrapData(role, port);
    const hosts = bootstrap.addresses.length > 0 ? bootstrap.addresses.join(", ") : "localhost";
    const roleName = role === "goalkeeper" ? "Portero FSM" : "Pateador FSM";

    console.log(`${roleName} escuchando en http://localhost:${port}`);
    console.log(`IPs disponibles para ${roleName}: ${hosts}`);
    if (role === "shooter") {
      console.log(`Rival por defecto: ${bootstrap.rivalHost}:${bootstrap.rivalPort}`);
    }
  });
}
/* Codigo Anterior Modificado
server.listen(PORT, "0.0.0.0", () => {
  const bootstrap = getBootstrapData();
  const hosts = bootstrap.addresses.length > 0 ? bootstrap.addresses.join(", ") : "localhost";

  console.log(`FSM Penales escuchando en http://localhost:${PORT}`);
  console.log(`IPs disponibles: ${hosts}`);
});
*/
// Fin de Modificacion
