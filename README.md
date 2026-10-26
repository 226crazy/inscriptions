# Crazy Hub · Inscriptions 2026-2027

Page statique en français, sans framework, build, npm ni dépendance JavaScript. Elle fonctionne directement dans un navigateur et sur GitHub Pages. Seule la police Poppins est chargée depuis Google Fonts ; une police système prend le relais si nécessaire.

## 1. Préparer Google Sheets

1. Créez une feuille de calcul Google Sheets, par exemple **Crazy Hub - Rentrée 2026-2027**.
2. Dans cette feuille, ouvrez **Extensions > Apps Script**.
3. Remplacez le contenu de `Code.gs` par celui de `apps-script/Code.gs`, puis enregistrez.
4. Dans le sélecteur de fonctions de l'éditeur, choisissez **initialiser**, puis cliquez sur **Exécuter**. Autorisez l'accès à votre feuille avec votre compte Google.
5. Cette opération mémorise automatiquement l'identifiant de votre feuille, règle le fuseau sur `Africa/Ouagadougou` et crée l'onglet **Inscriptions** avec ses en-têtes. Aucun identifiant de feuille n'est à copier dans le code.

L'initialisation est importante : une application Web ne doit pas dépendre d'une feuille « active » dans un navigateur. Le serveur ouvre ensuite votre feuille explicitement avec l'identifiant mémorisé.

Les colonnes sont :

| Date et heure | Nom et prénom de l'enfant | Classe | Quartier | Contact du parent | Statut |
| --- | --- | --- | --- | --- | --- |
| 26/10/2026 10:30:00 | Ouédraogo Aïcha | CM1 | Saaba | +22670123456 | Nouveau |

## 2. Déployer l'application Web Google

1. Cliquez sur **Déployer > Nouveau déploiement**.
2. Dans le choix du type de déploiement (roue dentée), sélectionnez **Application Web**.
3. Choisissez **Exécuter en tant que : Moi**.
4. Choisissez **Qui a accès : Tout le monde**, sans connexion Google obligatoire.
5. Cliquez sur **Déployer** et autorisez les permissions demandées.
6. Copiez l'URL de l'application Web se terminant par **`/exec`**. N'utilisez pas `/dev` ni le lien de l'éditeur.
7. Ouvrez cette URL dans une fenêtre privée : elle doit afficher **Crazy Hub API OK**, sans demander de connexion.

Si votre compte professionnel ou scolaire interdit l'accès public, demandez à son administrateur de l'autoriser ou utilisez un compte qui permet cette publication. L'onglet Google Sheets, lui, doit rester privé : seul le script reçoit l'accès public.

## 3. Configurer l'URL du formulaire

En haut de `script.js`, remplacez :

```js
const APPS_SCRIPT_URL = "COLLER_ICI_L_URL_DU_SCRIPT";
```

par l'URL `/exec` obtenue au déploiement :

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/VOTRE_IDENTIFIANT/exec";
```

N'ajoutez aucun secret dans cette page publique. L'URL du script n'est pas un secret et ne constitue pas un mécanisme d'authentification.

## 4. Ajouter les images

- Remplacez **`assets/affiche.png`** par l'affiche officielle, idéalement carrée, autour de 800 × 800 pixels et compressée sous 300 Ko.
- Remplacez **`assets/logo.png`** par le logo officiel sur fond transparent, idéalement dans un format horizontal.
- Gardez exactement ces noms, en minuscules. L'affiche présente dans le dossier est utilisée telle quelle. Le logo fourni pour la prévisualisation est provisoire : remplacez-le par le logo officiel de Crazy Hub.
- Si une image est absente ou ne se charge pas, le logo est remplacé par **CRAZY HUB**, et l'affiche par un cadre portant **Insérer l'affiche ici**.

Les métadonnées de partage WhatsApp et X sont déjà présentes. Après publication, remplacez les chemins `assets/affiche.png` dans les métadonnées `og:image` et `twitter:image` de `index.html` par l'URL HTTPS complète de votre affiche publiée, par exemple `https://VOTRE_COMPTE.github.io/VOTRE_DEPOT/assets/affiche.png`. Les robots de partage ont besoin d'une image publique ; les aperçus peuvent rester en cache après une modification.

## 5. Publier sur GitHub Pages

1. Créez un dépôt GitHub, de préférence public pour une publication Pages simple.
2. Placez les fichiers de ce dossier à la racine du dépôt. Vous pouvez utiliser **Add file > Upload files**, GitHub Desktop ou Git.
3. Avec Git, depuis le dossier du projet, adaptez le nom du compte et du dépôt :

   ```sh
   git init
   git add index.html style.css script.js assets apps-script README.md
   git commit -m "Ajouter la page d'inscription Crazy Hub"
   git branch -M main
   git remote add origin https://github.com/VOTRE_COMPTE/VOTRE_DEPOT.git
   git push -u origin main
   ```

