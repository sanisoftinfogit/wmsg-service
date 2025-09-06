// const makeWASocket = require("@whiskeysockets/baileys").default;
// const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
// const qrcode = require("qrcode");
// const fs = require("fs");
// const path = require("path");

// let sessions = {};
// let pendingQRCodes = {};

// async function startSock(sessionId) {
//   const sessionPath = path.join(__dirname, "sessions", sessionId);
//   const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
//   const { version } = await fetchLatestBaileysVersion();

//   const sock = makeWASocket({
//     version,
//     auth: state,
//     browser: ["Chrome (Linux)", "Chrome", "121.0.6167.85"],
//     syncFullHistory: false,
//     printQRInTerminal: true // debug
//   });

//   sock.ev.on("connection.update", async (update) => {
//     const { qr, connection, lastDisconnect } = update;

//     if (qr) {
//       const qrDataUrl = await qrcode.toDataURL(qr);
//       pendingQRCodes[sessionId] = qrDataUrl;
//       console.log(`📌 [${sessionId}] QR generated`);
//     }

//     if (connection === "open") {
//       console.log(`✅ [${sessionId}] Connected`);
//       delete pendingQRCodes[sessionId];
//     }

//     if (connection === "close") {
//       const reason = lastDisconnect?.error?.output?.statusCode;
//       console.log(`❌ [${sessionId}] Disconnected:`, reason);
//       if (reason !== DisconnectReason.loggedOut) {
//         startSock(sessionId);
//       }
//     }
//   });

//   sock.ev.on("creds.update", saveCreds);
//   sessions[sessionId] = sock;
// }

// module.exports = { startSock, sessions, pendingQRCodes };



const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const fs = require("fs");
const path = require("path");

let sessions = {};
let pendingQRCodes = {};

async function startSock(sessionId) {
  const sessionPath = path.join(__dirname, "sessions", sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    browser: ["Chrome (Linux)", "Chrome", "121.0.6167.85"],
    syncFullHistory: false,
    printQRInTerminal: true
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
        startSock(sessionId); // auto reconnect
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
  sessions[sessionId] = sock;
  return sock;
}

// ✅ Backend restart झाल्यावर जुने sessions re-load करा
function loadExistingSessions() {
  const basePath = path.join(__dirname, "sessions");
  if (!fs.existsSync(basePath)) return;

  const sessionDirs = fs.readdirSync(basePath);
  sessionDirs.forEach((dir) => {
    console.log(`🔄 Reloading session: ${dir}`);
    startSock(dir);
  });
}

module.exports = { startSock, sessions, pendingQRCodes, loadExistingSessions };
