const express = require('express');
const router = express.Router();
const multer = require('multer');
// const upload = multer({ dest: 'uploads/' }); // temporary storage for images
const { createSession,
    sendMessage,
    scheduleMessage,
    checkSession,
    removeSession,
    addGroup,
    modifyGroup,
    getGroupList,
    getGroupNumbers } = require('../controllers/sessionController');
// const upload = require('../middleware/multer');

const upload = multer();


router.post('/create-session', createSession);
// router.post('/send-message', upload.single('image'), sendMessage);
// single image ऐवजी multiple images
router.post('/send-message', upload.array('images', 10), sendMessage);

router.post("/schedule-message", scheduleMessage); 

router.post("/check-session", checkSession);
router.post("/delete-session", removeSession);
router.post('/insert-group', addGroup);

router.post('/update-group', modifyGroup);

router.get("/get-groups/:login_id", getGroupList);

router.get("/get-group-numbers/:group_id", getGroupNumbers);

module.exports = router;
