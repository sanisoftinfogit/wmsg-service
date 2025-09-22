



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
//     printQRInTerminal: true
//   });

//   let qrGenerated = false; // flag

// sock.ev.on("connection.update", async (update) => {
//   const { qr, connection, lastDisconnect } = update;

//   if (qr && !qrGenerated) {
//   qrGenerated = true;
//   const qrDataUrl = await qrcode.toDataURL(qr);
//   pendingQRCodes[sessionId] = qrDataUrl;
//   console.log(`📌 [${sessionId}] QR generated (valid for 20s)`);

//   // ⏳ Expire QR after 20 sec
//   setTimeout(() => {
//     if (pendingQRCodes[sessionId]) {
//       delete pendingQRCodes[sessionId];
//       console.log(`⌛ [${sessionId}] QR expired (20s over)`);

//       // 🗑️ Delete session also on expiry
//       delete sessions[sessionId];
//       const sessionPath = path.join(__dirname, "sessions", sessionId);
//       if (fs.existsSync(sessionPath)) {
//         fs.rmSync(sessionPath, { recursive: true, force: true });
//         console.log(`🗑 [${sessionId}] Session folder deleted (QR expired)`);
//       }
//     }
//   }, 30000);
// }


//   if (connection === "open") {
//     console.log(`✅ [${sessionId}] Connected`);
//     delete pendingQRCodes[sessionId];
//   }

//   if (connection === "close") {
//   const statusCode = lastDisconnect?.error?.output?.statusCode;

//   if (statusCode === DisconnectReason.loggedOut) {
//     // Already deleting session folder
//     console.log(`🛑 [${sessionId}] Logged out → deleting folder`);
//     delete sessions[sessionId];
//     delete pendingQRCodes[sessionId];
//     const sessionPath = path.join(__dirname, "sessions", sessionId);
//     if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
//   } else {
//     // Only reconnect if session folder still exists
//     const sessionPath = path.join(__dirname, "sessions", sessionId);
//     if (fs.existsSync(sessionPath)) {
//       console.log(`🔄 [${sessionId}] Reconnecting...`);
//       qrGenerated = false;
//       startSock(sessionId);
//     } else {
//       console.log(`❌ [${sessionId}] Session folder missing → not reconnecting`);
//     }
//   }
// }

// });



//   sock.ev.on("creds.update", saveCreds);
//   sessions[sessionId] = sock;
//   return sock;
// }


// // function loadExistingSessions() {
// //   const basePath = path.join(__dirname, "sessions");
// //   if (!fs.existsSync(basePath)) return;

// //   const sessionDirs = fs.readdirSync(basePath);
// //   sessionDirs.forEach((dir) => {
// //     console.log(`🔄 Reloading session: ${dir}`);
// //     startSock(dir);
// //   });
// // }


// function loadExistingSessions() {
//   const basePath = path.join(__dirname, "sessions");
//   if (!fs.existsSync(basePath)) return;

//   const sessionDirs = fs.readdirSync(basePath);
//   sessionDirs.forEach((dir) => {
//     const sessionPath = path.join(basePath, dir);

//     // Check folder valid आहे का
//     const files = fs.readdirSync(sessionPath);
//     const hasCreds = files.some(f => f.includes("creds.json"));

//     if (hasCreds) {
//       console.log(`🔄 Reloading session: ${dir}`);
//       startSock(dir);
//     } else {
//       // ❌ Invalid/Disconnected session → delete करा
//       fs.rmSync(sessionPath, { recursive: true, force: true });
//       console.log(`🗑 [${dir}] Old session folder deleted on restart`);
//     }
//   });
// }


// module.exports = { startSock, sessions, pendingQRCodes, loadExistingSessions };




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
    printQRInTerminal: true,
  });

  let qrGenerated = false; // QR generation flag

  sock.ev.on("connection.update", async (update) => {
    const { qr, connection, lastDisconnect } = update;

    // ---------------- QR Handling ----------------
    if (qr && !qrGenerated) {
      qrGenerated = true;
      const qrDataUrl = await qrcode.toDataURL(qr);
      pendingQRCodes[sessionId] = qrDataUrl;
      console.log(`📌 [${sessionId}] QR generated (valid for 20s)`);

      // Only expire QR after 20 sec, DO NOT delete session folder
      setTimeout(() => {
        if (pendingQRCodes[sessionId]) {
          delete pendingQRCodes[sessionId];
          console.log(`⌛ [${sessionId}] QR expired (20s over)`);
        }
      }, 20000);
    }

    // ---------------- Connection Open ----------------
    if (connection === "open") {
      console.log(`✅ [${sessionId}] Connected`);
      delete pendingQRCodes[sessionId];
    }

    // ---------------- Connection Close ----------------
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ [${sessionId}] Disconnected:`, statusCode);

      if (statusCode === DisconnectReason.loggedOut) {
        // Only delete session if explicitly logged out
        console.log(`🛑 [${sessionId}] Logged out → deleting session folder`);
        delete sessions[sessionId];
        delete pendingQRCodes[sessionId];
        if (fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          console.log(`🗑 [${sessionId}] Session folder deleted`);
        }
      } else {
        // Reconnect only if session folder exists
        if (fs.existsSync(sessionPath)) {
          console.log(`🔄 [${sessionId}] Reconnecting...`);
          qrGenerated = false;
          startSock(sessionId);
        } else {
          console.log(`❌ [${sessionId}] Session folder missing → not reconnecting`);
        }
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);
  sessions[sessionId] = sock;
  return sock;
}

// ---------------- Load Existing Sessions ----------------
function loadExistingSessions() {
  const basePath = path.join(__dirname, "sessions");
  if (!fs.existsSync(basePath)) return;

  const sessionDirs = fs.readdirSync(basePath);
  sessionDirs.forEach((dir) => {
    const sessionPath = path.join(basePath, dir);
    const files = fs.readdirSync(sessionPath);
    const hasCreds = files.some(f => f.includes("creds.json"));

    if (hasCreds) {
      console.log(`🔄 Reloading session: ${dir}`);
      startSock(dir);
    } else {
      // Invalid session → delete folder
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`🗑 [${dir}] Old/invalid session folder deleted on restart`);
    }
  });
}

module.exports = { startSock, sessions, pendingQRCodes, loadExistingSessions };
