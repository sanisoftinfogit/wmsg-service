


const { startSock, sessions, pendingQRCodes } = require("../sessionManager");
const fs = require("fs");
const path = require("path");
const schedule = require("node-schedule"); 
const { deleteSession } = require("../services/wmsgService");
const { insertMobileRegistration } = require("../services/wmsgService"); 
const { insertGroup, updateGroup } = require('../services/wmsgService');
const { getGroupsByLoginId } = require("../services/wmsgService");
const { getGroupNumbersByGroupId } = require("../services/wmsgService");

async function createSession(req, res) {
  const { sessionId, mobile, userid, login_id, api_key } = req.body;

  if (!sessionId) {
    return res
      .status(400)
      .json({ success: false, message: "Session ID is required" });
  }

  try {
    const sessionFolder = path.join(__dirname, "../sessions", sessionId);

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

    if (!sessions[sessionId]) {
      await startSock(sessionId);

      try {
        const dbResult = await insertMobileRegistration({
          mobile,
          userid,
          login_id,
          api_key,
        });
        console.log("📌 InsertMobileRegistration Result:", dbResult);
      } catch (dbErr) {
        console.error("❌ Mobile registration DB insert error:", dbErr);
      }
    }

   
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      if (pendingQRCodes[sessionId]) {
        clearInterval(interval);
        return res.json({
          success: true,
          sessionId,
          qr: pendingQRCodes[sessionId],
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

async function sendMessage(req, res) {
  const { sessionId, number, message } = req.body;
  const files = req.files; 

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

    if (!sock.authState?.creds) {
      return res.status(400).json({
        success: false,
        message: "Session exists but not initialized. Please scan QR again.",
      });
    }

    const jid = number.includes("@s.whatsapp.net")
      ? number
      : `${number}@s.whatsapp.net`;

    console.log(`📨 Sending to ${jid} via session ${sessionId}`);

    if (files && files.length > 0) {
      for (const file of files) {
        await sock.sendMessage(jid, {
          image: file.buffer, 
          caption: message || "",
        });
      }
    } else if (req.file) {
      await sock.sendMessage(jid, {
        image: req.file.buffer, 
        caption: message || "",
      });
    } else {
      await sock.sendMessage(jid, { text: message });
    }

    res.json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    console.error("❌ sendMessage error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}


async function scheduleMessage(req, res) {
  const { sessionId, numbers, message, time, startDate, endDate } = req.body;

  if (
    !sessionId ||
    !numbers ||
    !Array.isArray(numbers) ||
    numbers.length === 0 ||
    !message ||
    !time ||
    !startDate ||
    !endDate
  ) {
    return res.status(400).json({
      success: false,
      message:
        "SessionId, numbers (array), message, time, startDate and endDate are required",
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

  
    const [hours, minutes, seconds] = time.split(":").map(Number);

   
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd, hours, minutes, seconds);

    
    const [ey, em, ed] = endDate.split("-").map(Number);
    const end = new Date(ey, em - 1, ed, 23, 59, 59);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be after end date",
      });
    }

   
    const rule = new schedule.RecurrenceRule();
    rule.hour = hours;
    rule.minute = minutes;
    rule.second = seconds;

    const job = schedule.scheduleJob(rule, async () => {
      const now = new Date();

      if (now < start) {
        console.log(`⏳ Waiting for start date: ${start}`);
        return;
      }

      if (now > end) {
        console.log(`🛑 Stopping job after endDate: ${end}`);
        job.cancel(); 
        return;
      }

      for (const number of numbers) {
        const jid = number.includes("@s.whatsapp.net")
          ? number
          : `${number}@s.whatsapp.net`;

        console.log(`⏰ Scheduled message sent to ${jid} at ${now}`);
        await sock.sendMessage(jid, { text: message });
      }
    });

    res.json({
      success: true,
      message: `Daily message scheduled at ${time} from ${startDate} to ${endDate} for ${numbers.length} numbers`,
    });
  } catch (err) {
    console.error("❌ scheduleMessage error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}


async function checkSession(req, res) {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: "SessionId is required",
    });
  }

  try {
    const sock = sessions[sessionId];

    if (!sock) {
      return res.json({
        success: false,
        sessionId,
        message: "Session not found",
      });
    }

    if (!sock.authState?.creds) {
      return res.json({
        success: false,
        sessionId,
        message: "Session exists but not initialized. Please scan QR again.",
      });
    }

    return res.json({
      success: true,
      sessionId,
      message: "Session is active",
    });
  } catch (err) {
    console.error("❌ checkSession error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
async function removeSession(req, res) {
  const { mobile, login_id } = req.body;

  if (!mobile || !login_id) {
    return res.status(400).json({
      success: false,
      message: "mobile and login_id are required"
    });
  }

  try {
    const dbResult = await deleteSession({ mobile, login_id });

    if (dbResult === 1) {
      return res.json({
        success: true,
        message: "Session deleted (flag set to Deactive)"
      });
    } else {
      return res.json({
        success: false,
        message: "Delete failed. No matching record."
      });
    }
  } catch (err) {
    console.error("❌ removeSession error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function addGroup(req, res) {
  const { login_id, group_name, numbers } = req.body;

  if (!login_id || !group_name || !Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({
      success: false,
      message: "login_id, group_name and numbers[] are required"
    });
  }

  try {
    const result = await insertGroup({ login_id, group_name, numbers });

    if (result === 1) {
      return res.json({ success: true, message: "Group created successfully" });
    } else if (result === 2) {
      return res.json({ success: false, message: "Group already exists" });
    } else {
      return res.json({ success: false, message: "Insert failed" });
    }
  } catch (err) {
    console.error("❌ addGroup error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function modifyGroup(req, res) {
  const { id, group_id, group_name, numbers } = req.body;

  if (!id || !group_id || !group_name || !Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({
      success: false,
      message: "id, group_id, group_name and numbers[] are required"
    });
  }

  try {
    const result = await updateGroup({ id, group_id, group_name, numbers });

    if (result === 1) {
      return res.json({ success: true, message: "Group updated successfully" });
    } else if (result === 2) {
      return res.json({ success: false, message: "Group with same name already exists" });
    } else {
      return res.json({ success: false, message: "Update failed" });
    }
  } catch (err) {
    console.error("❌ modifyGroup error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getGroupList(req, res) {
  const { login_id } = req.params; 

  if (!login_id) {
    return res.status(400).json({
      success: false,
      message: "login_id is required",
    });
  }

  try {
    const groups = await getGroupsByLoginId(login_id);

    if (!groups || groups.length === 0) {
      return res.json({
        success: false,
        message: "No groups found for this login_id",
      });
    }

    return res.json({
      success: true,
      groups,
    });
  } catch (err) {
    console.error("❌ getGroupList error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getGroupNumbers(req, res) {
  const { group_id } = req.params; 

  if (!group_id) {
    return res.status(400).json({
      success: false,
      message: "group_id is required",
    });
  }

  try {
    const numbers = await getGroupNumbersByGroupId(parseInt(group_id));

    if (!numbers || numbers.length === 0) {
      return res.json({
        success: false,
        message: "No numbers found for this group",
      });
    }

    return res.json({
      success: true,
      numbers,
    });
  } catch (err) {
    console.error("❌ getGroupNumbers error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function sendBulkMessage(req, res) {
  const { sessionId, numbers, message, delay = 1000 } = req.body;
  
  const files = req.files;

  if (!sessionId || !numbers || !Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({
      success: false,
      message: "SessionId and numbers (array) are required",
    });
  }

  let sock = sessions[sessionId];
  if (!sock) {
    return res.status(400).json({
      success: false,
      message: "Session not found. Please create session first.",
    });
  }

  if (!sock.authState?.creds) {
    return res.status(400).json({
      success: false,
      message: "Session exists but not initialized. Please scan QR again.",
    });
  }

 
  res.json({
    success: true,
    message: `Bulk message process started. Messages will be sent in background with ${delay / 1000} sec delay`,
    totalNumbers: numbers.length,
  });


  (async () => {
    for (const number of numbers) {
      const jid = number.includes("@s.whatsapp.net")
        ? number
        : `${number}@s.whatsapp.net`;

      try {
        if (files && files.length > 0) {
          for (const file of files) {
            await sock.sendMessage(jid, {
              image: file.buffer,
              caption: message || "",
            });
          }
        } else {
          await sock.sendMessage(jid, { text: message });
        }

        console.log(`✅ Sent to ${number}`);
      } catch (err) {
        console.error(`❌ Failed to send to ${number}:`, err.message);
      }

    
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    console.log("🎉 Bulk sending finished!");
  })();
}



module.exports = { createSession, sendMessage,scheduleMessage,checkSession,removeSession,addGroup, modifyGroup,getGroupList,getGroupNumbers,sendBulkMessage};
