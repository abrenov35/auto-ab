const CONFIG = {

  SHEET_ID: "1fC7O-GIKq1qX81JP8EzDS1tXnBhVZKXX9unTYHZB79Y",

  DRIVE_FOLDER_ID: "1RfbDWQf6ksMBLESuzum-OJRGCDwYSgEL",
  ALERTE_EMAIL: "abrenov03@gmail.com",
  SITE_URL: "https://abrenov35.github.io/auto-ab/"

};





/* =========================================================

   OUTILS

========================================================= */



function jsonResponse_(data) {

  return ContentService

    .createTextOutput(JSON.stringify(data))

    .setMimeType(ContentService.MimeType.JSON);

}



function todayIso_() {

  return Utilities.formatDate(

    new Date(),

    Session.getScriptTimeZone() || "Europe/Paris",

    "yyyy-MM-dd"

  );

}



function nowIso_() {

  return new Date().toISOString();

}



function safeString_(value) {

  return value === null || value === undefined ? "" : String(value);

}



function findRowById_(sheet, id, idColumnIndexZeroBased) {

  if (!sheet || !id) return -1;



  const values = sheet.getDataRange().getValues();



  for (let i = 1; i < values.length; i++) {

    if (String(values[i][idColumnIndexZeroBased]) === String(id)) {

      return i + 1;

    }

  }



  return -1;

}



function findVehicleByImmat_(sheet, immatriculation) {

  if (!sheet || !immatriculation) return -1;



  const values = sheet.getDataRange().getValues();



  for (let i = 1; i < values.length; i++) {

    if (String(values[i][1]).trim() === String(immatriculation).trim()) {

      return i + 1;

    }

  }



  return -1;

}





/* =========================================================

   GET — LECTURE COMPLÈTE

========================================================= */



function doGet(e) {

  try {
    verifierSessionParc_(e && e.parameter && e.parameter.token);

    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);



    const vehicules = lireVehicules_(ss);

    const revisions = lireRevisions_(ss);

    const controlsTk = lireControlsTk_(ss);

    const documents = lireDocuments_(ss);
    const historiqueKilometrage = lireHistoriqueParc_(ss, "Historique kilométrage");
    const historiqueAffectations = lireHistoriqueParc_(ss, "Historique affectations");
    const maintenance = lireMaintenance_(ss);
    const historiqueCt = lireHistoriqueCt_(ss);



    const categories = [

      { id: "1", nom: "Révision", couleur: "#4CAF50" },

      { id: "2", nom: "Contrôle Technique", couleur: "#2196F3" },

      { id: "3", nom: "Maintenance", couleur: "#FF9800" },

      { id: "4", nom: "Carte grise", couleur: "#607D8B" },

      { id: "5", nom: "Entretien coût", couleur: "#795548" }

    ];



    return jsonResponse_({

      ok: true,

      success: true,

      vehicules,

      revisions,

      controlsTk,

      documents,
      historiqueKilometrage,
      historiqueAffectations,
      maintenance,
      historiqueCt,

      categories

    });



  } catch (error) {

    console.error("ERREUR doGet:", error);



    return jsonResponse_({

      ok: false,

      success: false,

      error: error.message || String(error),

      message: "Erreur lors de la lecture des données"

    });

  }

}





/* =========================================================

   LECTURE VÉHICULES

========================================================= */



function lireVehicules_(ss) {

  const sheet = ss.getSheetByName("Véhicules");

  if (!sheet) throw new Error("Feuille 'Véhicules' introuvable");



  const values = sheet.getDataRange().getValues();

  const result = [];



  for (let i = 1; i < values.length; i++) {

    const row = values[i];



    if (!row[1]) continue;



    result.push({

      id: row[0] || "",

      immatriculation: row[1] || "",

      marque: row[2] || "",

      modele: row[3] || "",

      annee: row[4] || "",

      conducteur: row[5] || "",

      kilometrage: row[6] || "",

      statut: row[7] || "",

      dateAchat: row[8] || "",

      dateSortie: row[9] || "",

      dateCreation: row[10] || "",

      dateModification: row[11] || "",

      lienPhoto: row[12] || "",

      lienCarteGrise: row[13] || ""

    });

  }



  return result;

}





/* =========================================================

   LECTURE RÉVISIONS

========================================================= */



function lireRevisions_(ss) {

  const sheet = ss.getSheetByName("Révisions");

  if (!sheet) throw new Error("Feuille 'Révisions' introuvable");



  const values = sheet.getDataRange().getValues();

  const result = [];



  for (let i = 1; i < values.length; i++) {

    const row = values[i];



    if (!row[1]) continue;



    result.push({

      id: row[0] || "",

      idVehicule: row[1] || "",

      dateDerniereRevision: dateIsoSheet_(row[2]),

      dateProchaineRevision: dateIsoSheet_(row[3]),

      kilometrage: row[4] || "",

      typeRevision: row[5] || "",

      statut: row[6] || "",

      observations: row[7] || "",

      dateCreation: row[8] || "",

      dateModification: row[9] || "",

      lienFacture: row[10] || "",

      immatriculation: row[11] || "",

      conducteur: row[12] || "",
      alerteMailAcquittee: Boolean(row[3] && row[13] && dateIsoSheet_(row[13]) === dateIsoSheet_(row[3]))

    });

  }



  return result;

}





/* =========================================================

   LECTURE CONTRÔLES TECHNIQUES

========================================================= */



function lireControlsTk_(ss) {

  const sheet = ss.getSheetByName("Contrôles techniques");

  if (!sheet) {

    throw new Error("Feuille 'Contrôles techniques' introuvable");

  }



  const values = sheet.getDataRange().getValues();

  const result = [];



  for (let i = 1; i < values.length; i++) {

    const row = values[i];



    if (!row[1]) continue;



    result.push({

      id: row[0] || "",

      idVehicule: row[1] || "",

      immatriculation: row[2] || "",

      dateDernierCT: dateIsoSheet_(row[3]),

      dateProchainCT: dateIsoSheet_(row[4]),

      lienCT: row[5] || "",

      dateCreation: row[6] || "",

      dateModification: row[7] || "",

      statut: row[8] || "",
      alerteMailAcquittee: Boolean(row[4] && row[9] && dateIsoSheet_(row[9]) === dateIsoSheet_(row[4]))

    });

  }



  return result;

}





/* =========================================================

   LECTURE DOCUMENTS

   Structure attendue :

   A ID

   B VehiculeID / immatriculation

   C Type / catégorie

   D Nom

   E Description

   F Date

   G Date création

   H Lien Drive

   I Drive ID

========================================================= */



