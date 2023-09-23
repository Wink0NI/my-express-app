// myFunction.js
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.json({ message: "Hello from Express.js serverless function!" });
});

module.exports.handler = async (event, context) => {
  return require("serverless-http")(app)(event, context);
};
