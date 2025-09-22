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
const { updateMSGSchedule } = require('../services/wmsgService');



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


// async function scheduleMessage(req, res) {
//   try {
//     const { sessionId, numbers, message, time, startDate, endDate, login_id } = req.body;
//     const files = req.files || [];

//     // validation
//     if (!sessionId || !numbers || !message || !time || !startDate || !endDate) {
//       return res.status(400).json({
//         success: false,
//         message: "SessionId, numbers (array), message, time, startDate and endDate are required",
//       });
//     }

//     // parse numbers
//     let numbersArray = Array.isArray(numbers) ? numbers : 
//                         typeof numbers === "string" ? JSON.parse(numbers) : [];
//     if (!Array.isArray(numbersArray) || numbersArray.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid numbers format (must be array)",
//       });
//     }

//     // session check
//     let sock = sessions[sessionId];
//     if (!sock) {
//       return res.status(400).json({ success: false, message: "Session not found" });
//     }

//     // parse time
//     const [hours, minutes, seconds] = time.split(":").map(Number);
//     const [sy, sm, sd] = startDate.split("-").map(Number);
//     const [ey, em, ed] = endDate.split("-").map(Number);
//     const start = new Date(sy, sm - 1, sd, hours, minutes, seconds);
//     const end = new Date(ey, em - 1, ed, 23, 59, 59);

//     if (isNaN(start) || isNaN(end) || start > end) {
//       return res.status(400).json({ success: false, message: "Invalid date or time" });
//     }

//     // --- Generate a single jid for this schedule ---
//     const jid = jidCounter++; // just once per schedule

//     // --- Assign same jid to all numbers ---
//     const scheduledNumbers = numbersArray.map(number => ({ number, jid }));

//     for (const item of scheduledNumbers) {
//       try {
//         await insertMSGSchedule({
//           login_id,
//           mobile: item.number,
//           jid: item.jid,
//           msdate: startDate,
//           medate: endDate,
//           mtime: time
//         });
//       } catch (dbErr) {
//         console.error("❌ DB insert failed for", item.number, dbErr);
//       }
//     }

//     // --- Schedule job only to send messages ---
//     const rule = new schedule.RecurrenceRule();
//     rule.hour = hours;
//     rule.minute = minutes;
//     rule.second = seconds;

//     schedule.scheduleJob(rule, async () => {
//       const now = new Date();
//       if (now < start) return;
//       if (now > end) return; // job will auto-end

//       for (const item of scheduledNumbers) {
//         const targetJid = item.number.includes("@s.whatsapp.net") ? item.number : `${item.number}@s.whatsapp.net`;

//         // send images
//         for (const file of files) {
//           await sock.sendMessage(targetJid, { image: file.buffer, mimetype: file.mimetype });
//         }

//         // send text
//         if (message.trim()) {
//           await sock.sendMessage(targetJid, { text: message });
//         }
//       }
//     });

//     res.json({
//       success: true,
//       message: `✅ Messages scheduled from ${startDate} to ${endDate} at ${time} for ${numbersArray.length} numbers`,
//       fileCount: files.length,
//     });

//   } catch (err) {
//     console.error("❌ scheduleMessage error:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// }


// --------------------


// const jobs = new Map();

// let jidCounter = 1;
// async function scheduleMessage(req, res) {
//   try {
//     const { sessionId, numbers, message, time, startDate, endDate, login_id } = req.body;
//     const files = req.files || [];

//     if (!sessionId || !numbers || !message || !time || !startDate || !endDate) {
//       return res.status(400).json({ success: false, message: "Missing required fields" });
//     }

//     let numbersArray = Array.isArray(numbers) ? numbers : 
//                       typeof numbers === "string" ? JSON.parse(numbers) : [];
//     if (!Array.isArray(numbersArray) || numbersArray.length === 0) {
//       return res.status(400).json({ success: false, message: "Invalid numbers" });
//     }

//     let sock = sessions[sessionId];
//     if (!sock) {
//       return res.status(400).json({ success: false, message: "Session not found" });
//     }

//     const [hours, minutes, seconds] = time.split(":").map(Number);
//     const [sy, sm, sd] = startDate.split("-").map(Number);
//     const [ey, em, ed] = endDate.split("-").map(Number);

//     const start = new Date(sy, sm - 1, sd, hours, minutes, seconds);
//     const end = new Date(ey, em - 1, ed, 23, 59, 59);

