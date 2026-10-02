# Dépenses HT — suite du 2 octobre 2026

Ajout après la publication du lot 1 (serveur version 72).

## Fonctionnalités
- Mois sans import : « À recevoir » et litres à renseigner, distincts du zéro explicitement validé.
- Comparaison au mois précédent et au même mois de l’année précédente ; cumul janvier jusqu’au mois sélectionné comparé à la même période de l’année précédente.
- Évolution glissante sur douze mois avec montants signés et états de complétude. Les barres représentent l’amplitude du montant, le libellé garde le signe des avoirs.
- Comparaison bloquée lorsque les périodes sont en cours/futures, les imports non validés, les HT manquants ou les affectations nécessaires incomplètes. Pas de pourcentage si la base est nulle ou négative.
- Exports CSV et PDF de la vue filtrée en HT, avec filtres, total connu et avertissement de complétude. Identité individuelle conservée, documents liés dans le CSV ; PDF paginé sans dépendance réseau.

## Fichiers
`expenses-report.js`, `expenses.js`, `app.js`, `app.css`, `index.html`, `tests/expenses-report.test.js`, `tests/expenses-ui.test.js` et ce bilan.

## Vérification
Quatre suites locales passent : règles/serveur simulé, parseurs fournisseurs, rendu d’interface, reporting (sept scénarios). Contrôle syntaxique des fichiers modifiés. PDF de données synthétiques rendu sur deux pages, première page inspectée visuellement. Aucune donnée de test ajoutée au stockage réel.

## Limites et suite
La complétude dépend des comptes fournisseurs connus et de leur validation explicite ; l’application ne peut pas deviner une facture attendue pour un compte jamais déclaré. Un compte connu est considéré attendu chaque mois (règle conservatrice).
Les dépenses restent celles renseignées : les montants d’entretiens existants de base fiscale inconnue restent séparés. La saisie générale d’autres dépenses, les kilométrages, rendez-vous, immobilisations et signalements restent à réaliser. L’écriture réelle des imports et le parcours mobile complet restent à vérifier ; cette livraison ne clôture pas le cahier des charges.

## Publication et retour arrière
Évolution exclusivement frontend compatible avec le serveur 72 existant. Publication via main/GitHub Pages et contrôle navigateur après succès. Retour arrière frontend possible au commit `ef394a787391c060577d4a4a522c1e452d846e26`, sans modifier ni effacer les données partagées. Le présent fichier décrit le code ; la réussite de publication doit être confirmée par GitHub Pages et le navigateur.
