import "../shared/styles.css";
import { initCursor } from "../shared/cursor";
import { initNav, initMobileNav } from "../shared/nav";
import { getFormacion } from "../shared/api";
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

const titleEl = document.getElementById("formacion-title")!;
titleEl.textContent = t("nav.training");
document.title = `CARDINAL SUR — ${t("nav.training")}`;

const introEl = document.getElementById("formacion-intro")!;
const gridEl = document.getElementById("formacion-grid")!;

async function load() {
  try {
    const data = await getFormacion();

    introEl.textContent = data.intro;

    gridEl.innerHTML = (data.images ?? [])
      .map((img) => {
        const src = isMobile && img.mobile_img_url ? img.mobile_img_url : img.img_url;
        return `<img src="${src}" alt="" loading="lazy"
          class="w-full aspect-[4/5] object-cover bg-ink/5">`;
      })
      .join("");
  } catch (err) {
    console.error("Failed to load formacion:", err);
    introEl.textContent = "";
  }
}

load();
