// AB PARC AUTO - Google Apps Script Backend
const SHEET_ID = "1fC7O-GIKq1qX81JP8EzDS1tXnBhVZKXX9unTYHZB79Y";
const SHEET = SpreadsheetApp.openById(SHEET_ID);

// ========== DONNÉES ==========
function getVehicules() {
  const sheet = SHEET.getSheetByName("Véhicules");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) break; // Stop si colonne vide
    result.push({
      immatriculation: data[i][0],
      marque: data[i][1],
      modele: data[i][2],
      annee: data[i][3],
      statut: data[i][4]
    });
  }
  return result;
}

function getCategories() {
  const sheet = SHEET.getSheetByName("Catégories");
  const data = sheet.getDataRange().getValues();
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) break;
    result.push({
      id: data[i][0],
      nom: data[i][1],
      couleur: data[i][2]
    });
  }
  return result;
}

function getDocuments() {
  const sheet = SHEET.getSheetByName("Documents");
  const data = sheet.getDataRange().getValues();
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) break;
    result.push({
      id: data[i][0],
      immatriculation: data[i][1],
      categorie: data[i][2],
      nom: data[i][3],
      date: data[i][4],
      description: data[i][5],
      lienDrive: data[i][6]
    });
  }
  return result;
}

function getDocumentsByVehicule(immatriculation) {
  const docs = getDocuments();
  return docs.filter(d => d.immatriculation === immatriculation);
}

// ========== CRÉER DOCUMENT ==========
function createDocument(immatriculation, categorie, nom, date, description, lienDrive) {
  const sheet = SHEET.getSheetByName("Documents");
  const data = sheet.getDataRange().getValues();
  const newId = (data.length - 1) + 1; // ID = ligne - 1
  
  sheet.appendRow([newId, immatriculation, categorie, nom, date, description, lienDrive]);
  return { success: true, id: newId };
}

// ========== MODIFIER DOCUMENT ==========
function updateDocument(docId, categorie, nom, date, description, lienDrive) {
  const sheet = SHEET.getSheetByName("Documents");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == docId) {
      sheet.getRange(i + 1, 3, 1, 5).setValues([[categorie, nom, date, description, lienDrive]]);
      return { success: true };
    }
  }
  return { success: false, error: "Document non trouvé" };
}

// ========== SUPPRIMER DOCUMENT ==========
function deleteDocument(docId) {
  const sheet = SHEET.getSheetByName("Documents");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == docId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: "Document non trouvé" };
}

// ========== AJOUTER VÉHICULE ==========
function createVehicule(immatriculation, marque, modele, annee, statut) {
  const sheet = SHEET.getSheetByName("Véhicules");
  sheet.appendRow([immatriculation, marque, modele, annee, statut]);
  return { success: true };
}

// ========== AJOUTER INVITÉ ==========
function createInvite(immatriculation, nom, email, phone) {
  try {
    const sheet = SHEET.getSheetByName("Invités");
    const data = sheet.getDataRange().getValues();
    const newId = (data.length - 1) + 1;
    const dateNow = new Date().toISOString().split("T")[0];
    
    sheet.appendRow([newId, immatriculation, nom, email, phone, dateNow]);
    return { success: true, id: newId };
  } catch (err) {
    return { success: false, error: "Erreur: " + err.toString() };
  }
}

// ========== HELPER: Add CORS headers ==========
function setCorsHeaders_(output) {
  return output
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ========== HANDLE OPTIONS (CORS preflight) ==========
function doOptions(e) {
  return HtmlService.createHtmlOutput("")
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ========== WEB APP ENDPOINT ==========
function doGet(e) {
  const action = e.parameter.action || "";
  
  try {
    let response;
    
    if (action === "getAll") {
      response = ContentService.createTextOutput(JSON.stringify({
        vehicules: getVehicules(),
        documents: getDocuments(),
        categories: getCategories()
      })).setMimeType(ContentService.MimeType.JSON);
    } else if (action === "getVehiculeDocuments") {
      const immatriculation = e.parameter.immatriculation;
      response = ContentService.createTextOutput(JSON.stringify({
        documents: getDocumentsByVehicule(immatriculation)
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      response = ContentService.createTextOutput(JSON.stringify({ error: "Action inconnue" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return setCorsHeaders_(response);
  } catch (err) {
    const errorResponse = ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
    return setCorsHeaders_(errorResponse);
  }
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  
  try {
    let response;
    
    if (action === "createDocument") {
      response = ContentService.createTextOutput(JSON.stringify(
        createDocument(data.immatriculation, data.categorie, data.nom, data.date, data.description, data.lienDrive)
      )).setMimeType(ContentService.MimeType.JSON);
    } else if (action === "updateDocument") {
      response = ContentService.createTextOutput(JSON.stringify(
        updateDocument(data.id, data.categorie, data.nom, data.date, data.description, data.lienDrive)
      )).setMimeType(ContentService.MimeType.JSON);
    } else if (action === "deleteDocument") {
      response = ContentService.createTextOutput(JSON.stringify(
        deleteDocument(data.id)
      )).setMimeType(ContentService.MimeType.JSON);
    } else if (action === "createVehicule") {
      response = ContentService.createTextOutput(JSON.stringify(
        createVehicule(data.immatriculation, data.marque, data.modele, data.annee, data.statut)
      )).setMimeType(ContentService.MimeType.JSON);
    } else if (action === "createInvite") {
      response = ContentService.createTextOutput(JSON.stringify(
        createInvite(data.immatriculation, data.nom, data.email, data.phone)
      )).setMimeType(ContentService.MimeType.JSON);
    } else {
      response = ContentService.createTextOutput(JSON.stringify({ error: "Action inconnue" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return setCorsHeaders_(response);
  } catch (err) {
    const errorResponse = ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
    return setCorsHeaders_(errorResponse);
  }
}
