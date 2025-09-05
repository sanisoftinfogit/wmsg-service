const express = require('express');
const router = express.Router();
const multer = require('multer');
// const upload = multer({ dest: 'uploads/' }); // temporary storage for images
const { createSession,sendMessage  } = require('../controllers/sessionController');
// const upload = require('../middleware/multer');

const upload = multer();


router.post('/create-session', createSession);
router.post('/send-message', upload.single('image'), sendMessage);


module.exports = router;