function lireDocuments_(ss) {

  const sheet = ss.getSheetByName("Documents Véhicules");



  if (!sheet) {

    throw new Error("Feuille 'Documents Véhicules' introuvable");

  }



  const values = sheet.getDataRange().getValues();

  const result = [];



  for (let i = 1; i < values.length; i++) {

    const row = values[i];



    if (

      !row[0] &&

      !row[1] &&

      !row[3] &&

      !row[7] &&

      !row[8]

    ) {

      continue;

    }



    result.push({

      id: row[0] || row[8] || "",

      idDocument: row[0] || row[8] || "",

      idVehicule: row[1] || "",

      immatriculation: row[1] || "",

      categorie: row[2] || "Document",

      type: row[2] || "Document",

      nom: row[3] || "",

      nomFichier: row[3] || "",

      description: row[4] || "",

      date: row[5] || "",

      dateCreation: row[6] || "",

      dateUpload: row[6] || "",

      lienDrive: row[7] || "",

      lien: row[7] || "",

      driveId: row[8] || "",

      statut: "Actif"

    });

  }



  return result;

}





/* =========================================================

   POST — ROUTEUR

========================================================= */



function doPost(e) {

  try {

    if (!e || !e.postData || !e.postData.contents) {

      throw new Error("Aucune donnée reçue");

    }



    const p = JSON.parse(e.postData.contents);

    const action = String(p.action || "").trim();

    if (action === "loginAndReadParc") {
      const auth = JSON.parse(connecterParc_(p).getContent());
      const parc = JSON.parse(doGet({parameter: {token: auth.token}}).getContent());
      if (!parc.ok) return jsonResponse_(parc);
      return jsonResponse_(Object.assign({}, parc, {token: auth.token}));
    }
    if (action === "loginParc") return connecterParc_(p);
    verifierSessionParc_(p.token);
    if (action === "readParc") return doGet({parameter: {token: p.token}});
    if (action === "getMailSettings") return lireParametresMail_();
    if (action === "saveMailSettings") return enregistrerParametresMail_(p);



    console.log("ACTION:", action);




    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);



    if (["readExpenses","saveExpenseInvoice","cancelExpenseInvoice","saveExpensePerson","saveExpenseMapping","setExpenseCompletion"].includes(action)) return depHandle_(ss, p);

    switch (action) {



      case "uploadFile":

        return uploadFile_(p);



      case "uploadDocument":

        return uploadDocument_(ss, p);

      case "uploadCtFile":
        return uploadControleTk_(ss, p);

      case "loadDocumentsCt":
        return chargerDocumentsControleTk_(ss, p);



      case "createDocument":

        return createDocument_(ss, p);



      case "updateDocument":

        return updateDocument_(ss, p);



      case "deleteDocument":

        return deleteDocument_(ss, p);



      case "update":

        return legacyUpdateDocument_(ss, p);



      case "delete":

        return legacyDeleteDocument_(ss, p);



      case "createVehicule":

        return createVehicule_(ss, p);



      case "updateVehicule":

        return updateVehicule_(ss, p);



      case "deleteVehicule":
        return archiveVehicule_(ss, p);

      case "archiveVehicule":
        return archiveVehicule_(ss, p);
      case "restoreVehicule":
        return restaurerVehicule_(ss, p);
      case "createMaintenance":
        return creerMaintenance_(ss, p);
      case "archiveMaintenance":
      case "restoreMaintenance":
        return statutMaintenance_(ss, p, action === "archiveMaintenance");

      case "createRevision":

        return enregistrerRevision_(ss, p, false);

      case "updateRevision":

        return enregistrerRevision_(ss, p, true);

      case "deleteRevision":
        return changerStatutSuivi_(ss, p, "Révisions", true);
      case "nouvelleRevision":
        return nouvelleRevision_(ss, p);

      case "createControleTk":
        return enregistrerControleTk_(ss, p, false);
      case "updateControleTk":
        return enregistrerControleTk_(ss, p, true);
      case "archiveRevision":
      case "restoreRevision":
        return changerStatutSuivi_(ss, p, "Révisions", action === "archiveRevision");
      case "archiveControleTk":
      case "restoreControleTk":
        return changerStatutSuivi_(ss, p, "Contrôles techniques", action === "archiveControleTk");
      case "setAlerteMail":
        return acquitterAlerteMail_(ss, p);



      default:

        /*

          Compatibilité avec l'ancien backend :

          si file + name sont fournis sans action connue,

          on traite comme un upload document.

        */

        if ((p.file || p.fileBase64) && (p.name || p.fileName || p.filename)) {

          return uploadDocument_(ss, p);

        }



        return jsonResponse_({

          ok: false,

          success: false,

          message: "Action inconnue : " + action

        });

    }



  } catch (error) {

    console.error("ERREUR doPost:", error);



    return jsonResponse_({

      ok: false,

      success: false,

      error: error.message || String(error),

      message: error.message || String(error)

    });

  }

}





/* =========================================================

   UPLOAD FICHIER SEUL

========================================================= */



function uploadFile_(p) {



  const base64 =

    p.fileBase64 ||

    p.file ||

    "";



  const fileName =

    p.fileName ||

    p.filename ||

    p.name ||

    "";



  const mimeType =

    p.mimeType ||

    p.fileType ||

    "application/octet-stream";



  if (!base64) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "Fichier manquant"

    });

  }



  if (!fileName) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "Nom du fichier manquant"

    });

  }



  const blob = Utilities.newBlob(

    Utilities.base64Decode(base64),

    mimeType,

    fileName

  );



  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);

  const file = folder.createFile(blob);



  file.setSharing(

    DriveApp.Access.ANYONE_WITH_LINK,

    DriveApp.Permission.VIEW

  );



  return jsonResponse_({

    ok: true,

    success: true,

    message: "Fichier ajouté",

    url: file.getUrl(),

    fileUrl: file.getUrl(),

    lienDrive: file.getUrl(),

    fileId: file.getId()

  });

}





/* =========================================================

   UPLOAD + CRÉATION DOCUMENT

========================================================= */



function uploadDocument_(ss, p) {



  const base64 =

    p.fileBase64 ||

    p.file ||

    "";



  const fileName =

    p.fileName ||

    p.filename ||

    p.name ||

    "";



  if (!base64) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "Fichier manquant"

    });

  }



  if (!fileName) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "Nom du fichier manquant"

    });

  }



  const mimeType =

    p.mimeType ||

    p.fileType ||

    "application/octet-stream";



  // Contrôler la date avant la création du fichier Drive.
  const dateDocument = p.date ? validerDateSuivi_(p.date, "Date du document") : todayIso_();

  const blob = Utilities.newBlob(

    Utilities.base64Decode(base64),

    mimeType,

    fileName

  );



  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);

  const file = folder.createFile(blob);



  file.setSharing(

    DriveApp.Access.ANYONE_WITH_LINK,

    DriveApp.Permission.VIEW

  );



  const payload = {

    idVehicule:

      p.idVehicule ||

      p.immatriculation ||

      p.vehicule ||

      "",



    immatriculation:

      p.immatriculation ||

      p.idVehicule ||

      p.vehicule ||

      "",



    categorie:

      p.categorie ||

      p.typeDocument ||

      "Document",



    nom:

      p.nom ||

      p.name ||

      fileName,



    nomFichier:

      p.nomFichier ||

      fileName,



    date: dateDocument,



    description:

      p.description ||

      p.desc ||

      "",



    lienDrive: file.getUrl(),

    driveId: file.getId()

  };



  const result = createDocumentInternal_(ss, payload);



  return jsonResponse_({

    ok: true,

    success: true,

    message: "Document ajouté",

    id: result.id,

    idDocument: result.id,

    url: file.getUrl(),

    lienDrive: file.getUrl(),

    fileId: file.getId()

  });

}





