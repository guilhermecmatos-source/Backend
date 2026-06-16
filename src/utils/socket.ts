import { Server as SocketServer } from "socket.io";
import http from "http";

let io: SocketServer | null = null;

export function initSocket(server: http.Server) {
  io = new SocketServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log(`[socket] Cliente conectado: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`[socket] Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

export function getIo() {
  return io;
}

export function emitTelemetryAlert(alert: any) {
  if (io) {
    io.emit("telemetry_alert", alert);
    console.log(`[socket] Alerta de telemetria emitido via WebSocket: ${alert.title || alert.id}`);
  } else {
    console.warn("[socket] Tentativa de emitir alerta, mas o Socket.io não foi inicializado.");
  }
}
