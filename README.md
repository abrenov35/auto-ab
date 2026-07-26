# AB PARC AUTO - Gestion Documentaire Véhicules

Plateforme web pour gérer les documents des véhicules (assurance, révision, carburant, etc.) stockés dans Google Drive.

## Setup

### 1. Google Sheets
- **ID Sheets:** `1fC7O-GIKq1qX81JP8EzDS1tXnBhVZKXX9unTYHZB79Y`
- **3 feuilles:** Véhicules, Documents, Catégories

### 2. Google Apps Script

Tu dois créer une Apps Script Web App connectée au Sheets:

**Étapes:**
1. Ouvre Google Sheets (le lien ci-dessus)
2. Menu → **Outils** → **Éditeur Apps Script**
3. Supprime le code existant
4. Copie-colle le contenu de `auto-ab-apps-script.gs`
5. Clique sur **"Exécuter"** pour autoriser les permissions
6. Clique sur **"Déployer"** → **"Nouveau déploiement"**
7. Type: **Application web**
8. "Exécuter en tant que:" Ton email
9. "Accès accordé à:" Tout le monde
10. Clique **"Déployer"**
11. Copie l'URL de déploiement (ex: `https://script.google.com/macros/s/XXXXX/exec`)

### 3. Mettre à jour index.html

Dans `index.html`, remplace la ligne:
```javascript
const APPS_SCRIPT_URL = "REMPLACER_PAR_URL_APPS_SCRIPT";
```

Par l'URL de ton Apps Script:
```javascript
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXXX/exec";
```

## Fonctionnalités

- ✅ **Liste des véhicules** (sidebar)
- ✅ **Documents par véhicule** (affichage en grille)
- ✅ **Ajouter document** (formulaire modal)
- ✅ **Modifier document** (édition)
- ✅ **Supprimer document** (confirmation)
- ✅ **Ouvrir dans Google Drive** (lien direct)
- ✅ **Filtres par catégorie** (sélection)

## Tech Stack

- Frontend: HTML5, CSS3, Vanilla JS
- Backend: Google Apps Script
- Data: Google Sheets, Google Drive

## URL Live

https://abrenov35.github.io/auto-ab/
