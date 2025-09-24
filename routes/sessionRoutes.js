const express = require('express');
const router = express.Router();
const multer = require('multer');

const { createSession,
    sendMessage,
    scheduleMessage,
    checkSession,
    removeSession,
    addGroup,
    modifyGroup,
    getGroupList,
    getGroupNumbers,
sendBulkMessage,getMSGSchedules,deleteScheduledJob    } = require('../controllers/sessionController');


const upload = multer();


router.post('/create-session', createSession);

router.post('/send-message', upload.array('images', 10), sendMessage);

router.post(
  "/schedule-message",
  upload.array("images", 10),   
  scheduleMessage
);

router.delete("/delete-msg-schedule/:jid", deleteScheduledJob); 
router.post("/check-session", checkSession);
router.post("/delete-session", removeSession);
router.post('/insert-group', addGroup);

router.post('/update-group', modifyGroup);

router.get("/get-groups/:login_id", getGroupList);

router.get("/get-group-numbers/:group_id", getGroupNumbers);

router.post("/send-bulk-message", upload.array("images", 10), sendBulkMessage);

router.get("/list-msg-schedules", getMSGSchedules);




module.exports = router;
