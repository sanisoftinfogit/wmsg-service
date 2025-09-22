const express = require('express');
const router = express.Router();
const { handleLogin,handleUpdatePassword } = require('../controllers/loginController');


router.post('/login', handleLogin);

router.post('/update-password', handleUpdatePassword);

module.exports = router;