/* =========================================================

   CRÉER DOCUMENT SANS OBLIGATION DE FICHIER

========================================================= */



function createDocument_(ss, p) {



  const result = createDocumentInternal_(ss, {

    idVehicule:

      p.idVehicule ||

      p.immatriculation ||

      "",



    immatriculation:

      p.immatriculation ||

      p.idVehicule ||

      "",



    categorie:

      p.categorie ||

      p.typeDocument ||

      "Document",



    nom:

      p.nom ||

      p.nomFichier ||

      "Document",



    nomFichier:

      p.nomFichier ||

      p.nom ||

      "Document",



    date:

      p.date ||

      todayIso_(),



    description:

      p.description ||

      p.desc ||

      "",



    lienDrive:

      p.lienDrive ||

      p.url ||

      "",



    driveId:

      p.driveId ||

      p.fileId ||

      ""

  });



  return jsonResponse_({

    ok: true,

    success: true,

    message: "Document créé",

    id: result.id,

    idDocument: result.id

  });

}





function createDocumentInternal_(ss, p) {



  const sheet = ss.getSheetByName("Documents Véhicules");



  if (!sheet) {

    throw new Error("Feuille 'Documents Véhicules' introuvable");

  }



  const id =

    p.driveId ||

    Utilities.getUuid();



  const immatriculation =

    p.immatriculation ||

    p.idVehicule ||

    "";



  sheet.appendRow([

    id,

    immatriculation,

    p.categorie || "Document",

    p.nom || p.nomFichier || "Document",

    p.description || "",

    p.date ? validerDateSuivi_(p.date, "Date du document") : todayIso_(),

    nowIso_(),

    p.lienDrive || "",

    p.driveId || ""

  ]);



  return {

    id

  };

}





/* =========================================================

   MODIFIER DOCUMENT

========================================================= */



function updateDocument_(ss, p) {



  const sheet = ss.getSheetByName("Documents Véhicules");



  if (!sheet) {

    throw new Error("Feuille 'Documents Véhicules' introuvable");

  }



  if (!p.id) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "ID document manquant"

    });

  }



  const values = sheet.getDataRange().getValues();



  let rowIndex = -1;



  for (let i = 1; i < values.length; i++) {

    if (

      String(values[i][0]) === String(p.id) ||

      String(values[i][8]) === String(p.id)

    ) {

      rowIndex = i + 1;

      break;

    }

  }



  if (rowIndex === -1) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "Document introuvable"

    });

  }



  const current = sheet

    .getRange(rowIndex, 1, 1, 9)

    .getValues()[0];



  const newValues = [[

    current[0],



    p.immatriculation ||

    p.idVehicule ||

    current[1],



    p.categorie ||

    p.typeDocument ||

    current[2],



    p.nom ||

    p.nomFichier ||

    current[3],



    p.description !== undefined

      ? p.description

      : (

          p.desc !== undefined

            ? p.desc

            : current[4]

        ),



    p.date !== undefined

      ? validerDateSuivi_(p.date, "Date du document")

      : current[5],



    current[6] || nowIso_(),



    p.lienDrive !== undefined

      ? p.lienDrive

      : (

          p.url !== undefined

            ? p.url

            : current[7]

        ),



    p.driveId ||

    p.fileId ||

    current[8]

  ]];



  sheet

    .getRange(rowIndex, 1, 1, 9)

    .setValues(newValues);



  return jsonResponse_({

    ok: true,

    success: true,

    message: "Document modifié",

    id: p.id

  });

}





/* =========================================================

   SUPPRIMER DOCUMENT

========================================================= */



function deleteDocument_(ss, p) {



  const sheet = ss.getSheetByName("Documents Véhicules");



  if (!sheet) {

    throw new Error("Feuille 'Documents Véhicules' introuvable");

  }



  if (!p.id) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "ID document manquant"

    });

  }



  const values = sheet.getDataRange().getValues();



  for (let i = 1; i < values.length; i++) {



    const rowId = values[i][0];

    const driveId = values[i][8];



    if (

      String(rowId) === String(p.id) ||

      String(driveId) === String(p.id)

    ) {



      if (driveId) {

        try {

          DriveApp

            .getFileById(String(driveId))

            .setTrashed(true);

        } catch (error) {

          console.warn(

            "Impossible de supprimer le fichier Drive:",

            error

          );

        }

      }



      sheet.deleteRow(i + 1);



      return jsonResponse_({

        ok: true,

        success: true,

        message: "Document supprimé"

      });

    }

  }



  return jsonResponse_({

    ok: false,

    success: false,

    message: "Document introuvable"

  });

}





/* =========================================================

   COMPATIBILITÉ ANCIENNES ACTIONS UPDATE / DELETE

========================================================= */



function legacyUpdateDocument_(ss, p) {



  return updateDocument_(ss, {

    id: p.id,

    nom: p.name,

    description: p.desc

  });

}





function legacyDeleteDocument_(ss, p) {



  return deleteDocument_(ss, {

    id: p.id

  });

}





/* =========================================================

   VÉHICULES

========================================================= */



function createVehicule_(ss, p) {



  const sheet = ss.getSheetByName("Véhicules");



  if (!sheet) {

    throw new Error("Feuille 'Véhicules' introuvable");

  }



  if (!p.immatriculation) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "Immatriculation manquante"

    });

  }



  const existingRow =

    findVehicleByImmat_(

      sheet,

      p.immatriculation

    );



  if (existingRow !== -1) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "Ce véhicule existe déjà"

    });

  }



  const id = Utilities.getUuid();



  sheet.appendRow([

    id,

    p.immatriculation || "",

    p.marque || "",

    p.modele || "",

    p.annee || "",

    p.conducteur || "",

    p.kilometrage || "",

    p.statut || "Actif",

    p.dateAchat || "",

    "",

    nowIso_(),

    nowIso_(),

    p.lienPhoto || "",

    p.lienCarteGrise || ""

  ]);

  if (p.kilometrage !== undefined && p.kilometrage !== "") {
    ajouterHistoriqueParc_(ss, "Historique kilométrage",
      [nowIso_(), id, p.immatriculation, "", p.kilometrage]);
  }
  if (p.conducteur) {
    ajouterHistoriqueParc_(ss, "Historique affectations",
      [nowIso_(), id, p.immatriculation, "", p.conducteur]);
  }



  return jsonResponse_({

    ok: true,

    success: true,

    message: "Véhicule créé",

    id,

    immatriculation: p.immatriculation

  });

}





