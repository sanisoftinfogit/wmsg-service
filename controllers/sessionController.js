const { insertMobileRegistration } = require('../services/wmsgService');
// const { startSock, pendingQRCodes, sessions } = require('../whatsapp/sessionManager');
const { startSock, sessions, pendingQRCodes } = require('../sessionManager');


async function createSession(req, res) {
  const { sessionId, mobile, userid, login_id, api_key } = req.body;

  if (!sessionId || !mobile || !userid || !login_id || !api_key) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    // Step 1: Save Mobile Registration in DB
    const result = await insertMobileRegistration({ mobile, userid, login_id, api_key });

    if (result !== 1) {
      return res.status(400).json({ success: false, message: "Mobile registration failed" });
    }

    // Step 2: Start WhatsApp Session
    if (!sessions[sessionId]) {
      await startSock(sessionId);
    }

    // Step 3: Wait for QR (20 sec)
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      if (pendingQRCodes[sessionId]) {
        clearInterval(interval);
        return res.json({
          success: true,
          sessionId,
          qr: pendingQRCodes[sessionId] // Base64 QR
        });
      }
      if (tries > 20) {
        clearInterval(interval);
        return res.json({
          success: false,
          sessionId,
          message: "QR not generated yet. Try again."
        });
      }
    }, 1000);

  } catch (err) {
    console.error("❌ Error in createSession:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}


async function sendMessage(req, res) {
  const { sessionId, number, message } = req.body;

  try {
    if (!sessions[sessionId]) {
      return res
        .status(400)
        .json({ success: false, message: "Session not found or not connected yet" });
    }

    if (!number) {
      return res.status(400).json({ success: false, message: "Number is required" });
    }

    const jid = number.includes("@s.whatsapp.net")
      ? number
      : `${number}@s.whatsapp.net`;

    let options = {};

    // ✅ जर image upload केली असेल तर
    if (req.file) {
      options = {
        image: req.file.buffer,   // थेट buffer दे
        mimetype: req.file.mimetype, 
        caption: message || "",
      };
    }
    // ✅ फक्त text message
    else if (message) {
      options = { text: message };
    } else {
      return res
        .status(400)
        .json({ success: false, message: "No message or image provided" });
    }

    // ⚡ Send message using Baileys
    await sessions[sessionId].sendMessage(jid, options);

    res.json({ success: true, message: `Message sent from ${sessionId}` });
  } catch (err) {
    console.error("❌ Error sending message:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}



module.exports = { createSession,sendMessage };
