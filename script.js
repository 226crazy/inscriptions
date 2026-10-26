"use strict";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzaKLd8upxXIXHxdlMnjyc9KphBwa76AaeFwKICx8_LluYebvb0ODir01q8K-jtkvzTYQ/exec";

(() => {
  const DUPLICATE_WINDOW_MS = 30_000;
  const REQUEST_TIMEOUT_MS = 25_000;
  const classes = new Set(["CP1", "CP2", "CE1", "CE2", "CM1", "CM2", "6ème", "5ème", "4ème", "3ème", "2nde", "1ère", "Terminale"]);
  const form = document.getElementById("registration-form");
  const button = document.getElementById("submit-button");
  const buttonLabel = document.getElementById("submit-label");
  const spinner = button.querySelector(".spinner");
  const arrow = button.querySelector(".submit-arrow");
  const message = document.getElementById("form-message");
  const successPanel = document.getElementById("success-panel");
  const fields = {
    childName: document.getElementById("child-name"),
    schoolClass: document.getElementById("school-class"),
    district: document.getElementById("district"),
    parentPhone: document.getElementById("parent-phone"),
  };
  let sending = false;
  let lastSuccess = null;
  let pendingSubmission = null;
  button.disabled = false;

  // Les replis restent présents avant le chargement et si le fichier manque.
  document.querySelectorAll("[data-fallback-image]").forEach((image) => {
    const update = () => image.parentElement.classList.toggle("is-loaded", image.complete && image.naturalWidth > 0);
    image.addEventListener("load", update);
    image.addEventListener("error", update);
    update();
  });

  function cleanText(value) {
    return value.trim().replace(/\s+/g, " ");
  }

  function normalizePhone(value) {
    const compact = value.replace(/\s/g, "");
    if (!/^(?:(?:\+226|00226))?\d{8}$/.test(compact)) return null;
    return "+226" + compact.replace(/^(?:\+226|00226)/, "");
  }

  function fieldError(input, text) {
    document.getElementById(input.id + "-error").textContent = text;
    if (text) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function validateField(key) {
    const input = fields[key];
    const value = cleanText(input.value);
    let error = "";
    if (!value) {
      error = {
        childName: "Indiquez le nom et le prénom de votre enfant.",
        schoolClass: "Sélectionnez la classe de votre enfant.",
        district: "Indiquez votre quartier.",
        parentPhone: "Indiquez le numéro de téléphone du parent.",
      }[key];
    } else if (input.value.length > 100) {
      error = "Ce champ ne doit pas dépasser 100 caractères.";
    } else if (key === "childName" && value.length < 3) {
      error = "Le nom et le prénom doivent comporter au moins 3 caractères.";
    } else if (key === "schoolClass" && !classes.has(value)) {
      error = "Choisissez une classe dans la liste.";
    } else if (key === "parentPhone" && !normalizePhone(input.value)) {
      error = "Saisissez 8 chiffres, avec ou sans espaces, +226 ou 00226.";
    }
    fieldError(input, error);
    return !error;
  }

  Object.entries(fields).forEach(([key, input]) => {
    input.addEventListener("blur", () => {
      if (input.value || input.getAttribute("aria-invalid") === "true") validateField(key);
    });
    input.addEventListener(key === "schoolClass" ? "change" : "input", () => {
      if (input.getAttribute("aria-invalid") === "true") validateField(key);
      message.hidden = true;
    });
  });

  function setSending(value) {
    sending = value;
    button.disabled = value;
    buttonLabel.textContent = value ? "Envoi en cours…" : "Inscrire mon enfant";
    spinner.hidden = !value;
    arrow.hidden = value;
    form.setAttribute("aria-busy", String(value));
    document.getElementById("submission-status").textContent = value ? "Envoi en cours…" : "";
    // Figer les données affichées pendant l'envoi évite une confirmation ambiguë.
    Object.values(fields).forEach((input) => { input.disabled = value; });
  }

  function showError(text) {
    message.replaceChildren(document.createTextNode(text + " Vous pouvez nous appeler au "));
    [
      ["51 58 91 91", "tel:+22651589191"],
      ["65 00 09 17", "tel:+22665000917"],
    ].forEach(([label, href], index) => {
      if (index) message.append(document.createTextNode(" / "));
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      message.append(link);
    });
    message.append(document.createTextNode("."));
    message.hidden = false;
  }

  function showSuccess(data) {
    // textContent empêche toute interprétation HTML d'un nom saisi.
    const firstName = data.childName.split(" ").slice(-1)[0];
    document.getElementById("success-message").textContent =
      `Merci ! L'inscription de ${firstName} est bien enregistrée. Nous vous contactons très bientôt.`;
    form.hidden = true;
    document.getElementById("form-heading").hidden = true;
    successPanel.hidden = false;
    successPanel.focus({ preventScroll: true });
    successPanel.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "nearest",
    });
  }

  function createRequestId() {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function post(body, mode) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      // Ne pas ajouter Content-Type: application/json : cela impose un preflight.
      return await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode,
        body,
        signal: controller.signal,
        credentials: "omit",
        redirect: "follow",
        referrerPolicy: "no-referrer",
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function send(data) {
    const body = JSON.stringify(data);
    let response;
    try {
      response = await post(body, "cors");
    } catch (error) {
      // Le navigateur ne distingue pas une erreur réseau d'un refus CORS.
      if (!(error instanceof TypeError)) throw error;
      response = await post(body, "no-cors");
      if (response.type === "opaque") return;
    }

    if (!response.ok) throw new Error("Le service est temporairement indisponible.");

    let result;
    try {
      result = await response.json();
    } catch (error) {
      if (!(error instanceof TypeError)) {
        throw new Error("La réponse du service est invalide. Vérifiez son déploiement.");
      }
      // Même identifiant : le serveur déduplique le second POST si le premier a abouti.
      const fallback = await post(body, "no-cors");
      if (fallback.type === "opaque") return;
      if (!fallback.ok) throw new Error("Le service est temporairement indisponible.");
      result = await fallback.json();
    }
    if (!result || result.result !== "success") {
      throw new Error(result && typeof result.message === "string"
        ? result.message
        : "L'inscription n'a pas pu être enregistrée.");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending || document.getElementById("website").value.trim()) return;
    message.hidden = true;

    const invalidKeys = Object.keys(fields).filter((key) => !validateField(key));
    if (invalidKeys.length) {
      fields[invalidKeys[0]].focus();
      return;
    }
    const data = {
      childName: cleanText(fields.childName.value),
      schoolClass: fields.schoolClass.value,
      district: cleanText(fields.district.value),
      parentPhone: normalizePhone(fields.parentPhone.value),
      website: "",
    };
    const fingerprint = JSON.stringify(data);
    if (lastSuccess && lastSuccess.fingerprint === fingerprint && Date.now() - lastSuccess.time < DUPLICATE_WINDOW_MS) {
      showSuccess(data);
      return;
    }

    if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(APPS_SCRIPT_URL)) {
      showError("Les inscriptions en ligne ne sont pas encore configurées.");
      return;
    }

    // Conserver l'identifiant après une erreur permet de réessayer sans doublon.
    if (!pendingSubmission || pendingSubmission.fingerprint !== fingerprint || Date.now() - pendingSubmission.time > 600_000) {
      pendingSubmission = { fingerprint, requestId: createRequestId(), time: Date.now() };
    }
    data.requestId = pendingSubmission.requestId;
    setSending(true);
    try {
      await send(data);
      lastSuccess = { fingerprint, time: Date.now() };
      pendingSubmission = null;
      showSuccess(data);
    } catch (error) {
      showError(error.name === "AbortError"
        ? "Le délai d'attente est dépassé. Vos données sont conservées : vous pouvez réessayer."
        : error instanceof TypeError
          ? "L'envoi a échoué. Vérifiez votre connexion puis réessayez."
          : error.message || "Une erreur empêche l'envoi. Réessayez dans un instant.");
    } finally {
      setSending(false);
    }
  });

  document.getElementById("another-child").addEventListener("click", () => {
    form.reset();
    Object.values(fields).forEach((input) => fieldError(input, ""));
    message.hidden = true;
    successPanel.hidden = true;
    document.getElementById("form-heading").hidden = false;
    form.hidden = false;
    fields.childName.focus();
    // lastSuccess reste en mémoire pendant la fenêtre anti-doublon.
  });
})();