/* =========================================================

   MODIFIER VÉHICULE

========================================================= */



function updateVehicule_(ss, p) {



  const sheet = ss.getSheetByName("Véhicules");



  if (!sheet) {

    throw new Error("Feuille 'Véhicules' introuvable");

  }



  const oldImmat =

    p.ancienneImmatriculation ||

    p.immatriculation;



  if (!oldImmat) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "Immatriculation manquante"

    });

  }



  const rowIndex =

    findVehicleByImmat_(sheet, oldImmat);



  if (rowIndex === -1) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "Véhicule introuvable"

    });

  }



  const current =

    sheet

      .getRange(rowIndex, 1, 1, 14)

      .getValues()[0];

  const nouveauKm = p.kilometrage !== undefined && p.kilometrage !== "" ?
    p.kilometrage : current[6];
  if (nouveauKm !== "" && (!Number.isFinite(Number(nouveauKm)) || Number(nouveauKm) < 0)) {
    throw new Error("Kilométrage invalide");
  }
  const nouveauConducteur = p.conducteur !== undefined ? p.conducteur : current[5];



  sheet

    .getRange(rowIndex, 1, 1, 14)

    .setValues([[

      current[0],

      p.immatriculation || current[1],

      p.marque !== undefined ? p.marque : current[2],

      p.modele !== undefined ? p.modele : current[3],

      p.annee !== undefined ? p.annee : current[4],

      p.conducteur !== undefined ? p.conducteur : current[5],

      nouveauKm,

      p.statut !== undefined ? p.statut : current[7],

      current[8],

      current[9],

      current[10],

      nowIso_(),

      current[12],

      current[13]

    ]]);

  if (String(nouveauKm) !== String(current[6])) {
    ajouterHistoriqueParc_(ss, "Historique kilométrage",
      [nowIso_(), current[0], p.immatriculation || current[1], current[6], nouveauKm]);
  }
  if (String(nouveauConducteur) !== String(current[5])) {
    ajouterHistoriqueParc_(ss, "Historique affectations",
      [nowIso_(), current[0], p.immatriculation || current[1], current[5], nouveauConducteur]);
  }



  return jsonResponse_({

    ok: true,

    success: true,

    message: "Véhicule modifié",

    immatriculation:

      p.immatriculation ||

      current[1]

  });

}





/* =========================================================

   SUPPRIMER VÉHICULE

========================================================= */



function deleteVehicule_(ss, p) {



  const sheet = ss.getSheetByName("Véhicules");



  if (!sheet) {

    throw new Error("Feuille 'Véhicules' introuvable");

  }



  if (!p.immatriculation) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "Immatriculation manquante"

    });

  }



  const rowIndex =

    findVehicleByImmat_(

      sheet,

      p.immatriculation

    );



  if (rowIndex === -1) {

    return jsonResponse_({

      ok: false,

      success: false,

      message: "Véhicule introuvable"

    });

  }



  sheet.deleteRow(rowIndex);



  return jsonResponse_({

    ok: true,

    success: true,

    message: "Véhicule supprimé"

  });

}

/* =========================================================
   CRÉER / MODIFIER UNE RÉVISION
========================================================= */

function enregistrerRevision_(ss, p, modification) {
  const sheet = ss.getSheetByName("Révisions");
  const vehicules = ss.getSheetByName("Véhicules");
  if (!sheet || !vehicules) throw new Error("Feuille Révisions ou Véhicules introuvable");

  const normaliser = value => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const immat = String(p.immatriculation || "").trim();
  if (!immat) throw new Error("Immatriculation manquante");

  const verifierDate = (valeur, libelle) => {
    if (valeur === null || valeur === undefined || valeur === "") return "";
    const texte = String(valeur).trim();
    // Le champ HTML type=date transmet aaaa-mm-jj. L'affichage français est jj/mm/aaaa.
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte);
    const francais = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texte);
    if (!iso && !francais) {
      throw new Error(libelle + " : date non conforme (jj/mm/aaaa)");
    }
    const annee = Number(iso ? iso[1] : francais[3]);
    const mois = Number(iso ? iso[2] : francais[2]);
    const jour = Number(iso ? iso[3] : francais[1]);
    const controle = new Date(Date.UTC(annee, mois - 1, jour));
    if (annee < 1900 || annee > 2100 || controle.getUTCFullYear() !== annee ||
        controle.getUTCMonth() !== mois - 1 || controle.getUTCDate() !== jour) {
      throw new Error(libelle + " : date impossible (jj/mm/aaaa)");
    }
    // Format stable pour les champs date de l'interface.
    return [annee, String(mois).padStart(2, "0"), String(jour).padStart(2, "0")].join("-");
  };
  const dernierDate = verifierDate(p.dernierDate, "Dernière révision");
  const prochainDate = verifierDate(p.prochainDate, "Prochaine révision");

  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const lignesVehicules = vehicules.getDataRange().getValues();
    const vehicule = lignesVehicules.slice(1).find(
      ligne => normaliser(ligne[1]) === normaliser(immat)
    );
    if (!vehicule) throw new Error("Véhicule introuvable : " + immat);

    const lignes = sheet.getDataRange().getValues();
    const index = lignes.findIndex((ligne, i) =>
      i > 0 && normaliser(ligne[11]) === normaliser(immat) && ligne[6] !== "Archivé"
    );

    if (modification && index < 0) throw new Error("Révision à modifier introuvable");
    if (!modification && index >= 0) throw new Error("Une révision existe déjà pour ce véhicule");

    if (modification) {
      const numero = index + 1;
      const dateExistante = validerDateSuivi_(lignes[index][2], "Dernière révision");
      if (dernierDate !== dateExistante) {
        throw new Error("La dernière révision effectuée ne peut pas être modifiée");
      }
      sheet.getRange(numero, 4).setValue(prochainDate);
      sheet.getRange(numero, 10).setValue(nowIso_());
      sheet.getRange(numero, 13).setValue(vehicule[5] || "");
    } else {
      sheet.appendRow([
        Utilities.getUuid(), vehicule[0], dernierDate,
        prochainDate, "", "", "Actif", "",
        nowIso_(), nowIso_(), "", vehicule[1], vehicule[5] || ""
      ]);
    }
    SpreadsheetApp.flush();
    return jsonResponse_({ ok: true, success: true });
  } finally {
    verrou.releaseLock();
  }
}

