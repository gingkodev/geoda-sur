import "../shared/styles.css";
import { initCursor } from "../shared/cursor";
import { initNav, initMobileNav } from "../shared/nav";
import { getServices, type Service } from "../shared/api";
import { t } from "../shared/i18n";

initCursor();
const isMobile = window.innerWidth < 768;
if (isMobile) {
  initMobileNav(document.getElementById("nav"));
} else {
  initNav(document.getElementById("nav"));
}

const mainEl = document.getElementById("services-main")!;
const tocEl = document.getElementById("toc")!;
const container = document.getElementById("services-container")!;
const emptyEl = document.getElementById("services-empty")!;
emptyEl.textContent = t("services.empty");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function renderServices(services: Service[]) {
  if (!services.length) {
    emptyEl.classList.remove("hidden");
    mainEl.style.display = "";
    return;
  }

  // TOC
  tocEl.innerHTML = `
    <h1 class="text-sm tracking-widest uppercase font-medium mb-4">${t("services.title")}</h1>
    <nav class="flex flex-col gap-1">
      ${services
        .map(
          (s) =>
            `<a href="#${slugify(s.name)}" class="nav-link text-[10px] tracking-wider uppercase text-muted px-1 py-0.5 -ml-1 no-underline">${s.name}</a>`,
        )
        .join("")}
    </nav>
  `;

  // Sections
  for (const service of services) {
    const slug = slugify(service.name);
    const section = document.createElement("section");
    section.id = slug;
    section.className = "mb-16 scroll-mt-16";
    section.innerHTML = `
      <h2 class="text-xs tracking-widest uppercase font-medium mb-4">${service.name}</h2>
      <div class="text-xs leading-relaxed">${service.description}</div>
    `;
    container.appendChild(section);
  }

  // Hash scroll
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ behavior: "smooth" });
  }

  mainEl.style.display = "";
}

getServices()
  .then(renderServices)
  .catch((err) => {
    console.error("Services fetch failed:", err);
    mainEl.style.display = "";
    emptyEl.classList.remove("hidden");
  });