4. Ouvrez **Settings > Pages** dans le dépôt.
5. Choisissez **Deploy from a branch**, puis la branche **main** et le dossier racine **`/ (root)`** (parfois noté `/root` dans les tutoriels).
6. Enregistrez et attendez la fin du déploiement. GitHub affiche ensuite l'URL HTTPS publique.
7. Vérifiez que `index.html` est à la racine, pas dans un sous-dossier `formulaire`.

Tous les chemins des fichiers sont relatifs pour fonctionner aussi sous `https://VOTRE_COMPTE.github.io/VOTRE_DEPOT/`.

## 6. Tester une inscription

1. Ouvrez `index.html` pour prévisualiser la page. Pour valider l'envoi réel, utilisez ensuite l'URL HTTPS GitHub Pages.
2. Envoyez d'abord un formulaire vide : chaque champ doit afficher son erreur.
3. Testez un numéro local (`70 12 34 56`), puis les variantes `+226 70 12 34 56` et `00226 70 12 34 56`. Le numéro enregistré doit être `+22670123456`.
4. Envoyez une inscription de test : le bouton doit afficher **Envoi en cours…**, puis le message de confirmation.
5. Vérifiez directement la nouvelle ligne dans **Inscriptions** et le statut **Nouveau**.
6. Cliquez sur **Inscrire un autre enfant** : les champs se réinitialisent.
7. Réenvoyez exactement les mêmes informations dans les 30 secondes : aucune nouvelle requête ne doit partir. Après ce délai, une inscription volontaire identique reste possible.
8. Coupez la connexion et testez une erreur : les données saisies doivent rester présentes, avec les deux numéros à appeler.
9. Vérifiez le rendu à 360, 768 et 1280 pixels, la navigation au clavier et le formulaire depuis un téléphone.

### CORS et confirmation

Le navigateur envoie un POST avec `body: JSON.stringify(data)` **sans en-tête `Content-Type` personnalisé**. Il tente d'abord de lire le JSON de réponse. Si le navigateur empêche cette lecture pour des raisons CORS, il réessaie en `mode: "no-cors"` avec **le même identifiant d'envoi**.

Une réponse opaque `no-cors` ne permet de lire ni le statut HTTP ni le JSON : conformément au comportement demandé, l'interface affiche un succès en l'absence d'erreur réseau. **Ce succès n'est donc pas une preuve que Google Sheets a accepté la ligne.** Il faut impérativement vérifier une première inscription dans la feuille après chaque déploiement. Une page de connexion Google ou une erreur serveur peut aussi être opaque. Pour une confirmation garantie, il faudrait un relais serveur avec une politique CORS maîtrisée.

Le script déduplique les identifiants récents sous verrou, pendant 10 minutes et dans une limite de 40 envois, pour éviter les doublons entre les deux POST. Le navigateur conserve en mémoire le dernier succès pendant 30 secondes et le même identifiant pour réessayer un envoi interrompu. Cette protection est adaptée au faible trafic attendu, pas à une garantie transactionnelle à grande échelle. Elle ne remplace pas la vérification des inscriptions.

### Protection et données personnelles

- Validation identique côté navigateur et côté serveur ; tous les champs sont obligatoires et limités à 100 caractères.
- Protection contre les formules Google Sheets pour les valeurs commençant par `=`, `+`, `-` ou `@`, y compris les numéros internationaux.
- Champ piège anti-spam, verrou d'écriture et historique anti-doublon borné. Ce champ piège n'est pas un CAPTCHA et n'arrête pas un robot ciblant directement l'API publique.
- Pas de stockage local des informations personnelles, pas d'outil de suivi et pas de données d'enfant dans la console. L'historique serveur ne contient que des identifiants, des empreintes et des dates.
- Limitez l'accès à la feuille à l'équipe qui gère les inscriptions. Définissez une durée de conservation adaptée et supprimez les tests et données devenues inutiles.
- Ne publiez jamais une exportation de la feuille dans le dépôt GitHub.

## 7. Mettre à jour le script Google

**Enregistrer le code ne met pas à jour la version publique.**

Après toute modification de `Code.gs` :

1. Ouvrez **Déployer > Gérer les déploiements**.
2. Sélectionnez le déploiement existant, puis cliquez sur le crayon **Modifier**.
3. Dans **Version**, choisissez **Nouvelle version**.
4. Cliquez sur **Déployer**.
5. Conservez l'URL `/exec` du déploiement existant ; si vous créez un autre déploiement, mettez à jour `APPS_SCRIPT_URL`.
6. Refaites un test et vérifiez la ligne dans Sheets.

Les changements HTML, CSS, JavaScript et images se publient en poussant les fichiers sur `main`.

## Fichiers

```text
.
├── index.html
├── style.css
├── script.js
├── assets/
│   ├── affiche.png
│   └── logo.png
├── apps-script/
│   └── Code.gs
└── README.md
```