function validerDateSuivi_(valeur, libelle) {
  if (valeur === null || valeur === undefined || valeur === "") return "";
  if (Object.prototype.toString.call(valeur) === "[object Date]" && !isNaN(valeur.getTime())) {
    valeur = Utilities.formatDate(valeur, "Europe/Paris", "yyyy-MM-dd");
  }
  const texte = String(valeur).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte);
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texte);
  if (!iso && !fr) throw new Error(libelle + " : date non conforme (jj/mm/aaaa)");
  const annee = Number(iso ? iso[1] : fr[3]);
  const mois = Number(iso ? iso[2] : fr[2]);
  const jour = Number(iso ? iso[3] : fr[1]);
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  if (annee < 1900 || annee > 2100 || date.getUTCFullYear() !== annee ||
      date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) {
    throw new Error(libelle + " : date impossible (jj/mm/aaaa)");
  }
  return [annee, String(mois).padStart(2, "0"), String(jour).padStart(2, "0")].join("-");
}

function normaliserPlaqueSuivi_(valeur) {
  return String(valeur || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function enregistrerControleTk_(ss, p, modification) {
  const sheet = ss.getSheetByName("Contrôles techniques");
  const vehicules = ss.getSheetByName("Véhicules");
  if (!sheet || !vehicules) throw new Error("Feuille de suivi introuvable");
  const plaque = normaliserPlaqueSuivi_(p.immatriculation);
  if (!plaque) throw new Error("Immatriculation manquante");
  const dernier = validerDateSuivi_(p.dernierDate, "Dernier contrôle technique");
  const prochain = validerDateSuivi_(p.prochainDate, "Prochain contrôle technique");
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const vehicule = vehicules.getDataRange().getValues().slice(1)
      .find(ligne => normaliserPlaqueSuivi_(ligne[1]) === plaque);
    if (!vehicule) throw new Error("Véhicule introuvable : " + p.immatriculation);
    const lignes = sheet.getDataRange().getValues();
    const index = lignes.findIndex((ligne, i) => i > 0 &&
      normaliserPlaqueSuivi_(ligne[2]) === plaque && ligne[8] !== "Archivé");
    if (modification && index < 0) throw new Error("Contrôle technique à modifier introuvable");
    if (!modification && index >= 0) throw new Error("Un contrôle technique existe déjà pour ce véhicule");
    if (modification) {
      if (dernier !== validerDateSuivi_(lignes[index][3], "Dernier contrôle technique")) {
        throw new Error("Le dernier contrôle effectué ne peut pas être modifié");
      }
      sheet.getRange(index + 1, 5).setValue(prochain);
      sheet.getRange(index + 1, 8).setValue(nowIso_());
    } else {
      sheet.appendRow([Utilities.getUuid(), vehicule[0], vehicule[1], dernier,
        prochain, "", nowIso_(), nowIso_(), "Actif"]);
    }
    SpreadsheetApp.flush();
    return jsonResponse_({ ok: true, success: true });
  } finally {
    verrou.releaseLock();
  }
}

function changerStatutSuivi_(ss, p, nomFeuille, archiver) {
  const sheet = ss.getSheetByName(nomFeuille);
  if (!sheet) throw new Error("Feuille introuvable : " + nomFeuille);
  const plaque = normaliserPlaqueSuivi_(p.immatriculation);
  if (!plaque) throw new Error("Immatriculation manquante");
  const colonnePlaque = nomFeuille === "Révisions" ? 11 : 2;
  const colonneStatut = nomFeuille === "Révisions" ? 7 : 9;
  const colonneModification = nomFeuille === "Révisions" ? 10 : 8;
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const lignes = sheet.getDataRange().getValues();
    const index = lignes.findIndex((ligne, i) => i > 0 &&
      normaliserPlaqueSuivi_(ligne[colonnePlaque]) === plaque &&
      (!p.id || String(ligne[0]) === String(p.id)) &&
      (archiver ? ligne[colonneStatut - 1] !== "Archivé" : ligne[colonneStatut - 1] === "Archivé"));
    if (index < 0) throw new Error("Enregistrement introuvable : " + p.immatriculation);
    if (!archiver && lignes.some((ligne, i) => i > 0 && i !== index &&
        normaliserPlaqueSuivi_(ligne[colonnePlaque]) === plaque &&
        ligne[colonneStatut - 1] !== "Archivé")) {
      throw new Error("Un suivi actif existe déjà pour ce véhicule");
    }
    if (!archiver && nomFeuille === "Révisions" &&
        String(lignes[index][7] || "").indexOf("[HISTORIQUE_REVISION]") !== -1) {
      throw new Error("Une révision effectuée reste dans l'historique");
    }
    sheet.getRange(index + 1, colonneStatut).setValue(archiver ? "Archivé" : "Actif");
    sheet.getRange(index + 1, colonneModification).setValue(nowIso_());
    SpreadsheetApp.flush();
    return jsonResponse_({ ok: true, success: true });
  } finally {
    verrou.releaseLock();
  }
}

function archiveVehicule_(ss, p) {
  const sheet = ss.getSheetByName("Véhicules");
  if (!sheet) throw new Error("Feuille Véhicules introuvable");
  const plaque = normaliserPlaqueSuivi_(p.immatriculation);
  if (!plaque) throw new Error("Immatriculation manquante");
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const lignes = sheet.getDataRange().getValues();
    const index = lignes.findIndex((ligne, i) => i > 0 && normaliserPlaqueSuivi_(ligne[1]) === plaque);
    if (index < 0) throw new Error("Véhicule introuvable : " + p.immatriculation);
    sheet.getRange(index + 1, 8).setValue("Archivé");
    sheet.getRange(index + 1, 12).setValue(nowIso_());
    SpreadsheetApp.flush();
    return jsonResponse_({ ok: true, success: true });
  } finally {
    verrou.releaseLock();
  }
}

function supprimerRevision_(ss, p) {
  const sheet = ss.getSheetByName("Révisions");
  if (!sheet) throw new Error("Feuille Révisions introuvable");
  const plaque = normaliserPlaqueSuivi_(p.immatriculation);
  if (!plaque) throw new Error("Immatriculation manquante");
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const lignes = sheet.getDataRange().getValues();
    const index = lignes.findIndex((ligne, i) => i > 0 && normaliserPlaqueSuivi_(ligne[11]) === plaque);
    if (index < 0) throw new Error("Révision introuvable : " + p.immatriculation);
    sheet.deleteRow(index + 1);
    SpreadsheetApp.flush();
    return jsonResponse_({ ok: true, success: true });
  } finally {
    verrou.releaseLock();
  }
}

function lireHistoriqueParc_(ss, nom) {
  const feuille = ss.getSheetByName(nom);
  if (!feuille || feuille.getLastRow() < 2) return [];
  return feuille.getRange(2, 1, feuille.getLastRow() - 1, 5).getValues()
    .filter(ligne => ligne[2])
    .map(ligne => ({
      date: ligne[0], idVehicule: ligne[1], immatriculation: ligne[2],
      ancien: ligne[3], nouveau: ligne[4]
    }));
}