//     if (isNaN(start) || isNaN(end) || start > end) {
//       return res.status(400).json({ success: false, message: "Invalid date/time" });
//     }

//     const jid = jidCounter++;

//     // DB insert
//     for (const number of numbersArray) {
//       await insertMSGSchedule({
//         login_id,
//         mobile: number,
//         jid,
//         msdate: startDate,
//         medate: endDate,
//         mtime: time
//       }).catch(err => console.error("❌ DB insert failed:", err));
//     }

//     // Schedule job
//     const rule = new schedule.RecurrenceRule();
//     rule.hour = hours;
//     rule.minute = minutes;
//     rule.second = seconds;

//     const job = schedule.scheduleJob(rule, async () => {
//       const now = new Date();
//       if (now < start) return;
//       if (now > end) {
//         console.log(`🛑 Job ${jid} ended`);
//         job.cancel();
//         jobs.delete(jid);
//         return;
//       }

//       for (const number of numbersArray) {
//         const targetJid = number.includes("@s.whatsapp.net") ? number : `${number}@s.whatsapp.net`;

//         for (const file of files) {
//           await sock.sendMessage(targetJid, { image: file.buffer, mimetype: file.mimetype });
          
//         }

//         if (message.trim()) {
//           await sock.sendMessage(targetJid, { text: message });
           
//         }
//       }
//     });

//     // 🔹 Save in jobs Map
//     jobs.set(jid, job);

//     res.json({ success: true, message: "Scheduled", jid });
//   } catch (err) {
//     console.error("❌ scheduleMessage error:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// }


const jobs = new Map();
let jidCounter = 1;

