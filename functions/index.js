const express = require("express");
const app = express();
const path = require("path");
const ejs = require("ejs"); // Importez le module EJS

// Configurez Express pour utiliser EJS comme moteur de modèle
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // Spécifiez le chemin vers le dossier "views"

// ... (autres configurations et routes Express)

// Exemple de route pour rendre la vue index.ejs
app.get("/", (request, res) => {
  res.render("index", { shortURL: "", urlInvalid: false, dbError: false });
});

// ... (autres routes)

exports.handler = async (event, context) => {
  const { httpMethod, path, body } = event;
  const request = {
    method: httpMethod,
    path,
    body: body || null,
    query: event.queryStringParameters || {},
    headers: event.headers,
  };

  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
      },
      body: "",
    };

    const originalSend = app.response.send;
    app.response.send = function (body) {
      response.body += body;
      originalSend.apply(this, arguments);
    };

    app(request, response);

    app.response.send = function (body) {
      response.body += body;
      resolve(response);
    };
  });
};
