import "../shared/styles.css";
import { initCursor } from "../shared/cursor";
import { initNav, initMobileNav } from "../shared/nav";
import { postContact } from "../shared/api";
import { t } from "../shared/i18n";

initCursor();
const isMobile = window.innerWidth < 768;
if (isMobile) {
  initMobileNav(document.getElementById("nav"));
} else {
  initNav(document.getElementById("nav"));
}

const mainEl = document.querySelector("main") as HTMLElement | null;
if (mainEl) mainEl.style.visibility = "";

// Translate static HTML elements
const pageTitle = document.querySelector("h1");
if (pageTitle) pageTitle.textContent = t("contact.title");

document.querySelectorAll<HTMLElement>("label .text-muted").forEach((el) => {
  const input = el.parentElement?.querySelector("input, textarea");
  if (!input) return;
  const name = (input as HTMLInputElement).name;
  if (name === "name") el.textContent = t("contact.name");
  else if (name === "email") el.textContent = t("contact.email");
  else if (name === "message") el.textContent = t("contact.message");
});

const submitBtn = document.querySelector("button[type=submit]") as HTMLButtonElement;
submitBtn.textContent = t("contact.submit");

const form = document.getElementById("contact-form") as HTMLFormElement;
const feedback = document.getElementById("form-feedback")!;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  feedback.classList.add("hidden");

  const data = new FormData(form);
  const name = (data.get("name") as string).trim();
  const email = (data.get("email") as string).trim();
  const message = (data.get("message") as string).trim();

  if (!name || !email || !message) {
    showFeedback(t("contact.required"), true);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = t("contact.sending");

  try {
    await postContact({ name, email, message });
    form.reset();
    showFeedback(t("contact.success"), false);
  } catch (err: any) {
    showFeedback(err.message || t("contact.error"), true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t("contact.submit");
  }
});

function showFeedback(msg: string, isError: boolean) {
  feedback.textContent = msg;
  feedback.className = `text-xs ${isError ? "text-red-600" : "text-green-700"}`;
  feedback.classList.remove("hidden");
}
