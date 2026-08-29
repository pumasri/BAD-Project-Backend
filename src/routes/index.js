const express = require("express");
const authRoutes = require("./auth");
const itemsRoutes = require("./items");
const claimsRoutes = require("./claims");
const adminRoutes = require("./admin");
const categoriesRoutes = require("./categories");
const peerRoutes = require("./peer");
const matchesRoutes = require("./matches");
const chatRoutes = require("./chat");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Campus Lost & Found backend is healthy",
    timestamp: new Date().toISOString()
  });
});

router.use("/auth", authRoutes);
router.use("/items", itemsRoutes);
router.use("/claims", claimsRoutes);
router.use("/admin", adminRoutes);
router.use("/categories", categoriesRoutes);
router.use("/peer", peerRoutes);
router.use("/matches", matchesRoutes);
router.use("/chat", chatRoutes);

module.exports = router;
