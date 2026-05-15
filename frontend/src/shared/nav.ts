import { t, currentLang, switchLang } from "./i18n";

interface NavLink {
  label: string;
  href: string;
}

export function getLinks(): NavLink[] {
  return [
    { label: t("nav.home"), href: "/" },
    { label: t("nav.projects"), href: "/proyectos" },
    { label: t("nav.services"), href: "/servicios" },
    { label: t("nav.blog"), href: "/blog" },
    { label: t("nav.rental"), href: "/rental" },
    { label: t("nav.training"), href: "/formacion" },
    { label: t("nav.contact"), href: "/contacto" },
  ];
}

const LANG_BTN_BASE = "lang-btn px-1.5 py-0.5";
const LANG_ACTIVE = "bg-ink text-cream";
const LANG_INACTIVE = "text-ink";

function langToggleHTML(): string {
  const esClass = currentLang === "es" ? LANG_ACTIVE : LANG_INACTIVE;
  const enClass = currentLang === "en" ? LANG_ACTIVE : LANG_INACTIVE;
  return `
    <div class="flex gap-0 mt-6 text-[10px] tracking-wider uppercase">
      <button data-switch-lang="es" class="${LANG_BTN_BASE} ${esClass}">ES</button>
      <span class="text-ink/50 px-0.5">/</span>
      <button data-switch-lang="en" class="${LANG_BTN_BASE} ${enClass}">EN</button>
    </div>
  `;
}

function bindLangButtons(container: HTMLElement) {
  container.querySelectorAll<HTMLButtonElement>(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.dataset.switchLang as "es" | "en";
      if (lang !== currentLang) switchLang(lang);
    });
  });
}

export function initNav(container: HTMLElement | null) {
  if (!container) return;

  const current = window.location.pathname.replace(/\/+$/, "") || "/";
  const links = getLinks();

  const html = `
    <div class="text-sm tracking-widest uppercase font-medium">
      <a href="/" class="nav-link px-1 py-0.5 -ml-1 no-underline text-ink">Cardinal Sur</a>
    </div>
    <nav class="flex flex-col gap-2 mt-6">
      ${links
        .map((l) => {
          const active = current === l.href;
          return `<a href="${l.href}"
            class="nav-link text-xs tracking-wider uppercase px-1 py-0.5 -ml-1 no-underline
              ${active ? "bg-ink text-cream" : "text-ink"}"
          >${l.label}</a>`;
        })
        .join("\n")}
    </nav>
    ${langToggleHTML()}
  `;

  container.innerHTML = html;
  bindLangButtons(container);
  container.style.visibility = "";
  revealCompass();
}

function revealCompass() {
  const compass = document.getElementById("compass");
  if (compass) compass.style.visibility = "";
}

/** Mobile hamburger nav */
export function initMobileNav(container: HTMLElement | null) {
  if (!container) return;
  if (window.innerWidth >= 768) {
    initNav(container);
    return;
  }

  const current = window.location.pathname.replace(/\/+$/, "") || "/";
  const links = getLinks();

  const esClass = currentLang === "es" ? LANG_ACTIVE : LANG_INACTIVE;
  const enClass = currentLang === "en" ? LANG_ACTIVE : LANG_INACTIVE;

  container.innerHTML = `
    <div class="flex items-center justify-between px-4 py-3">
      <a href="/" class="text-sm tracking-widest uppercase font-medium no-underline text-ink">Cardinal Sur</a>
      <div class="flex items-center gap-3">
        <div class="flex gap-0 text-[10px] tracking-wider uppercase">
          <button data-switch-lang="es" class="${LANG_BTN_BASE} ${esClass}">ES</button>
          <span class="text-ink/50 px-0.5">/</span>
          <button data-switch-lang="en" class="${LANG_BTN_BASE} ${enClass}">EN</button>
        </div>
        <button id="hamburger" class="text-ink text-lg leading-none cursor-auto min-w-[44px] min-h-[44px] flex items-center justify-center">&#9776;</button>
      </div>
    </div>
    <nav id="mobile-menu" class="hidden flex-col gap-2 px-4 pb-4">
      ${links
        .map((l) => {
          const active = current === l.href;
          return `<a href="${l.href}"
            class="text-xs tracking-wider uppercase py-1 no-underline
              ${active ? "font-medium" : "text-muted"}"
          >${l.label}</a>`;
        })
        .join("\n")}
    </nav>
  `;

  document.getElementById("hamburger")!.addEventListener("click", () => {
    const menu = document.getElementById("mobile-menu")!;
    menu.classList.toggle("hidden");
    menu.classList.toggle("flex");
  });

  bindLangButtons(container);
  container.style.visibility = "";
  revealCompass();
}
