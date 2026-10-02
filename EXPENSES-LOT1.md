# Dépenses — bilan du 2 octobre 2026

Statut : développement du lot 1 et lecture assistée des formats fournis enregistrés dans une branche de travail. **Non déployé.** Les exemplaires Intermarché et EasyPark ont été examinés et les extracteurs testés localement ; les tests d’intégration Google et mobile restent à effectuer. Ne pas annoncer le lot terminé.

## Audit de l'application utilisée

- Dépôt `abrenov35/auto-ab`, branche `main`, commit de référence `02ee146b83627b4f7db92aaaafb4fd4350cd8019`.
- Page publiée inspectée : `https://abrenov35.github.io/auto-ab/`. Son DOM charge `app.js?v=10` ; `entretien-couts.js` et `index CORRIGE.html` ne sont pas chargés.
- Frontend : HTML/CSS/JS natifs ; appels directs au serveur Apps Script. `main.js` est un ancien proxy et n'est pas la cible actuelle du frontend.
- Projet Google AUTO-AB ouvert depuis Extensions > Apps Script du classeur. Le texte complet de Code.gs correspond au serveur du dépôt après normalisation des fins de lignes (53 421 caractères, empreinte FNV de comparaison 722865286). Aucun changement fait dans cet éditeur.
- Gérer les déploiements affiche **version 71, 28 septembre 2026 à 17:54**, sur l'URL appelée dans `app.js`. La version enregistrée dans l'éditeur et celle du déploiement restent deux états distincts : une version future doit être publiée explicitement.
- Stockage existant : classeur Google Sheets et dossier Drive configurés côté serveur. Authentification par code partagé, session serveur. Pas de rôles individuels existants dans le code examiné. Ne pas inventer une identité d'auteur personnelle : journal libellé « Session authentifiée du parc ».
- Maintenance contient des montants sans indication HT/TTC. Ils restent visibles séparément tant que leur base n'est pas vérifiée ; liaison d'une opération importée à l'entretien existant pour éviter le double comptage. Les fonctions d'alertes, véhicules, documents et historiques sont laissées intactes.

## Consigne confirmée : suivi exclusivement hors taxes

Tous les indicateurs, opérations, cumuls, futurs comparatifs et exports sont exclusivement HT. Aucun sélecteur TTC dans le suivi. Un HT absent reste à vérifier : aucun remplacement par le montant payé et aucune conversion avec un taux supposé. Les autres montants du justificatif peuvent rester conservés pour les seuls contrôles d’import, dans une section facultative repliée.

## Réalisé dans le code

- Navigation À suivre / Véhicules / Dépenses / Paramètres. Module chargé à l'ouverture de Dépenses seulement.
- Mois, cumul annuel simple, véhicule (archives comprises), personne par identifiant stable, catégorie, suivi exclusivement HT. Synthèses et ouverture des opérations / facture. Montants connus et base manquante clairement distingués.
- Import assisté de facture Intermarché ou EasyPark, avec lecture locale des PDF/images et correction manuelle, relevé facultatif, PDF/JPEG/PNG (5 Mo par pièce, 2 pièces, 100 opérations). Aperçu modifiable, justificatif ouvrable, contrôle des totaux, confirmation explicite avant enregistrement.
- Champs facture/opérations distincts ; noms et identifiants lus conservés, plaques affectées uniquement si déjà connues, création explicite d’une personne depuis son identité fournisseur ; période déclarée affichée quand la date de l'opération manque ; litres achetés, aucun L/100 calculé.
- Frais de service, abonnements et frais communs distincts. Non affecté inclus dans le total. Filtre À affecter.
- Personnes identifiées par ID, nom complet et référence unique. Correspondances carte/utilisateur avec fournisseur, compte et intervalle de validité ; application uniquement aux lignes datées ou périodes entièrement couvertes, jamais depuis le conducteur actuel.
- Contrôles serveur : total exact en centimes sur chaque base fournie, aucun taux de TVA supposé, avoirs négatifs, identifiants connus, liens entretiens uniques, doublons de document (SHA-256), fournisseur/compte/numéro et contrôle supplémentaire sans numéro.
- Verrou serveur ; identifiant de requête stable lors d'une nouvelle tentative ; une facture et toutes ses opérations dans un seul événement. Écritures append-only, corrections avec contrôle de version et motif, annulation conservant les justificatifs et l'historique.
- Journal partagé « Dépenses journal ». Justificatifs dans le dossier documentaire existant, sans nouvelle permission de partage. Aucun service externe d'OCR.
- Statuts mensuels À recevoir / À vérifier / Validé par fournisseur et compte ; validation manuelle avec explication, dépense nulle explicitement confirmée. Un changement d'import invalide les validations du compte concerné (règle conservatrice).
- Copie du classeur avant la première création du journal. L'ID est conservé dans la propriété serveur `AUTO_AB_DEPENSES_BACKUP`. Pas de migration/réécriture des feuilles existantes.

## Fichiers

Modifiés : `index.html`, `app.js`, `app.css`, `auto-ab-apps-script.gs`.
Ajoutés : `expenses-core.js`, `expenses-server.gs`, `expenses.js`, `expenses-import.js`, `expenses-reader.js`, `tests/expenses-import.test.js`, `tests/expenses.test.js`, `tests/expenses-ui.test.js`, ce bilan.

## Vérifications effectuées

31 tests isolés : 19 règles et simulations serveur, 11 tests d’extraction et 1 parcours de rendu couvrant plusieurs écrans. Exécuter depuis le dépôt :

