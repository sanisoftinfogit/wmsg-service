const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const fs = require("fs");
const path = require("path");

let sessions = {};
let pendingQRCodes = {};
let tempAuthStates = {}; // Store temporary auth states for new sessions

async function startSock(sessionId, isExisting = false) {
  const sessionPath = path.join(__dirname, "sessions", sessionId);
  let state, saveCreds;

  if (isExisting && fs.existsSync(sessionPath)) {
    // Load existing session
    ({ state, saveCreds } = await useMultiFileAuthState(sessionPath));
  } else {
    // For new sessions, create a temporary folder first
    const tempPath = path.join(__dirname, "temp_sessions", sessionId);
    if (!fs.existsSync(path.dirname(tempPath))) {
      fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    }
    ({ state, saveCreds } = await useMultiFileAuthState(tempPath));
    tempAuthStates[sessionId] = { tempPath, saveCreds };
  }
  
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
      console.log(`✅ [${sessionId}] Connected successfully`);
      delete pendingQRCodes[sessionId];
      delete sessions[sessionId + '_retryCount']; // Clear retry counter on successful connection
      
      // ✅ Move from temp to permanent folder on successful login
      if (tempAuthStates[sessionId]) {
        const { tempPath } = tempAuthStates[sessionId];
        
        try {
          // Create permanent session folder
          if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
          }
          
          // Move files from temp to permanent location
          if (fs.existsSync(tempPath)) {
            const files = fs.readdirSync(tempPath);
            files.forEach(file => {
              const tempFile = path.join(tempPath, file);
              const permanentFile = path.join(sessionPath, file);
              fs.copyFileSync(tempFile, permanentFile);
            });
            
            // Clean up temp folder
            fs.rmSync(tempPath, { recursive: true, force: true });
            console.log(`📁 [${sessionId}] Session moved from temp to permanent storage`);
          }
          
          // Reinitialize with permanent auth state
          const { state: newState, saveCreds: newSaveCreds } = await useMultiFileAuthState(sessionPath);
          sock.authState = newState;
          
          // Update the save function
          sock.ev.removeAllListeners("creds.update");
          sock.ev.on("creds.update", newSaveCreds);
          
          delete tempAuthStates[sessionId];
        } catch (moveErr) {
          console.error(`❌ Error moving session files for ${sessionId}:`, moveErr);
        }
      }
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ [${sessionId}] Disconnected:`, reason);
      
      if (reason === DisconnectReason.loggedOut) {
        // ✅ Delete session folder on logout
        if (fs.existsSync(sessionPath)) {
          try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`🗑️ [${sessionId}] Session folder deleted after logout`);
          } catch (deleteErr) {
            console.error(`❌ Error deleting session folder ${sessionId}:`, deleteErr);
          }
        }
        
        // Clean up temp folder if exists
        if (tempAuthStates[sessionId]) {
          const { tempPath } = tempAuthStates[sessionId];
          if (fs.existsSync(tempPath)) {
            fs.rmSync(tempPath, { recursive: true, force: true });
          }
          delete tempAuthStates[sessionId];
        }
        
        // Clean up from memory
        delete sessions[sessionId];
        delete pendingQRCodes[sessionId];
        console.log(`🧹 [${sessionId}] Session cleaned up from memory`);
      } else if (reason === DisconnectReason.restartRequired || reason === 515) {
        // Handle restart required (after QR scan)
        console.log(`🔄 [${sessionId}] Restart required after QR scan, reconnecting...`);
        setTimeout(() => {
          if (tempAuthStates[sessionId] || fs.existsSync(sessionPath)) {
            startSock(sessionId, fs.existsSync(sessionPath));
          }
        }, 2000); // Wait 2 seconds before restart
      } else if (fs.existsSync(sessionPath)) {
        // Auto reconnect for established sessions with other disconnect reasons
        console.log(`🔄 [${sessionId}] Attempting to reconnect established session...`);
        setTimeout(() => startSock(sessionId, true), 5000);
      } else if (tempAuthStates[sessionId] && (reason === DisconnectReason.connectionReplaced || reason === DisconnectReason.connectionClosed)) {
        // For new sessions that are still trying to connect, retry a few times
        if (!sessions[sessionId + '_retryCount']) {
          sessions[sessionId + '_retryCount'] = 1;
        } else {
          sessions[sessionId + '_retryCount']++;
        }
        
        if (sessions[sessionId + '_retryCount'] <= 3) {
          console.log(`🔄 [${sessionId}] Retry attempt ${sessions[sessionId + '_retryCount']}/3...`);
          setTimeout(() => startSock(sessionId, false), 3000);
        } else {
          console.log(`❌ [${sessionId}] Max retries reached, cleaning up failed session`);
          // Clean up after max retries
          if (tempAuthStates[sessionId]) {
            const { tempPath } = tempAuthStates[sessionId];
            if (fs.existsSync(tempPath)) {
              fs.rmSync(tempPath, { recursive: true, force: true });
            }
            delete tempAuthStates[sessionId];
          }
          delete sessions[sessionId];
          delete sessions[sessionId + '_retryCount'];
          delete pendingQRCodes[sessionId];
          console.log(`🧹 [${sessionId}] Failed new session cleaned up after retries`);
        }
      } else {
        // Clean up other failed cases
        console.log(`🧹 [${sessionId}] Cleaning up failed session (reason: ${reason})`);
        if (tempAuthStates[sessionId]) {
          const { tempPath } = tempAuthStates[sessionId];
          if (fs.existsSync(tempPath)) {
            fs.rmSync(tempPath, { recursive: true, force: true });
          }
          delete tempAuthStates[sessionId];
        }
        delete sessions[sessionId];
        delete pendingQRCodes[sessionId];
      }
    }
  });

  // Handle credential updates
  sock.ev.on("creds.update", () => {
    if (tempAuthStates[sessionId]) {
      // Save to temp location for new sessions
      tempAuthStates[sessionId].saveCreds();
    } else {
      // Save to permanent location for established sessions
      saveCreds();
    }
  });

  sessions[sessionId] = sock;
  return sock;
}

// ✅ Backend restart वेळी फक्त existing valid sessions reload करा
function loadExistingSessions() {
  const basePath = path.join(__dirname, "sessions");
  if (!fs.existsSync(basePath)) return;

  // Clean up any temp sessions from previous runs
  const tempBasePath = path.join(__dirname, "temp_sessions");
  if (fs.existsSync(tempBasePath)) {
    fs.rmSync(tempBasePath, { recursive: true, force: true });
    console.log("🧹 Cleaned up temp sessions from previous run");
  }

  const sessionDirs = fs.readdirSync(basePath);
  sessionDirs.forEach((dir) => {
    const sessionPath = path.join(basePath, dir);
    // Only load if it's a directory and has auth files
    if (fs.statSync(sessionPath).isDirectory()) {
      const authFiles = fs.readdirSync(sessionPath);
      if (authFiles.length > 0) {
        console.log(`🔄 Reloading valid session: ${dir}`);
        startSock(dir, true);
      } else {
        // Clean up empty folders
        console.log(`🧹 Cleaning up empty session folder: ${dir}`);
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
    }
  });
}

// ✅ Manual session deletion function
async function deleteSession(sessionId) {
  const sessionPath = path.join(__dirname, "sessions", sessionId);
  
  // Disconnect socket if active
  if (sessions[sessionId]) {
    sessions[sessionId].end();
    delete sessions[sessionId];
  }
  
  // Delete permanent folder
  if (fs.existsSync(sessionPath)) {
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`🗑️ [${sessionId}] Session manually deleted`);
    } catch (err) {
      console.error(`❌ Error manually deleting session ${sessionId}:`, err);
    }
  }
  
  // Clean up temp folder if exists
  if (tempAuthStates[sessionId]) {
    const { tempPath } = tempAuthStates[sessionId];
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { recursive: true, force: true });
    }
    delete tempAuthStates[sessionId];
  }
  
  // Clean up memory
  delete pendingQRCodes[sessionId];
  delete sessions[sessionId + '_retryCount'];
  return true;
}

// ✅ Get session status
function getSessionStatus(sessionId) {
  const sessionPath = path.join(__dirname, "sessions", sessionId);
  const isConnected = sessions[sessionId] && sessions[sessionId].user;
  const hasAuthFiles = fs.existsSync(sessionPath);
  const isTemp = !!tempAuthStates[sessionId];
  const hasPendingQR = !!pendingQRCodes[sessionId];
  
  return {
    sessionId,
    connected: isConnected,
    authenticated: hasAuthFiles,
    temporary: isTemp,
    pendingQR: hasPendingQR,
    retryCount: sessions[sessionId + '_retryCount'] || 0
  };
}

module.exports = { 
  startSock, 
  sessions, 
  pendingQRCodes, 
  loadExistingSessions,
  deleteSession,
  getSessionStatus
};