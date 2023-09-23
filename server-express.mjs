import express from "express";
import morgan from "morgan";
import createError from "http-errors";
import logger from "loglevel";
import sqlite3 from "sqlite3";
import { config } from "dotenv";
import bodyParser from "body-parser";
import { nanoid } from "nanoid";

config();

const port = process.env.PORT || 8080;
const host = "localhost";

const app = express();

// Pour supporter les corps de requêtes JSON
app.use(bodyParser.json()); 
// Pour supporter les corps de requêtes encodées en URL
app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

logger.setLevel(logger.levels.WARN);

app.set("view engine", "ejs");
if (app.get("env") === "development") app.use(morgan("dev"));


// Simulation d'une base de données pour stocker les liens raccourcis
const database = new sqlite3.Database(process.env.DB_FILE, (error) => {
  if (error) {
    logger.error("Erreur lors de la création de la base de données : " + error.message);
  } else {
    logger.info("Base de données créée avec succès.");
    // Créer la table pour stocker les liens si elle n'existe pas
    database.run(`
      CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shortURL TEXT,
        longURL TEXT
      )
    `);
  }
});

// Fonction pour vérifier la validité d'une URL (fetch)
async function isValidURL(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

// Fonction pour chercher url par son lien raccourci
function findLinkByShortURL(shortURL) {
  return new Promise((resolve, reject) => {
    database.all("SELECT * FROM links WHERE shortURL = ?", [shortURL], (error, rows) => {
      if (error) {
        reject(error);
      } else {
        // Assuming shortURL is unique, return the first result
        resolve(rows[0]);
      }
    });
  });
}

// Fonction pour générer un lien raccourci (à personnaliser)
async function generateShortURL() {
  let url = `http://${host}:${port}/` + nanoid(7);
  while (await findLinkByShortURL(url)) url = `http://${host}:${port}/` + nanoid(7);
  return url;
}
// REDIRECTIONS

// menu principal
app.get("/", (request, res) => {
  // Render le template EJS
  res.render("index", { shortURL: "", urlInvalid: false, dbError: false });
});

// Route POST / qui crée un lien réduit à partir d'une URL longue
app.post("/", async (request, res) => {
  if (!(await isValidURL(request.body.longURL))) {
    // Redirigez vers la page principale avec un message d'erreur type url invalide
    return res.redirect(`/error?urlInvalid=true`);
  }

  // générer le lien
  const shortURL = await generateShortURL();

  // Ajoute dans la db
  database.run("INSERT INTO links (shortURL, longURL) VALUES (?, ?)", [shortURL, request.body.longURL], (error) => {
    if (error) {
      // Redirigez vers la page principale avec un message d'erreur type sql connection
      return res.redirect(`/error?dbError=true`);
    }
    // sinon Redirigez vers la page principale avec le message de succès
    res.redirect(`/success?shortURL=${shortURL}`);
  });
});

// cration avec succès
app.get("/success", (request, res) => {
  res.render("index", { shortURL: request.query.shortURL, urlInvalid: false, urlExists: false, dbError: false });
});

app.get("/error", async (request, res, next) => {
  res.render("index", { shortURL: "", urlInvalid: request.query.urlInvalid === "true", dbError: request.query.dbError === "true" });
});

// suppression d'un lien raccourci
app.get("/delete/:url", async (request, res) => {
  database.run("DELETE FROM links WHERE shortURL = ?", [`http://${host}:${port}/` + request.params.url], (error) => {
    if (error) {
      return res.status(500).json({ error: "Erreur lors de la suppression du lien." });
    }
    return res.json({ message: "Lien supprimé avec succès." });
  });
});

// rechercher un lien
app.post("/search", async (request, res, next) => {
  // pour récupérer la valeur du champ de recherche
  const query = request.body.query; 

  try {
    // Effectuer une recherche dans la base de données en fonction de la valeur de query
    // Recherche dans les URL courtes et longues
    const searchResult = await new Promise((resolve, reject) => {
      database.all(
        `SELECT * FROM links WHERE shortURL LIKE ? OR longURL LIKE ?`,
        [`%${query}%`, `%${query}%`],
        (error, rows) => {
          if (error) {
            reject(error);
          } else {
            resolve(rows);
          }
        },
      );
    });
    // Render la page de résultats de recherche
    return res.render("links", { text: `Résultats de la recherche pour "${query}"`, links: searchResult });
  } catch (error) {
    return next(error);
  }
});

// afficher tous les liens
app.get("/status", async (request, res, next) => {
  try {
    database.all("SELECT * FROM links", (error, rows) => {
      if (error) {
        // DB erreur
        return next(createError(500, "Erreur lors de la récupération des liens depuis la base de données."));
      }
      //revoie la liste des liens générés
      return res.render("links", { text: "Liste des liens.", links: rows });
    });
  } catch (error) {
    // Autres erreurs
    return next(createError(500, "Une erreur inattendue s'est produite."));
  }
});

// Route GET /status/:url qui donne l'état du lien
app.get("/status/:url", async (request, res, next) => {
  const linkInfo = await findLinkByShortURL(`http://${host}:${port}/` + request.params.url.split("/").pop());
  if (!linkInfo) {
    return next(createError(404, "Lien invalide..."));
  }
  return res.render("links", { text: `Lien ${linkInfo.shortURL}`, links: [linkInfo] });
});

// redirections vers les liens
app.get("/:url", async (request, res, next) => {
  const shortURL = `http://${host}:${port}/${request.params.url}`;

  try {
    // Vérifier si le lien raccourci existe
    const linkInfo = await findLinkByShortURL(shortURL);
    if (!linkInfo) {
      return next(createError(404, "URL non existant dans la BDD."));
    }
    // Redirect to the original long URL
    res.redirect(linkInfo.longURL);
  } catch (error) {
    return next(error);
  }
});

const server = app.listen(port, host);

server.on("listening", () =>
  logger.warn(`HTTP listening on http://${host}:${server.address().port} with mode '${process.env.NODE_ENV}'`),
);

app.use((request, response, next) => {
  logger.debug(`default route handler : ${request.url}`);
  return next(createError(404));
});

app.use((error, _request, response, _next) => {
  logger.debug(`default error handler: ${error}`);
  const status = error.status || 500;
  const stack = app.get("env") === "development" ? error.stack : "";
  const result = { code: status, message: error.message, stack };
  response.status(status).render("error", result);
});

logger.info(`File ${import.meta.url} executed.`);