async function scheduleMessage(req, res) {
  try {
    const { sessionId, numbers, message, time, startDate, endDate, login_id } = req.body;
    const files = req.files || [];

    if (!sessionId || !numbers || !message || !time || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    let numbersArray = Array.isArray(numbers)
      ? numbers
      : typeof numbers === "string"
      ? JSON.parse(numbers)
      : [];
    if (!Array.isArray(numbersArray) || numbersArray.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid numbers" });
    }

    let sock = sessions[sessionId];
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
        mtime: time,
      }).catch((err) => console.error("❌ DB insert failed:", err));
    }

    // Schedule only ONCE at the given time
    const job = schedule.scheduleJob(start, async () => {
      const now = new Date();
      if (now > end) {
        console.log(`🛑 Job ${jid} expired`);
        job.cancel();
        jobs.delete(jid);
        return;
      }

      console.log(`▶️ Job ${jid} started at ${now.toLocaleString()}`);

      // 🔹 Send messages sequentially with delay
      for (let i = 0; i < numbersArray.length; i++) {
        const number = numbersArray[i];
        const targetJid = number.includes("@s.whatsapp.net")
          ? number
          : `${number}@s.whatsapp.net`;

        try {
          // send files first
          for (const file of files) {
            await sock.sendMessage(targetJid, {
              image: file.buffer,
              mimetype: file.mimetype,
            });
          }

          // send message
          if (message.trim()) {
            await sock.sendMessage(targetJid, { text: message });
          }

          console.log(`✅ Sent to ${number}`);
        } catch (err) {
          console.error(`❌ Failed to send to ${number}:`, err.message);
        }

        // ✅ Only wait if not the last number
        if (i < numbersArray.length - 1) {
          const randomDelay = getRandomDelay(25000, 35000);
          console.log(`⏳ Waiting ${randomDelay / 1000}s before next number...`);
          await new Promise((resolve) => setTimeout(resolve, randomDelay));
        }
      }

      console.log(`🎉 Job ${jid} finished sending all messages`);
    });

    // Save in jobs Map
    jobs.set(jid, job);

    res.json({ success: true, message: "Scheduled", jid });
  } catch (err) {
    console.error("❌ scheduleMessage error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// Helper for random delay
function getRandomDelay(min = 28000, max = 35000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


async function updateMSGScheduleController(req, res) {
  try {
    const { login_id,sessionId, mobile, jid, msdate, medate, mtime } = req.body;

    if (!login_id || !mobile || !jid || !msdate || !medate || !mtime) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const result = await updateMSGSchedule({ login_id, mobile, jid, msdate, medate, mtime });

    if (result !== 1) {
      return res.json({ success: false, message: "Failed to update message schedule" });
    }

    // ✅ Cancel the old job if it exists
    const oldJob = jobs.get(jid);
    if (oldJob) {
      oldJob.cancel();
      jobs.delete(jid);
    }

    // ✅ Reschedule the job in memory
    const [hours, minutes, seconds] = mtime.split(":").map(Number);
    const [sy, sm, sd] = msdate.split("-").map(Number);
    const [ey, em, ed] = medate.split("-").map(Number);

    const start = new Date(sy, sm - 1, sd, hours, minutes, seconds);
    const end = new Date(ey, em - 1, ed, 23, 59, 59);

    const sock = sessions[sessionId]; // or your session mapping
    if (!sock) {
      return res.status(400).json({ success: false, message: "Session not found" });
    }

    const rule = new schedule.RecurrenceRule();
    rule.hour = hours;
    rule.minute = minutes;
    rule.second = seconds;

    const job = schedule.scheduleJob(rule, async () => {
      const now = new Date();
      if (now < start) return;
      if (now > end) {
        job.cancel();
        jobs.delete(jid);
        return;
      }

      const targetJid = mobile.includes("@s.whatsapp.net") ? mobile : `${mobile}@s.whatsapp.net`;

      // Send message (you can add file sending logic if needed)
      await sock.sendMessage(targetJid, { text: "Your scheduled message" });
    });

    jobs.set(jid, job);

    return res.json({ success: true, message: "Message schedule updated and rescheduled" });

  } catch (err) {
    console.error("❌ updateMSGScheduleController error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}



// async function deleteScheduledJob(req, res) {
//   try {
//     const { jid } = req.params;  // DELETE request URL: /api/delete-msg-schedule/:jid

//     if (!jid) {
//       return res.status(400).json({ success: false, message: "jid is required" });
//     }

//     const jobId = Number(jid); // Memory मध्ये Number type मध्ये ठेवले असल्यास

//     // 🔹 Memory मधून delete
//     const job = jobs.get(jobId);
//     if (job) {
//       job.cancel();
//       jobs.delete(jobId);
//       console.log(`✅ Job ${jid} cancelled in memory`);
//       return res.json({ success: true, message: `Job ${jid} deleted from memory` });
//     } else {
//       console.log(`⚠️ Job ${jid} not found in memory (maybe server restarted)`);
//       return res.status(404).json({ success: false, message: "Job not found in memory" });
//     }

//   } catch (err) {
//     console.error("❌ deleteScheduledJob error:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// }




async function deleteScheduledJob(req, res) {
  try {
    const { jid } = req.params;
    if (!jid) return res.status(400).json({ success: false, message: "jid is required" });

    const jobId = Number(jid);

    // 🔹 Memory मधून delete
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


async function sendBulkMessage(req, res) {
  const { sessionId, numbers, caption, message } = req.body;
  const files = req.files;

  // ✅ Validation
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

  // ✅ Immediate response to client
  res.json({
    success: true,
    message: `Bulk message process started. Messages will be sent in background with random delay (22s - 35s)`,
    totalNumbers: numbers.length,
  });

  // ✅ Background bulk sending
  (async () => {
    for (const number of numbers) {
      const jid = number.includes("@s.whatsapp.net")
        ? number
        : `${number}@s.whatsapp.net`;

      try {
        // 1️⃣ Send text message first
        if (message) {
          await sock.sendMessage(jid, { text: message });
        }

        // 2️⃣ Send media files (if any)
        if (files && files.length > 0) {
          for (const file of files) {
            const mime = file.mimetype;

            if (mime.startsWith("image/")) {
              // 🖼️ Image
              await sock.sendMessage(jid, {
                image: file.buffer,
                caption: caption || "",
              });
            } else if (mime.startsWith("video/")) {
              // 🎥 Video
              await sock.sendMessage(jid, {
                video: file.buffer,
                caption: caption || "",
              });
            } else if (mime.startsWith("audio/")) {
              // 🎵 Audio
              await sock.sendMessage(jid, {
                audio: file.buffer,
                mimetype: mime,
              });
            } else {
              // 📄 Document (PDF, text, etc.)
              await sock.sendMessage(jid, {
                document: file.buffer,
                fileName: file.originalname,
                mimetype: mime,
                caption: caption || "",
              });
            }
          }
        }

        console.log(`✅ Sent to ${number}`);
      } catch (err) {
        console.error(`❌ Failed to send to ${number}:`, err.message);
      }

      // 3️⃣ Random delay between 22s - 35s
      const randomDelay = getRandomDelay();
      console.log(`⏳ Waiting ${randomDelay / 1000} sec before next message...`);
      await new Promise((resolve) => setTimeout(resolve, randomDelay));
    }

    console.log("🎉 Bulk sending finished!");
  })();
}


// async function sendBulkMessage(req, res) {
//   const { sessionId, numbers, caption, message } = req.body;
//   const files = req.files;

//   // ✅ Validation
//   if (!sessionId || !numbers || !Array.isArray(numbers) || numbers.length === 0) {
//     return res.status(400).json({
//       success: false,
//       message: "SessionId and numbers (array) are required",
//     });
//   }

//   let sock = sessions[sessionId];
//   if (!sock) {
//     return res.status(400).json({
//       success: false,
//       message: "Session not found. Please create session first.",
//     });
//   }

//   if (!sock.authState?.creds) {
//     return res.status(400).json({
//       success: false,
//       message: "Session exists but not initialized. Please scan QR again.",
//     });
//   }


//   res.json({
//     success: true,
//     message: `Bulk message process started. Messages will be sent in background with random delay (22s - 35s)`,
//     totalNumbers: numbers.length,
//   });


//   const getTypingDelay = () =>
//     Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000; // 2–5 sec


//   (async () => {
//     for (const number of numbers) {
//       const jid = number.includes("@s.whatsapp.net")
//         ? number
//         : `${number}@s.whatsapp.net`;

//       try {
//         // 1️⃣ Send text message with typing simulation
//         if (message) {
//           await sock.presenceSubscribe(jid);
//           await sock.sendPresenceUpdate("composing", jid);

//           const typingDelay = getTypingDelay();
//           console.log(`✍️ Simulating typing for ${typingDelay / 1000}s before sending text to ${number}`);
//           await new Promise((res) => setTimeout(res, typingDelay));

//           await sock.sendPresenceUpdate("paused", jid);

//           await sock.sendMessage(jid, { text: message });
//         }

//         // 2️⃣ Send media files (if any) with "uploading" simulation
//         if (files && files.length > 0) {
//           for (const file of files) {
//             const mime = file.mimetype;

//             await sock.presenceSubscribe(jid);
//             await sock.sendPresenceUpdate("composing", jid); // simulate "uploading..."
//             const uploadDelay = getTypingDelay();
//             console.log(`📤 Simulating upload for ${uploadDelay / 1000}s before sending media to ${number}`);
//             await new Promise((res) => setTimeout(res, uploadDelay));
//             await sock.sendPresenceUpdate("paused", jid);

//             if (mime.startsWith("image/")) {
//               await sock.sendMessage(jid, {
//                 image: file.buffer,
//                 caption: caption || "",
//               });
//             } else if (mime.startsWith("video/")) {
//               await sock.sendMessage(jid, {
//                 video: file.buffer,
//                 caption: caption || "",
//               });
//             } else if (mime.startsWith("audio/")) {
//               await sock.sendMessage(jid, {
//                 audio: file.buffer,
//                 mimetype: mime,
//               });
//             } else {
//               await sock.sendMessage(jid, {
//                 document: file.buffer,
//                 fileName: file.originalname,
//                 mimetype: mime,
//                 caption: caption || "",
//               });
//             }
//           }
//         }

//         console.log(`✅ Sent to ${number}`);
//       } catch (err) {
//         console.error(`❌ Failed to send to ${number}:`, err.message);
//       }

//       // 3️⃣ Random delay between 22s - 35s before next number
//       const randomDelay = getRandomDelay();
//       console.log(`⏳ Waiting ${randomDelay / 1000} sec before next message...`);
//       await new Promise((resolve) => setTimeout(resolve, randomDelay));
//     }

//     console.log("🎉 Bulk sending finished!");
//   })();
// }

// 🔹 Helper function (use only this one for random delay)
function getRandomDelay(min = 25000, max = 55000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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


module.exports = { createSession, sendMessage,scheduleMessage,updateMSGScheduleController,checkSession,removeSession,addGroup, modifyGroup,getGroupList,deleteScheduledJob, getGroupNumbers,sendBulkMessage,getMSGSchedules:getMSGSchedulesController};
