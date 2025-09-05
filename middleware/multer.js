const multer = require('multer');

// Use memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = upload;
