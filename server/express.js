// functions/express.js
const express = require("express");
const serverless = require("serverless-http");

const app = express();
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Hello from Express.js serverless function!" });
});

app.use(`/.netlify/functions/express`, router);

module.exports.handler = serverless(app);