function dateIsoSheet_(valeur) {
  if (!valeur) return "";
  if (Object.prototype.toString.call(valeur) === "[object Date]" && !isNaN(valeur.getTime())) {
    return Utilities.formatDate(valeur, "Europe/Paris", "yyyy-MM-dd");
  }
  const texte = String(valeur).trim();
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texte);
  if (fr) return fr[3] + "-" + fr[2] + "-" + fr[1];
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(texte);
  return iso ? iso[1] : texte;
}

function lireMaintenance_(ss) {
  const feuille = ss.getSheetByName("Maintenance");
  if (!feuille || feuille.getLastRow() < 2) return [];
  return feuille.getRange(2, 1, feuille.getLastRow() - 1, 15).getValues()
    .filter(ligne => ligne[1])
    .map(ligne => ({
      id: ligne[0], immatriculation: ligne[1], date: dateIsoSheet_(ligne[2]),
      type: ligne[3] || "", description: ligne[4] || "",
      kilometrage: ligne[5] || "", montant: ligne[6] || "",
      prestataire: ligne[7] || "", prochaineDate: dateIsoSheet_(ligne[8]),
      observations: ligne[9] || "", dateCreation: ligne[10] || "",
      dateModification: ligne[11] || "", lienFacture: ligne[12] || "",
      statut: ligne[13] || "Actif",
      alerteMailAcquittee: Boolean(ligne[8] && ligne[14] && dateIsoSheet_(ligne[14]) === dateIsoSheet_(ligne[8]))
    }));
}

function lireHistoriqueCt_(ss) {
  const feuille = ss.getSheetByName("Historique CT");
  if (!feuille || feuille.getLastRow() < 2) return [];
  return feuille.getRange(2, 1, feuille.getLastRow() - 1, 9).getValues()
    .filter(ligne => ligne[2])
    .map(ligne => ({
      immatriculation: ligne[2], date: dateIsoSheet_(ligne[3]),
      type: ligne[4] || "", ancienneDate: dateIsoSheet_(ligne[5]),
      nouvelleDate: dateIsoSheet_(ligne[6]), lienCt: ligne[7] || "",
      dateCreation: ligne[8] || ""
    }));
}

function creerMaintenance_(ss, p) {
  const feuille = ss.getSheetByName("Maintenance");
  const vehicules = ss.getSheetByName("Véhicules");
  if (!feuille || !vehicules) throw new Error("Feuille Maintenance ou Véhicules introuvable");
  const plaque = normaliserPlaqueSuivi_(p.immatriculation);
  const vehicule = vehicules.getDataRange().getValues().slice(1)
    .find(ligne => normaliserPlaqueSuivi_(ligne[1]) === plaque);
  if (!vehicule) throw new Error("Véhicule introuvable");
  if (!p.type || !p.date) throw new Error("Type et date de l'intervention requis");
  const date = validerDateSuivi_(p.date, "Date de l'intervention");
  const prochaine = validerDateSuivi_(p.prochaineDate, "Prochaine échéance");
  const km = p.kilometrage === undefined || p.kilometrage === "" ? "" : Number(p.kilometrage);
  if (km !== "" && (!Number.isFinite(km) || km < 0)) throw new Error("Kilométrage invalide");
  const montant = p.montant === undefined || p.montant === "" ? "" : Number(p.montant);
  if (montant !== "" && (!Number.isFinite(montant) || montant < 0)) throw new Error("Montant invalide");
  if (!feuille.getRange(1, 14).getValue()) feuille.getRange(1, 14).setValue("Statut");
  feuille.appendRow([Utilities.getUuid(), vehicule[1], date,
    String(p.type).slice(0, 100), String(p.description || "").slice(0, 1000),
    km, montant, String(p.prestataire || "").slice(0, 200),
    prochaine, String(p.observations || "").slice(0, 1000),
    nowIso_(), nowIso_(), "", "Actif"]);
  return jsonResponse_({ok: true, success: true});
}

function statutMaintenance_(ss, p, archiver) {
  const feuille = ss.getSheetByName("Maintenance");
  if (!feuille) throw new Error("Feuille Maintenance introuvable");
  const lignes = feuille.getDataRange().getValues();
  const index = lignes.findIndex((ligne, i) => i > 0 && String(ligne[0]) === String(p.id || ""));
  if (index < 0) throw new Error("Intervention introuvable");
  feuille.getRange(index + 1, 14).setValue(archiver ? "Archivé" : "Actif");
  feuille.getRange(index + 1, 12).setValue(nowIso_());
  return jsonResponse_({ok: true, success: true});
}

function ajouterHistoriqueParc_(ss, nom, ligne) {
  let feuille = ss.getSheetByName(nom);
  if (!feuille) {
    feuille = ss.insertSheet(nom);
    feuille.appendRow(["Date", "ID véhicule", "Immatriculation", "Ancien", "Nouveau"]);
  }
  feuille.appendRow(ligne);
}

function restaurerVehicule_(ss, p) {
  const feuille = ss.getSheetByName("Véhicules");
  const index = findVehicleByImmat_(feuille, p.immatriculation);
  if (index < 0) throw new Error("Véhicule introuvable");
  if (feuille.getRange(index, 8).getValue() !== "Archivé") {
    throw new Error("Le véhicule n'est pas archivé");
  }
  feuille.getRange(index, 8).setValue("Actif");
  feuille.getRange(index, 12).setValue(nowIso_());
  return jsonResponse_({ok: true, success: true});
}

function nouvelleRevision_(ss, p) {
  const feuille = ss.getSheetByName("Révisions");
  const vehicules = ss.getSheetByName("Véhicules");
  if (!feuille || !vehicules) throw new Error("Feuille de suivi introuvable");
  const plaque = normaliserPlaqueSuivi_(p.immatriculation);
  const prochaine = validerDateSuivi_(p.prochainDate, "Prochaine révision");
  if (!plaque || !prochaine) throw new Error("Véhicule et prochaine date requis");
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const vehicule = vehicules.getDataRange().getValues().slice(1)
      .find(ligne => normaliserPlaqueSuivi_(ligne[1]) === plaque);
    if (!vehicule) throw new Error("Véhicule introuvable");
    const lignes = feuille.getDataRange().getValues();
    const index = lignes.findIndex((ligne, i) => i > 0 &&
      normaliserPlaqueSuivi_(ligne[11]) === plaque && ligne[6] !== "Archivé");
    if (index < 0) throw new Error("Aucune révision active à enregistrer");
    const derniere = validerDateSuivi_(lignes[index][3], "Révision prévue");
    if (!derniere) throw new Error("Aucune date de révision prévue à reporter");
    if (p.dernierDate && validerDateSuivi_(p.dernierDate, "Dernière révision") !== derniere) {
      throw new Error("La dernière date doit correspondre à l'ancienne prochaine révision");
    }
    feuille.getRange(index + 1, 7).setValue("Archivé");
    feuille.getRange(index + 1, 8).setValue(
      String(lignes[index][7] || "") + " [HISTORIQUE_REVISION]");
    feuille.getRange(index + 1, 10).setValue(nowIso_());
    feuille.appendRow([Utilities.getUuid(), vehicule[0], derniere, prochaine,
      p.kilometrage || vehicule[6] || "", p.typeRevision || "", "Actif",
      p.observations || "", nowIso_(), nowIso_(), "", vehicule[1], vehicule[5] || ""]);
    SpreadsheetApp.flush();
    return jsonResponse_({ok: true, success: true, dernierDate: derniere});
  } finally {
    verrou.releaseLock();
  }
}

