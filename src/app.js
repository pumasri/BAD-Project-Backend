const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const apiRoutes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({ origin: frontendUrl }));
app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Campus Lost & Found API is running"
  });
});

app.use("/api", apiRoutes);

app.use(errorHandler);

module.exports = app;