```sh
node tests/expenses.test.js
node tests/expenses-ui.test.js
node tests/expenses-import.test.js
node --check app.js
node --check expenses.js
node --check expenses-core.js
```

Couverture : montants inconnus/zéro/négatifs, écarts, dates d'opération, facture globale, filtres par personne, affectations datées, frais communs, documents sans numéro, doublons même annulés, reprise après interruption après écriture, sauvegarde, corrections concurrentes, archivage, personne inconnue, invalidation de la complétude, contenu documentaire invalide, entretien déjà lié, intervalles qui se chevauchent, annulation avec historique. Rendu HTML de la saisie, des paramètres, de l'historique et échappement des données textuelles.

Les services Google sont simulés dans les tests. Aucun faux document ni événement n'a été écrit dans le classeur réel. Aucun mail n'a été déclenché. Les temps unitaires ne sont pas des mesures de rapidité réelle.

## Limites à lever

1. Formats des deux exemplaires testés : scans reconnus avec PDF.js et Tesseract.js (traitement local, aucun envoi à un service d’OCR). D’autres versions de facture peuvent nécessiter une adaptation ; tous les imports restent à vérifier. Les dépendances PDF.js 5.6.205, Tesseract.js 7.0.0 et son moteur 7.0.0 se chargent à la demande depuis jsDelivr ; le modèle de langue suit le chemin par défaut de Tesseract.js. La version du modèle utilisée par le navigateur et sa connectivité restent à vérifier en intégration. Maximum 15 pages. Les exemples réels et leurs OCR ne sont pas dans le dépôt public.
2. Contrôler visuellement les écrans sur ordinateur et téléphone, portrait/paysage et clavier ouvert ; tester l'intégration contre un **classeur et dossier Drive de test**, avec une copie du projet Apps Script.
3. Mesurer les consultations/enregistrements via Google ; objectif < 5 secondes non encore vérifié. Le journal complet est relu actuellement : pagination/indexation à prévoir si son volume le justifie.
4. Aucun contrôle d'identité individuelle supplémentaire : droits du code partagé conservés. Définir des rôles séparés avant tout besoin de confidentialité entre utilisateurs du parc.
5. Les correspondances sont ajoutées avec leurs dates ; modification/fermeture ultérieure d'une correspondance existante reste à compléter. Aucune réattribution rétroactive silencieuse.
6. Vue historique disponible, mais pas de remplacement de pièce ni d'ajout tardif de relevé après validation ; joindre le relevé durant l'import initial. Une annulation ne libère pas l'identité de facture : réimport bloqué pour éviter les doublons, réactivation contrôlée à compléter si nécessaire.
7. Comparatifs, courbe 12 mois, exports, autres dépenses générales, kilométrages et lot 3 restent hors de cette livraison. Cumul annuel simple déjà présent.

## Lecture des factures vérifiée localement

Les deux PDF reçus ont été rendus et examinés. Deux chaînes de contrôle ont été exécutées : rendu Poppler puis Tesseract.js, et rendu PDF.js puis Tesseract.js. La seconde retrouve 13 lignes Intermarché et 38 lignes EasyPark, équilibrées en HT. Les résultats OCR incertains (libellé carburant et identifiant de transaction) restent signalés ; aucune correction financière silencieuse. Les fichiers client, coordonnées, comptes, numéros de facture et montants réels restent hors du dépôt public.

Intermarché : HT des opérations calculé à partir du taux explicitement imprimé, rapproché de la synthèse HT et des sous-totaux de cartes ; frais de gestion et services séparés. Aucune plaque n’est inventée et les kilométrages lus ne sont pas ajoutés à l’historique.

EasyPark : stationnement à sa date de début, abonnement à sa période de service, remises négatives, ajustement uniquement s’il est imprimé. Total HT reconstitué depuis les sous-totaux nominatifs, affiché comme tel et à vérifier ; ce document ne comporte pas de récapitulatif global HT isolé. Les répétitions d’un utilisateur sont conservées lorsque les transactions sont distinctes. Plusieurs numéros de facture dans une seule lecture sont refusés.

## Déploiement et retour arrière

Aucune mise en production dans cette livraison. Ne pas fusionner le frontend avant que le serveur compatible soit testé et publié.

1. Conserver le commit de référence et la version Apps Script 71. Faire une copie explicite du classeur et du projet avant la mise en production, en plus de la sauvegarde automatique de première écriture. Ne pas exécuter les essais sur les données réelles.
2. Dans le projet de test, conserver le Code.gs existant et ajouter uniquement le routage de `auto-ab-apps-script.gs` après l'authentification. Ajouter `expenses-server.gs` et copier `expenses-core.js` dans un fichier Apps Script `expenses-core.gs`. Pointer CONFIG uniquement vers les ressources de test. Aucun secret client ajouté.
3. Après tests, appliquer les trois fichiers serveur au projet réel et publier une nouvelle version du **déploiement existant**, sans changer son URL, ses droits, ses paramètres ni son déclencheur quotidien. Le code enregistré dans GitHub n'actualise pas Apps Script.
4. Publier ensuite le frontend via GitHub Pages. Vérifier connexion, lecture du parc, Paramètres, alertes sans envoi non demandé, données Dépenses et justificatifs autorisés. Contrôler l'absence d'erreur et les temps réels.
5. Retour arrière : remettre le déploiement Apps Script sur la version 71 et le frontend au commit de référence ; conserver le journal et les pièces sans suppression. Les anciennes fonctions ignorent la nouvelle feuille. Ne pas restaurer le classeur entier par-dessus des modifications intervenues depuis la sauvegarde. Si restauration nécessaire, copier uniquement les données concernées après rapprochement.
