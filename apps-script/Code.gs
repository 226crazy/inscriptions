/**
 * Crazy Hub : API liée à une feuille Google Sheets.
 * Exécuter initialiser() une fois depuis l'éditeur, puis déployer en application Web.
 */
const SHEET_NAME = "Inscriptions";
const TIME_ZONE = "Africa/Ouagadougou";
const VALID_CLASSES = ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2", "6ème", "5ème", "4ème", "3ème", "2nde", "1ère", "Terminale"];
const HEADERS = ["Date et heure", "Nom et prénom de l'enfant", "Classe", "Quartier", "Contact du parent", "Statut"];
const DEDUPLICATION_MS = 10 * 60 * 1000;

function initialiser() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Ouvrez ce script depuis Extensions > Apps Script dans votre feuille Google Sheets.");
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", spreadsheet.getId());
  spreadsheet.setSpreadsheetTimeZone(TIME_ZONE);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    obtenirFeuille_(spreadsheet);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput("Crazy Hub API OK");
}

function doPost(e) {
  let lock;
  try {
    if (!e || !e.postData || typeof e.postData.contents !== "string") {
      throw new Error("Aucune donnée reçue.");
    }
    if (e.postData.contents.length > 4096) throw new Error("La demande est trop volumineuse.");
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (error) {
      throw new Error("Les données JSON sont invalides.");
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("La demande est invalide.");
    if (data.website) return reponse_({ result: "success" });

    const childName = lireChamp_(data.childName, "Nom et prénom de l'enfant");
    const schoolClass = lireChamp_(data.schoolClass, "Classe");
    const district = lireChamp_(data.district, "Quartier");
    const rawPhone = lireChamp_(data.parentPhone, "Contact du parent");
    if (childName.length < 3) throw new Error("Le nom et le prénom doivent comporter au moins 3 caractères.");
    if (VALID_CLASSES.indexOf(schoolClass) === -1) throw new Error("La classe sélectionnée n'est pas valide.");
    const compactPhone = rawPhone.replace(/\s/g, "");
    if (!/^(?:(?:\+226|00226))?\d{8}$/.test(compactPhone)) {
      throw new Error("Le contact du parent doit contenir 8 chiffres, avec le préfixe +226 ou 00226 en option.");
    }
    const parentPhone = "+226" + compactPhone.replace(/^(?:\+226|00226)/, "");
    const requestId = data.requestId;
    if (typeof requestId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(requestId)) {
      throw new Error("L'identifiant d'envoi est invalide. Actualisez la page.");
    }

    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty("SPREADSHEET_ID");
    if (!spreadsheetId) throw new Error("Le service n'est pas encore configuré. Contactez Crazy Hub.");

    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw new Error("Le service est occupé. Réessayez dans un instant.");
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = obtenirFeuille_(spreadsheet);
    const now = Date.now();
    const fingerprint = Utilities.base64EncodeWebSafe(Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      JSON.stringify([childName, schoolClass, district, parentPhone]),
      Utilities.Charset.UTF_8
    ));

    // Un historique borné évite le doublon lors du repli CORS ou d'une nouvelle tentative.
    let recent = JSON.parse(properties.getProperty("RECENT_SUBMISSIONS") || "[]");
    recent = recent.filter(function (entry) { return now - entry.time < DEDUPLICATION_MS; });
    const previous = recent.find(function (entry) { return entry.id === requestId; });
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Error("Cet identifiant a déjà été utilisé pour une autre inscription.");
      return reponse_({ result: "success" });
    }

    sheet.appendRow([
      Utilities.formatDate(new Date(now), TIME_ZONE, "dd/MM/yyyy HH:mm:ss"),
      neutraliserFormule_(childName),
      neutraliserFormule_(schoolClass),
      neutraliserFormule_(district),
      neutraliserFormule_(parentPhone),
      "Nouveau"
    ]);
    SpreadsheetApp.flush();
    recent.push({ id: requestId, fingerprint: fingerprint, time: now });
    // 40 entrées restent sous la limite de taille d'une propriété Apps Script.
    properties.setProperty("RECENT_SUBMISSIONS", JSON.stringify(recent.slice(-40)));
    return reponse_({ result: "success" });
  } catch (error) {
    // Ne pas exposer les détails techniques d'une exception Google au public.
    const technicalError = !error || !error.message || /(?:Exception:|Service |You do not|Access denied|permission|SpreadsheetApp|Unexpected token|Quota|invoked too many|Document)/i.test(error.message);
    return reponse_({
      result: "error",
      message: technicalError
        ? "Le service est temporairement indisponible. Réessayez ou contactez Crazy Hub."
        : error.message
    });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function lireChamp_(value, label) {
  if (typeof value !== "string") throw new Error(label + " : valeur manquante ou invalide.");
  // Rejeter les dépassements plutôt que tronquer silencieusement un nom ou un numéro.
  if (value.length > 100) throw new Error(label + " : maximum 100 caractères.");
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) throw new Error(label + " : ce champ est obligatoire.");
  return cleaned;
}

function neutraliserFormule_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function obtenirFeuille_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#041E5A")
      .setFontColor("#FFFFFF")
      .setWrap(true);
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, HEADERS.length, 185);
    sheet.setColumnWidth(2, 260);
    // Conserver le téléphone comme texte, y compris son préfixe international.
    sheet.getRange("E:E").setNumberFormat("@");
  }
  return sheet;
}

function reponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
