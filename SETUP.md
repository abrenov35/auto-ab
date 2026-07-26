# 🚗 AB PARC AUTO - Guide d'installation

## Prérequis
- Accès à Google Sheets (avec les 3 feuilles créées)
- Accès au dépôt GitHub `abrenov35/auto-ab`

---

## ÉTAPE 1: Préparer le Google Sheets

### Vérifie que tu as 3 feuilles avec ces en-têtes:

**Feuille "Véhicules" (A1:E1):**
```
Immatriculation	Marque	Modèle	Année	Statut
```

**Feuille "Documents" (A1:G1):**
```
ID	Immatriculation	Catégorie	Nom	Date	Description	Lien Drive
```

**Feuille "Catégories" (A1:C1):**
```
ID	Nom	Couleur
```

Ajoute quelques données de test dans les feuilles si tu veux!

---

## ÉTAPE 2: Créer l'Apps Script Web App

### 2.1 Ouvre Google Sheets
Lien: https://docs.google.com/spreadsheets/d/1fC7O-GIKq1qX81JP8EzDS1tXnBhVZKXX9unTYHZB79Y/

### 2.2 Accède à l'éditeur Apps Script
1. Clique sur **"Outils"** (barre de menu)
2. Clique sur **"Éditeur Apps Script"**

### 2.3 Copie le code
1. Dans le fichier `auto-ab-apps-script.gs` du dépôt GitHub, copie **TOUT le code**
2. Dans l'éditeur Apps Script:
   - Supprime le code existant (celui par défaut)
   - Colle le nouveau code
   - **Ctrl+S** pour sauvegarder

### 2.4 Teste l'accès aux données
1. Clique sur le bouton **"Exécuter"** (flèche verte)
2. Sélectionne la fonction `getVehicules`
3. Clique **"Exécuter"**
4. Google te demandera les permissions → **Autoriser**
5. Vérifie que ça ne plante pas

### 2.5 Déploie l'Apps Script
1. Clique sur **"Déployer"** → **"Nouveau déploiement"**
2. Dans "Sélectionner le type":
   - Clique sur l'icône **"⚙️ Application web"**
3. Dans "Configuration du déploiement":
   - **"Exécuter en tant que:"** → Sélectionne ton email Google
   - **"Accès accordé à:"** → Sélectionne **"Tout le monde"**
4. Clique **"Déployer"**
5. Copie l'URL de déploiement (elle apparaît après le message "Déploiement réussi")

**Exemple d'URL:**
```
https://script.google.com/macros/s/AKfycbySXXXXXXXXXXXXXX/exec
```

---

## ÉTAPE 3: Mettre à jour index.html

### 3.1 Edite le fichier `index.html`
1. Ouvre le fichier `index.html` (tu peux l'éditer directement sur GitHub)
2. Cherche la ligne:
```javascript
const APPS_SCRIPT_URL = "REMPLACER_PAR_URL_APPS_SCRIPT";
```

### 3.2 Remplace par ton URL
Remplace la ligne par:
```javascript
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXXX/exec";
```

(Utilise l'URL que tu as copiée à l'étape 2.5)

### 3.3 Valide les modifications
- GitHub Pages met à jour automatiquement le site

---

## ÉTAPE 4: Test de l'application

### 4.1 Accède à l'app
https://abrenov35.github.io/auto-ab/

### 4.2 Teste les fonctionnalités
1. ✅ Clique sur un véhicule dans la sidebar
2. ✅ Tu dois voir ses documents (ou "Aucun document")
3. ✅ Clique sur **"+ Ajouter document"**
4. ✅ Remplis le formulaire et enregistre
5. ✅ Le document doit apparaître dans la liste
6. ✅ Teste "Modifier" et "Supprimer"

### 4.3 Vérifie les données dans Sheets
- Ouvre le Google Sheets
- La feuille "Documents" doit avoir les nouvelles lignes

---

## Dépannage

**❌ Erreur: "Impossible de charger les données"**
- Vérifie que l'URL Apps Script est correcte dans index.html
- Vérifie que tu as autorisé l'Apps Script à accéder au Sheets

**❌ Erreur: "Catégories non trouvées"**
- Vérifie que la feuille "Catégories" existe
- Vérifie que A1 = "ID" (majuscule)

**❌ Les documents ne s'affichent pas**
- Ouvre la console JavaScript (F12)
- Cherche les messages d'erreur rouge
- Contacte pour debug!

---

## Support

Pour toute question ou bug, contacte Younes! 🚀
