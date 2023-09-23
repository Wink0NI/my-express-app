const ejs = require("ejs");
const fs = require("fs");

exports.handler = async (event, context) => {
  try {
    // Chemin vers le fichier EJS
    const ejsFilePath = `${process.env.LAMBDA_TASK_ROOT}/views/index.ejs`;


    // Lire le contenu du fichier EJS
    const ejsContent = fs.readFileSync(ejsFilePath, "utf-8");

    // Rendre le fichier EJS en utilisant les données que vous souhaitez passer
    const renderedHtml = ejs.render(ejsContent, {
      shortURL: "",
      urlInvalid: false,
      dbError: false,
    });

    // Retourner la réponse au format HTML
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
      },
      body: renderedHtml,
    };
  } catch (error) {
    // Gérer les erreurs
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Une erreur s'est produite lors du rendu de la page." }),
    };
  }
};
