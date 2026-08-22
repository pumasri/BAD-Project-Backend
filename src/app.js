const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const apiRoutes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(helmet());
app.use(cors({ origin: frontendUrl }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Campus Lost & Found API is running"
  });
});

app.use("/api", apiRoutes);

app.use(errorHandler);

module.exports = app;
