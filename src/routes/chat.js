const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// POST /api/chat
router.post("/", authenticate, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const userText = req.body.message;
    if (!userText || typeof userText !== 'string') {
      return res.status(400).json({ error: "Message is required." });
    }

    const promptContext = `
      You are a helpful and friendly AI assistant for a university "Lost and Found" web application.
      The user is a student.
      Keep your answers concise and relevant to finding lost items, reporting lost items, or checking the status of claims.
      Do not provide complex code or unrelated information.
      User's message: ${userText}
    `;

    const result = await model.generateContent(promptContext);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ text });
  } catch (error) {
    console.error("Error generating AI response:", error);
    return res.status(500).json({ error: "Failed to generate AI response." });
  }
});

module.exports = router;
