const express = require("express");
const authRoutes = require("./auth");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Campus Lost & Found backend is healthy",
    timestamp: new Date().toISOString()
  });
});

router.use("/auth", authRoutes);

module.exports = router;
