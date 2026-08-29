const express = require("express");
const crypto = require("node:crypto");
const prisma = require("../config/prisma");

const router = express.Router();

// Middleware to authenticate partner via x-api-key
async function authenticatePartner(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  
  if (!apiKey || typeof apiKey !== "string") {
    return res.status(401).json({ success: false, message: "Missing API key" });
  }
  
  try {
    const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    
    const partner = await prisma.partnerClient.findFirst({
      where: { apiKeyHash, isActive: true }
    });
    
    if (!partner) {
      return res.status(401).json({ success: false, message: "Invalid API key" });
    }
    
    req.partner = partner;
    next();
  } catch (error) {
    next(error);
  }
}

// POST /api/peer/sync
router.post("/sync", authenticatePartner, async (req, res, next) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "items must be an array" });
    }
    
    // In a real scenario, this would upsert items into a peer-synced table 
    // or integrate them directly into our ItemReport table depending on the architecture.
    // For now, we acknowledge receipt.
    
    res.json({
      success: true,
      message: "Sync successful",
      count: items.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
