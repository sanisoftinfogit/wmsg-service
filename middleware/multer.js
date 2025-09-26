const multer = require('multer');
const path = require('path');


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.resolve(__dirname, '../uploads')); // Specify the upload directory
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname); // Unique filename
    }
});
const upload = multer({ storage });

module.exports = upload;
