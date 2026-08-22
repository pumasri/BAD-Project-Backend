require("dotenv").config();

const { validateEnvironment } = require("./config/env");

validateEnvironment();

const app = require("./app");

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
