// const { startSock, sessions, pendingQRCodes } = require('../sessionManager');
// const fs = require("fs");
// const path = require("path");

// async function createSession(req, res) {
//   const { sessionId } = req.body;

//   if (!sessionId) {
//     return res.status(400).json({ success: false, message: "Session ID is required" });
//   }

//   try {
//     const sessionFolder = path.join(__dirname, "../sessions", sessionId);

//     // ✅ जर session आधीपासून असेल
//     if (fs.existsSync(sessionFolder)) {
//       console.log(`🔄 Resuming existing session: ${sessionId}`);

//       // socket initialize झालं नसेल तर पुन्हा सुरू कर
//       if (!sessions[sessionId]) {
//         await startSock(sessionId);
//       }

//       return res.json({
//         success: true,
//         sessionId,
//         message: "Resumed existing session"
//       });
//     }

//     // ✅ नवीन session सुरू कर
//     if (!sessions[sessionId]) {
//       await startSock(sessionId);
//     }

//     // ✅ QR generate होण्याची वाट पाहा
//     let tries = 0;
//     const interval = setInterval(() => {
//       tries++;
//       if (pendingQRCodes[sessionId]) {
//         clearInterval(interval);
//         return res.json({
//           success: true,
//           sessionId,
//           qr: pendingQRCodes[sessionId] // Base64 QR
//         });
//       }
//       if (tries > 20) {
//         clearInterval(interval);
//         return res.json({
//           success: false,
//           sessionId,
//           message: "QR not generated yet. Try again."
//         });
//       }
//     }, 1000);

//   } catch (err) {
//     console.error("❌ Error in createSession:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// }

// async function sendMessage(req, res) {
//   const { sessionId, number, message } = req.body;

//   if (!sessionId || !number) {
//     return res.status(400).json({ success: false, message: "SessionId and number are required" });
//   }

//   try {
//     let sock = sessions[sessionId];

//     if (!sock) {
//       return res.status(400).json({ success: false, message: "Session not found. Please create session first." });
//     }

//     // ✅ connection state check करा
//     if (!sock.authState?.creds || !sock.authState.creds.registered) {
//       return res.status(400).json({
//         success: false,
//         message: "Session exists but not connected. Please scan QR again."
//       });
//     }

//     const jid = number.includes("@s.whatsapp.net") ? number : `${number}@s.whatsapp.net`;

//     await sock.sendMessage(jid, { text: message });

//     res.json({ success: true, message: "Message sent successfully!" });

//   } catch (err) {
//     console.error("❌ sendMessage error:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// }


// module.exports = { createSession, sendMessage };






const { startSock, sessions, pendingQRCodes } = require("../sessionManager");
const fs = require("fs");
const path = require("path");

/**
 * ✅ Session Create / Resume
 */
async function createSession(req, res) {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res
      .status(400)
      .json({ success: false, message: "Session ID is required" });
  }

  try {
    const sessionFolder = path.join(__dirname, "../sessions", sessionId);

    // 🔄 जर जुनी session folder असेल
    if (fs.existsSync(sessionFolder)) {
      console.log(`🔄 Resuming existing session: ${sessionId}`);

      if (!sessions[sessionId]) {
        await startSock(sessionId);
      }

      return res.json({
        success: true,
        sessionId,
        message: "Resumed existing session",
      });
    }

    // 🆕 नवीन session सुरू कर
    if (!sessions[sessionId]) {
      await startSock(sessionId);
    }

    // 📌 QR generate होण्याची वाट पाहा
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      if (pendingQRCodes[sessionId]) {
        clearInterval(interval);
        return res.json({
          success: true,
          sessionId,
          qr: pendingQRCodes[sessionId], // Base64 QR
        });
      }
      if (tries > 20) {
        clearInterval(interval);
        return res.json({
          success: false,
          sessionId,
          message: "QR not generated yet. Try again.",
        });
      }
    }, 1000);
  } catch (err) {
    console.error("❌ Error in createSession:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * ✅ Send Message (Text + Image)
 */
async function sendMessage(req, res) {
  const { sessionId, number, message } = req.body;
  const file = req.file; // multer ने upload केलेली image

  if (!sessionId || !number) {
    return res.status(400).json({
      success: false,
      message: "SessionId and number are required",
    });
  }

  try {
    let sock = sessions[sessionId];

    if (!sock) {
      return res.status(400).json({
        success: false,
        message: "Session not found. Please create session first.",
      });
    }

    // ✅ फक्त auth creds अस्तित्व तपासा, registered check काढलं
    if (!sock.authState?.creds) {
      return res.status(400).json({
        success: false,
        message: "Session exists but not initialized. Please scan QR again.",
      });
    }

    // ✅ JID format fix
    const jid = number.includes("@s.whatsapp.net")
      ? number
      : `${number}@s.whatsapp.net`;

    console.log(`📨 Sending to ${jid} via session ${sessionId}`);

    if (file) {
      // जर image असेल
      await sock.sendMessage(jid, {
        image: fs.readFileSync(file.path),
        caption: message || "",
      });
    } else {
      // फक्त text
      await sock.sendMessage(jid, { text: message });
    }

    res.json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    console.error("❌ sendMessage error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { createSession, sendMessage };