function chargerDocumentsControleTk_(ss, p) {
  const plaque = normaliserPlaqueSuivi_(p.immatriculation);
  if (!plaque) throw new Error("Immatriculation manquante");
  const documents = lireDocuments_(ss).filter(doc =>
    normaliserPlaqueSuivi_(doc.immatriculation) === plaque &&
    /contr[oô]le technique/i.test(String(doc.categorie || "") + " " + String(doc.nom || ""))
  );
  return jsonResponse_({ ok: true, success: true, documents });
}

function uploadControleTk_(ss, p) {
  const sheet = ss.getSheetByName("Contrôles techniques");
  if (!sheet) throw new Error("Feuille Contrôles techniques introuvable");
  const plaque = normaliserPlaqueSuivi_(p.immatriculation);
  if (!plaque) throw new Error("Immatriculation manquante");
  const dateDocument = p.date ? validerDateSuivi_(p.date, "Date du document") : todayIso_();
  const lignes = sheet.getDataRange().getValues();
  const index = lignes.findIndex((ligne, i) => i > 0 &&
    normaliserPlaqueSuivi_(ligne[2]) === plaque && ligne[8] !== "Archivé");
  if (index < 0) throw new Error("Contrôle technique introuvable : " + p.immatriculation);
  const mime = String(p.mimeType || p.fileType || "").toLowerCase();
  if (!["application/pdf", "image/jpeg", "image/jpg", "image/png"].includes(mime)) {
    throw new Error("Formats autorisés : PDF, JPG, JPEG, PNG");
  }
  if (String(p.fileBase64 || p.file || "").length > 14 * 1024 * 1024) {
    throw new Error("Fichier trop volumineux (10 Mo maximum)");
  }
  const reponse = uploadDocument_(ss, Object.assign({}, p, {
    categorie: "Contrôle Technique",
    idVehicule: p.immatriculation,
    date: dateDocument
  }));
  const resultat = JSON.parse(reponse.getContent());
  if (resultat.ok !== true) return reponse;
  sheet.getRange(index + 1, 6).setValue(resultat.lienDrive);
  sheet.getRange(index + 1, 8).setValue(nowIso_());
  SpreadsheetApp.flush();
  return reponse;
}

// L'acquittement porte sur une échéance précise, jamais sur tout le véhicule.
function acquitterAlerteMail_(ss, p) {
  const definitions = {
    revision: {nom: "Révisions", plaque: 12, date: 4, statut: 7, acquit: 14},
    ct: {nom: "Contrôles techniques", plaque: 3, date: 5, statut: 9, acquit: 10},
    maintenance: {nom: "Maintenance", plaque: 2, date: 9, statut: 14, acquit: 15}
  };
  const def = definitions[String(p.type || "")];
  if (!def) throw new Error("Type d'échéance inconnu");
  const feuille = ss.getSheetByName(def.nom);
  if (!feuille) throw new Error("Feuille de suivi introuvable");
  const plaque = normaliserPlaqueSuivi_(p.immatriculation);
  const date = validerDateSuivi_(p.date, "Échéance");
  if (!plaque || !date) throw new Error("Véhicule et échéance requis");
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const lignes = feuille.getDataRange().getValues();
    const index = lignes.findIndex((ligne, i) => i > 0 &&
      normaliserPlaqueSuivi_(ligne[def.plaque - 1]) === plaque &&
      dateIsoSheet_(ligne[def.date - 1]) === date &&
      String(ligne[def.statut - 1]) !== "Archivé" &&
      (def.nom !== "Maintenance" || String(ligne[0]) === String(p.id || "")));
    if (index < 0) throw new Error("Échéance introuvable ou déjà modifiée");
    if (!feuille.getRange(1, def.acquit).getValue())
      feuille.getRange(1, def.acquit).setValue("Alerte mail acquittée pour échéance");
    feuille.getRange(index + 1, def.acquit).setValue(p.acquitter === true ? date : "");
    SpreadsheetApp.flush();
    return jsonResponse_({ok: true, success: true});
  } finally {
    verrou.releaseLock();
  }
}

function elementsMailParc_(ss) {
  const vehicules = lireVehicules_(ss).filter(v => v.statut !== "Archivé");
  const revisions = lireRevisions_(ss), controles = lireControlsTk_(ss), interventions = lireMaintenance_(ss);
  const aujourdhui = Utilities.formatDate(new Date(), "Europe/Paris", "yyyy-MM-dd");
  const jour = iso => Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(aujourdhui + "T00:00:00Z")) / 86400000);
  const elements = [];
  vehicules.forEach(v => {
    const plaque = normaliserPlaqueSuivi_(v.immatriculation);
    const suivis = [
      ...revisions.filter(x => normaliserPlaqueSuivi_(x.immatriculation) === plaque && x.statut !== "Archivé")
        .map(x => ({type: "Révision", date: x.dateProchaineRevision, acquit: x.alerteMailAcquittee})),
      ...controles.filter(x => normaliserPlaqueSuivi_(x.immatriculation) === plaque && x.statut !== "Archivé")
        .map(x => ({type: "Contrôle technique", date: x.dateProchainCT, acquit: x.alerteMailAcquittee})),
      ...interventions.filter(x => normaliserPlaqueSuivi_(x.immatriculation) === plaque && x.statut !== "Archivé")
        .map(x => ({type: x.type || "Entretien", date: x.prochaineDate, acquit: x.alerteMailAcquittee}))
    ];
    suivis.forEach(s => {
      if (!s.date || s.acquit) return;
      const ecart = jour(s.date);
      if (ecart <= 30) elements.push({vehicule: v, type: s.type, date: s.date, ecart});
    });
  });
  return elements.sort((a, b) => a.ecart - b.ecart);
}

