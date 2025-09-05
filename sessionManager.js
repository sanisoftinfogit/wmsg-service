const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const fs = require("fs");
const path = require("path");

let sessions = {};
let pendingQRCodes = {};

async function startSock(sessionId) {
  const { state, saveCreds } = await useMultiFileAuthState(`session/${sessionId}`);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    browser: ["Chrome (Linux)", "Chrome", "121.0.6167.85"],
    syncFullHistory: false
  });

  sock.ev.on("connection.update", async (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      const qrDataUrl = await qrcode.toDataURL(qr);
      pendingQRCodes[sessionId] = qrDataUrl;
      console.log(`📌 [${sessionId}] QR generated`);
    }

    if (connection === "open") {
      console.log(`✅ [${sessionId}] Connected`);
      delete pendingQRCodes[sessionId];
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ [${sessionId}] Disconnected:`, reason);
      if (reason !== DisconnectReason.loggedOut) {
        startSock(sessionId);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
  sessions[sessionId] = sock;
}

module.exports = { startSock, sessions, pendingQRCodes };
