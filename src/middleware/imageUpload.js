const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadsDirectory = path.join(__dirname, "../../uploads");
fs.mkdirSync(uploadsDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadsDirectory),
  filename: (_req, file, callback) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = { imageUpload, uploadsDirectory };