function envoyerAlerteParc() {
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const aujourdhui = Utilities.formatDate(new Date(), "Europe/Paris", "yyyy-MM-dd");
    const proprietes = PropertiesService.getScriptProperties();
    if (proprietes.getProperty("AUTO_AB_MAIL_DERNIER_JOUR") === aujourdhui) {
      console.log("Récapitulatif déjà envoyé aujourd'hui");
      return;
    }
    const elements = elementsMailParc_(SpreadsheetApp.openById(CONFIG.SHEET_ID));
    if (!elements.length) {
      console.log("Aucune échéance non acquittée à signaler");
      return;
    }
    const parametres = parametresMailParc_();
    if (MailApp.getRemainingDailyQuota() < parametres.to.length + parametres.cc.length) throw new Error("Quota mail épuisé");
    const esc = texte => String(texte || "").replace(/[&<>\"']/g, c =>
      ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
    const dateFr = iso => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
    const sujet = "AB Parc Auto — " + elements.length + " échéance" + (elements.length > 1 ? "s" : "") + " à suivre · " + dateFr(aujourdhui);
    const lignes = elements.map(e => {
      const statut = e.ecart < 0 ? "En retard de " + Math.abs(e.ecart) + " j" : e.ecart === 0 ? "Aujourd'hui" : "J-" + e.ecart;
      const nom = e.vehicule.marque + " " + e.vehicule.modele + " · " + e.vehicule.immatriculation;
      return {statut, nom, type: e.type, date: dateFr(e.date), lien: CONFIG.SITE_URL + "?vehicule=" + encodeURIComponent(e.vehicule.immatriculation)};
    });
    const corps = "Bonjour Pascale,\n\nVoici les échéances du parc automobile à suivre :\n\n" +
      lignes.map(x => (x.statut.startsWith("En retard") ? "🔴 " : "🟠 ") + x.type + " — " + x.nom + "\nPrévue le " + x.date + " · " + x.statut + "\n" + x.lien).join("\n\n") +
      "\n\nOuvrir AB Parc Auto : " + CONFIG.SITE_URL + "\n\nLes échéances prises en charge ne sont plus rappelées par mail.";
    const html = '<div style="font:14px Arial,sans-serif;color:#182330;max-width:640px"><h2 style="background:#1e3a8a;color:white;padding:12px;font-size:16px">AB Parc Auto</h2><p>Bonjour Pascale,</p><p>Voici les échéances du parc automobile à suivre :</p>' +
      lignes.map(x => '<div style="border:1px solid #dfe5ec;border-radius:5px;padding:12px;margin:9px 0"><strong>' + esc(x.type) + ' — ' + esc(x.nom) + '</strong><br>Prévue le ' + esc(x.date) + ' · <b>' + esc(x.statut) + '</b><br><a href="' + esc(x.lien) + '">Ouvrir la fiche</a></div>').join("") +
      '<p><a href="' + esc(CONFIG.SITE_URL) + '" style="background:#1e3a8a;color:white;padding:10px 14px;text-decoration:none;display:inline-block">Ouvrir AB Parc Auto</a></p><p style="color:#667085">Les échéances prises en charge ne sont plus rappelées par mail.</p></div>';
    MailApp.sendEmail({to: parametres.to.join(","), cc: parametres.cc.join(","), subject: sujet, body: corps, htmlBody: html, name: "AB Parc Auto"});
    proprietes.setProperty("AUTO_AB_MAIL_DERNIER_JOUR", aujourdhui);
    console.log("Mail envoyé à " + parametres.to.join(",") + " : " + elements.length + " échéance(s)");
  } finally {
    verrou.releaseLock();
  }
}

function installerAlerteParc() {
  const existants = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "envoyerAlerteParc");
  if (!existants.length) ScriptApp.newTrigger("envoyerAlerteParc").timeBased()
    .atHour(8).nearMinute(0).everyDays(1).inTimezone("Europe/Paris").create();
  console.log("Déclencheur quotidien : " + (existants.length || 1));
}

// L'accès est vérifié côté serveur. Définir AUTO_AB_ACCESS_CODE dans les
// propriétés du script avant le déploiement ; ne jamais publier le code dans GitHub.
function connecterParc_(p) {
  const proprietes = PropertiesService.getScriptProperties();
  const code = proprietes.getProperty("AUTO_AB_ACCESS_CODE");
  if (!code) throw new Error("Accès non configuré. Contacter l'administrateur.");
  const verrou = LockService.getScriptLock();
  verrou.waitLock(10000);
  try {
    const maintenant = Date.now();
    const blocage = Number(proprietes.getProperty("AUTO_AB_LOGIN_BLOQUE_JUSQUA") || 0);
    if (blocage > maintenant) throw new Error("Trop d'essais. Réessayer dans 15 minutes.");
    if (String(p.pin || "") !== code) {
      const essais = Number(proprietes.getProperty("AUTO_AB_LOGIN_ESSAIS") || 0) + 1;
      proprietes.setProperty("AUTO_AB_LOGIN_ESSAIS", String(essais));
      if (essais >= 5) {
        proprietes.setProperty("AUTO_AB_LOGIN_BLOQUE_JUSQUA", String(maintenant + 15 * 60000));
        proprietes.setProperty("AUTO_AB_LOGIN_ESSAIS", "0");
      }
      throw new Error("Code incorrect.");
    }
    proprietes.deleteProperty("AUTO_AB_LOGIN_ESSAIS");
    proprietes.deleteProperty("AUTO_AB_LOGIN_BLOQUE_JUSQUA");
    const token = Utilities.getUuid() + Utilities.getUuid();
    CacheService.getScriptCache().put("AUTO_AB_SESSION_" + token, "1", 21600);
    return jsonResponse_({ok: true, success: true, token});
  } finally {
    verrou.releaseLock();
  }
}

function verifierSessionParc_(token) {
  if (!token || !CacheService.getScriptCache().get("AUTO_AB_SESSION_" + String(token))) {
    throw new Error("Accès requis. Saisir le code du parc.");
  }
}

function parametresMailParc_() {
  const proprietes = PropertiesService.getScriptProperties();
  const to = JSON.parse(proprietes.getProperty("AUTO_AB_MAIL_TO") || "null") || [CONFIG.ALERTE_EMAIL];
  const cc = JSON.parse(proprietes.getProperty("AUTO_AB_MAIL_CC") || "null") || [];
  return {to, cc};
}

function lireParametresMail_() {
  const parametres = parametresMailParc_();
  return jsonResponse_({ok: true, success: true, to: parametres.to, cc: parametres.cc});
}

function enregistrerParametresMail_(p) {
  const verifier = valeurs => {
    if (!Array.isArray(valeurs)) throw new Error("Liste d'adresses invalide");
    return valeurs.map(x => String(x || "").trim().toLowerCase()).filter(Boolean);
  };
  const to = verifier(p.to), cc = verifier(p.cc);
  if (!to.length) throw new Error("Ajouter au moins un destinataire principal");
  if (to.length + cc.length > 20) throw new Error("20 adresses maximum");
  const toutes = to.concat(cc);
  if (new Set(toutes).size !== toutes.length) throw new Error("Une adresse est présente deux fois");
  if (toutes.some(x => !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(x))) throw new Error("Adresse e-mail non conforme");
  const proprietes = PropertiesService.getScriptProperties();
  proprietes.setProperties({AUTO_AB_MAIL_TO: JSON.stringify(to), AUTO_AB_MAIL_CC: JSON.stringify(cc)});
  return jsonResponse_({ok: true, success: true, to, cc});
}

