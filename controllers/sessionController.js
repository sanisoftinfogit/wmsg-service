const { startSock, sessions, pendingQRCodes } = require("../sessionManager");
const fs = require("fs");
const path = require("path");
const schedule = require("node-schedule");
const { deleteSession } = require("../services/wmsgService");
const { insertMobileRegistration } = require("../services/wmsgService");
const { insertGroup, updateGroup } = require('../services/wmsgService');
const { getGroupsByLoginId } = require("../services/wmsgService");
const { getGroupNumbersByGroupId } = require("../services/wmsgService");
const { insertMSGSchedule } = require('../services/wmsgService');
const { listMSGSchedules } = require('../services/wmsgService');
const { execSP } = require('../services/wmsgService');

const { MultiClientManager, addTask } = require('../web-whatsapp');

const multiClientManager = new MultiClientManager();

function getSafeClientId(rawId) {
  if (!rawId) rawId = '';
  // coerce to string
  rawId = String(rawId);
  // remove leading/trailing whitespace
  rawId = rawId.trim();
  // remove non-printable / non-ascii characters
  rawId = rawId.replace(/[^\x20-\x7E]/g, '');
  // allow only alphanumeric, underscore, hyphen
  rawId = rawId.replace(/[^A-Za-z0-9_-]/g, '_');
  // fallback if empty
  if (!rawId) rawId = 'wa_' + Date.now();
  return rawId;
}


async function createSession(req, res) {
  const { sessionId, mobile, userid, login_id, api_key } = req.body;

  if (!sessionId) {
    return res
      .status(400)
      .json({ success: false, message: "Session ID is required" });
  }
  const client = await multiClientManager.addClient(sessionId)
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

  const qr = await client.client.getQR();
  return res.json({
    success: true,
    sessionId,
    qr,
  });

}

const jobs = new Map();

let jidCounter = 1;


async function scheduleMessage(req, res) {
  try {
    const { sessionId, numbers, message, time, startDate, endDate, login_id } = req.body;
    let files = req.files || [];

    if (!sessionId || !numbers || !message || !time || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    let numbersArray = Array.isArray(numbers) ? numbers :
      typeof numbers === "string" ? JSON.parse(numbers) : [];
    if (!Array.isArray(numbersArray) || numbersArray.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid numbers" });
    }

    let sock = multiClientManager.getClient(getSafeClientId(sessionId));
    
    if (!sock) {
      
      return res.status(400).json({ success: false, message: "Session not found" });
    }

    const [hours, minutes, seconds] = time.split(":").map(Number);
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);

    const start = new Date(sy, sm - 1, sd, hours, minutes, seconds);
    const end = new Date(ey, em - 1, ed, 23, 59, 59);

    if (isNaN(start) || isNaN(end) || start > end) {
      return res.status(400).json({ success: false, message: "Invalid date/time" });
    }

    const jid = jidCounter++;

    // DB insert
    for (const number of numbersArray) {
      await insertMSGSchedule({
        login_id,
        mobile: number,
        jid,
        msdate: startDate,
        medate: endDate,
        mtime: time
      }).catch(err => console.error("❌ DB insert failed:", err));
    }

    // Schedule job
    const rule = new schedule.RecurrenceRule();
    rule.hour = hours;
    rule.minute = minutes;
    rule.second = seconds;

    const job = schedule.scheduleJob(rule, async () => {
      const now = new Date();
      if (now < start) return;
      if (now > end) {
        console.log(`🛑 Job ${jid} ended`);
        job.cancel();
        jobs.delete(jid);
        return;
      }

      files = files.map(f => {
        return f.path;
      })
      sendMsg(numbersArray, files, sessionId, message, message);
    });

    // 🔹 Save in jobs Map
    jobs.set(jid, job);

    res.json({ success: true, message: "Scheduled", jid });
  } catch (err) {
    console.error("❌ scheduleMessage error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteScheduledJob(req, res) {
  try {
    const { jid } = req.params;
    if (!jid) return res.status(400).json({ success: false, message: "jid is required" });

    const jobId = Number(jid);


    const job = jobs.get(jobId);
    if (job) {
      job.cancel();
      jobs.delete(jobId);
      console.log(`✅ Job ${jid} cancelled in memory`);
    } else {
      console.log(`⚠️ Job ${jid} not found in memory`);
    }

    // 🔹 Database मधून delete via SP
    try {
      const result = await execSP('saniszu9_1.sp_wmsg', {
        Action: 'DeleteMSGSchedule',
        jid: jobId
      });
      console.log(`✅ Job ${jid} deleted from DB via SP`);
    } catch (dbErr) {
      console.error("❌ DB delete error:", dbErr);
      return res.status(500).json({ success: false, message: "Failed to delete job from DB", error: dbErr.message });
    }

    res.json({ success: true, message: `Job ${jid} deleted from memory and DB` });
  } catch (err) {
    console.error("❌ deleteScheduledJob error:", err);
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
        success: true,
        message: "Delete success."
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

async function sendMsg(numbers, files, sessionId, message, caption) {

  const c = multiClientManager.getClient(getSafeClientId(sessionId));
  if (!c || !c.client.isReady()) {
    return ({ error: 'Client is not authenticated yet...' });
  }

  numbers.forEach(fn => {
    if (files.length) {
      files.forEach(f => {
        addTask(c.queue, c.pool, {
          to: fn,
          options: {
            mediaFilePath: f,
            caption
          }
        })

      })
    } else {
      addTask(c.queue, c.pool, {
        to: fn,
        message
      })
    }
  }
  )

}



async function sendBulkMessage(req, res) {
  const { sessionId, numbers, caption, message } = req.body;
  let files = req.files || [];

  // ✅ Validation
  if (!sessionId || !numbers || !Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({
      success: false,
      message: "SessionId and numbers (array) are required",
    });
  }

  files = files.map(f => {
    return f.path;
  })
  sendMsg(numbers, files, sessionId, message, caption);

  return res.json({
    success: true,
  });

}



async function getMSGSchedulesController(req, res) {
  try {
    const schedules = await listMSGSchedules();

    if (!schedules || schedules.length === 0) {
      return res.json({
        success: false,
        message: "No scheduled messages found",
      });
    }

    res.json({
      success: true,
      schedules,
    });
  } catch (err) {
    console.error("❌ getMSGSchedules error:", err);
    res.status(500).json({ success: false, error: err.message });
  }

}


module.exports = { createSession, scheduleMessage, checkSession, removeSession, addGroup, modifyGroup, getGroupList, deleteScheduledJob, getGroupNumbers, sendBulkMessage, getMSGSchedules: getMSGSchedulesController };
