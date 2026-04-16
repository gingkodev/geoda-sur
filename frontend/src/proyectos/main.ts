import "../shared/styles.css";
import { initCursor } from "../shared/cursor";
// import { initMobileNav } from "../shared/nav";
import { getProjects, getServices, type Project, type Service } from "../shared/api";
import { getAnalyser, ensureAudioContext } from "./audio-analyser";
import { createBogeySketch } from "./sketch";
import { t, currentLang, switchLang } from "../shared/i18n";

declare const p5: any;

// Card colors from blog palette
const CARD_COLORS = ["#d4e8f5", "#c8e6c8", "#f5d0d0", "#f5f0a0"];

initCursor();

// Translate static HTML elements
const sidebarHome = document.getElementById("sidebar-home");
if (sidebarHome) sidebarHome.textContent = t("projects.home");
const mobileHome = document.getElementById("mobile-home");
if (mobileHome) mobileHome.textContent = t("projects.home");

const isMobile = window.innerWidth < 768;
// Mobile nav commented out — using fixed overlay instead
// if (isMobile) {
//   initMobileNav(document.getElementById("nav"));
// }

const container = document.getElementById("projects-container")!;
const emptyEl = document.getElementById("projects-empty")!;

if (isMobile) {
  container.style.scrollSnapType = "none";
  container.classList.remove("h-screen");
  container.classList.add("min-h-screen", "h-auto");
}
const projectListEl = document.getElementById("project-list");
const audioEl = document.getElementById("project-audio") as HTMLAudioElement;

// --- State ---
let activeProjectSlug: string | null = null;
let fadeTimeout: ReturnType<typeof setTimeout> | null = null;
let fadeInterval: ReturnType<typeof setInterval> | null = null;
let muted = true;
const canvasContainers: Map<string, HTMLElement> = new Map();
const slugColors: Map<string, string> = new Map();
let sketchInstance: any = null;
let analyserReady = false;
let pendingProjects: Project[] | null = null;

// --- Audio analyser + sketch init (lazy, on first user gesture) ---
function initSketchIfNeeded() {
  if (analyserReady) return;
  analyserReady = true;
  const analyser = getAnalyser(audioEl);

  // Attach to the active project's canvas container
  const activeContainer = activeProjectSlug ? canvasContainers.get(activeProjectSlug) : null;
  if (activeContainer) {
    const sketchFn = createBogeySketch(analyser, activeContainer);
    sketchInstance = new p5(sketchFn, activeContainer);
    const color = activeProjectSlug ? slugColors.get(activeProjectSlug) : null;
    if (color) sketchInstance.setBogeyColor?.(color);
  }
}

function moveSketchTo(slug: string) {
  const container = canvasContainers.get(slug);
  if (!container) return;

  const color = slugColors.get(slug) ?? "#d4e8f5";

  if (sketchInstance) {
    // Clear old bogeys and set new color
    sketchInstance.clearBogeys?.();
    sketchInstance.setBogeyColor?.(color);

    // Move existing canvas into the new container
    const canvas = sketchInstance.canvas;
    if (canvas) {
      container.appendChild(canvas);
      sketchInstance.resizeCanvas(container.clientWidth, container.clientHeight);
    }
  } else if (analyserReady) {
    const analyser = getAnalyser(audioEl);
    sketchInstance = new p5(createBogeySketch(analyser, container), container);
    sketchInstance.setBogeyColor?.(color);
  }
}

// --- Start muted, audio element matches ---
audioEl.muted = true;

// --- Mute button: also serves as the user gesture to unlock AudioContext ---
const muteBtn = document.getElementById("mute-btn")!;
muteBtn.textContent = t("projects.sound_off");
muteBtn.addEventListener("click", () => {
  muted = !muted;
  muteBtn.textContent = muted ? t("projects.sound_off") : t("projects.sound_on");
  audioEl.muted = muted;

  if (!muted) {
    // User gesture — unlock audio + sketch
    ensureAudioContext();
    initSketchIfNeeded();

    // If audio isn't playing yet, start it for the current project
    if (audioEl.paused && activeProjectSlug && pendingProjects) {
      const project = pendingProjects.find((p) => slugify(p.name) === activeProjectSlug);
      if (project?.audio_url) {
        startAudioFade(project.audio_url);
      }
    }
  }
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// --- Lang toggle for projects sidebar ---
function addLangToggle() {
  const esClass = currentLang === "es" ? "bg-cream text-ink" : "text-cream";
  const enClass = currentLang === "en" ? "bg-cream text-ink" : "text-cream";
  const html = `
    <div class="flex gap-0 mt-4 text-[10px] tracking-wider uppercase">
      <button data-switch-lang="es" class="lang-btn px-1.5 py-0.5 ${esClass}">ES</button>
      <span class="text-cream/50 px-0.5">/</span>
      <button data-switch-lang="en" class="lang-btn px-1.5 py-0.5 ${enClass}">EN</button>
    </div>
  `;

  // Desktop sidebar
  const sidebar = document.getElementById("sidebar");
  if (sidebar && !isMobile) {
    sidebar.insertAdjacentHTML("beforeend", html);
  }

  // Mobile nav
  const mobileNav = document.getElementById("mobile-project-nav");
  if (mobileNav && isMobile) {
    const mobileHtml = html.replace(/text-cream/g, "text-ink").replace(/bg-cream text-ink/g, "bg-ink text-cream");
    mobileNav.insertAdjacentHTML("beforeend", mobileHtml);
  }

  document.querySelectorAll<HTMLButtonElement>(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.dataset.switchLang as "es" | "en";
      if (lang !== currentLang) switchLang(lang);
    });
  });
}

// --- Render ---
function render(projects: Project[], services: Service[]) {
  pendingProjects = projects;

  if (!projects.length) {
    emptyEl.textContent = t("projects.empty");
    emptyEl.classList.remove("hidden");
    container.style.display = "";
    return;
  }

  // Build service lookup
  const serviceMap = new Map<number, string>();
  for (const s of services) {
    serviceMap.set(s.id, s.name);
  }

  // Shuffle colors so they feel random but stable per session
  const colorOrder = [...CARD_COLORS].sort(() => Math.random() - 0.5);

  // Add lang toggle to sidebar
  addLangToggle();

  if (isMobile) {
    // Build project list (mobile overlay only)
    const mobileListEl = document.getElementById("mobile-project-list");
    if (mobileListEl) {
      for (const project of projects) {
        const slug = slugify(project.name);
        const a = document.createElement("a");
        a.href = `#${slug}`;
        a.className =
          "project-list-link text-[10px] tracking-wider uppercase no-underline text-cream px-1 py-px";
        a.textContent = project.name;
        a.dataset.slug = slug;
        mobileListEl.appendChild(a);
      }

      mobileListEl.addEventListener("click", (e) => {
        const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(".project-list-link");
        if (!link) return;
        e.preventDefault();
        const slug = link.dataset.slug!;
        document.getElementById(slug)?.scrollIntoView({ behavior: "smooth" });
        setActiveProject(slug, projects);
      });
    }
  } else {
    // Build project list (desktop sidebar only)
    if (projectListEl) {
      for (const project of projects) {
        const slug = slugify(project.name);
        const a = document.createElement("a");
        a.href = `#${slug}`;
        a.className =
          "project-list-link text-[10px] tracking-wider uppercase no-underline text-cream px-1 py-px";
        a.textContent = project.name;
        a.dataset.slug = slug;
        projectListEl.appendChild(a);
      }
    }
  }

  // Build project sections
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const slug = slugify(project.name);
    const color = colorOrder[i % colorOrder.length];
    const serviceNames = project.service_ids
      .map((id) => serviceMap.get(id))
      .filter(Boolean) as string[];

    const section = document.createElement("section");
    section.id = slug;
    section.className = isMobile
      ? "project-section flex flex-col min-h-screen"
      : "project-section flex flex-col h-screen";
    if (!isMobile) section.style.scrollSnapAlign = "start";

    // --- Hero (image + canvas overlay) ---
    const hero = document.createElement("div");
    hero.className = "relative w-full overflow-hidden bg-ink shrink-0";
    hero.style.height = isMobile ? "45vh" : "55vh";

    if (project.img_url) {
      const img = document.createElement("img");
      img.src = project.img_url;
      img.alt = project.name;
      img.className = "w-full h-full object-cover";
      img.loading = "lazy";
      hero.appendChild(img);
    }

    // Dark overlay
    const overlay = document.createElement("div");
    overlay.className = "absolute inset-0 bg-ink/40";
    hero.appendChild(overlay);

    // Canvas overlay for p5.js
    const canvasContainer = document.createElement("div");
    canvasContainer.className = "absolute inset-0 z-[1] pointer-events-none";
    canvasContainer.id = `canvas-${slug}`;
    hero.appendChild(canvasContainer);
    canvasContainers.set(slug, canvasContainer);
    slugColors.set(slug, color);

    section.appendChild(hero);

    // --- Content card ---
    // Wrapper with white bg so the sidebar region stays white
    const contentWrap = document.createElement("div");
    contentWrap.className = "flex-1 flex flex-col bg-white";

    const content = document.createElement("div");
    content.style.backgroundColor = color;
    content.className = isMobile
      ? "px-4 py-8 flex-1"
      : "px-6 py-12 flex-1 overflow-y-auto mr-56";

    const inner = document.createElement("div");
    inner.className = isMobile
      ? "flex flex-col gap-6"
      : "flex gap-16 max-w-6xl";

    // Left column: name + services
    const left = document.createElement("div");
    left.className = isMobile ? "" : "w-64 shrink-0";
    left.innerHTML = `
      <h2 class="text-xl font-medium uppercase tracking-wider leading-tight mb-4">${project.name}</h2>
      ${
        serviceNames.length
          ? `<div class="text-[10px] uppercase tracking-wider leading-relaxed">${serviceNames.join(" | ")}</div>`
          : ""
      }
    `;

    // Right column: writeup
    const right = document.createElement("div");
    right.className = "flex-1";
    right.innerHTML = `<div class="text-[11px] uppercase leading-[1.8] tracking-wide">${project.writeup}</div>`;

    inner.appendChild(left);
    inner.appendChild(right);
    content.appendChild(inner);
    contentWrap.appendChild(content);
    section.appendChild(contentWrap);

    container.appendChild(section);
  }

  // --- Scroll observer for active project ---
  const sections = document.querySelectorAll<HTMLElement>(".project-section");
  const slugs = projects.map((p) => slugify(p.name));

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const slug = entry.target.id;
          if (slug !== activeProjectSlug) {
            setActiveProject(slug, projects);
          }
        }
      }
    },
    { root: container, threshold: 0.5 },
  );

  sections.forEach((s) => observer.observe(s));

  // --- Arrow key navigation ---
  function navigateTo(index: number) {
    const clamped = Math.max(0, Math.min(index, slugs.length - 1));
    const slug = slugs[clamped];
    document.getElementById(slug)?.scrollIntoView({ behavior: "smooth" });
    setActiveProject(slug, projects);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const currentIdx = activeProjectSlug ? slugs.indexOf(activeProjectSlug) : -1;
      navigateTo(currentIdx + 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const currentIdx = activeProjectSlug ? slugs.indexOf(activeProjectSlug) : 1;
      navigateTo(currentIdx - 1);
    }
  });

  // Hash scroll on load — instant so user lands directly on the target
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) {
      target.scrollIntoView({ behavior: "instant" });
      setActiveProject(location.hash.slice(1), projects);
    }
  } else if (projects.length) {
    setActiveProject(slugs[0], projects);
  }

  // Hash click from sidebar
  projectListEl?.addEventListener("click", (e) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(".project-list-link");
    if (!link) return;
    e.preventDefault();
    const slug = link.dataset.slug!;
    document.getElementById(slug)?.scrollIntoView({ behavior: "smooth" });
    setActiveProject(slug, projects);
  });

  container.style.display = "";
  const sidebar = document.getElementById("sidebar");
  const mobileNav = document.getElementById("mobile-project-nav");
  const muteEl = document.getElementById("mute-btn");
  if (sidebar) sidebar.style.display = "";
  if (mobileNav) mobileNav.style.display = "";
  if (muteEl) muteEl.style.display = "";
}

// --- Active project + audio ---
function setActiveProject(slug: string, projects: Project[]) {
  activeProjectSlug = slug;

  // Update sidebar highlights — invert block for active (desktop)
  document.querySelectorAll(".project-list-link").forEach((el) => {
    const link = el as HTMLElement;
    if (link.dataset.slug === slug) {
      link.style.backgroundColor = "#f5f3ef";
      link.style.color = "#1a1a1a";
    } else {
      link.style.backgroundColor = "";
      link.style.color = "";
    }
  });


  // Move sketch canvas to the active project's hero
  moveSketchTo(slug);

  // Find project for audio
  const project = projects.find((p) => slugify(p.name) === slug);
  startAudioFade(project?.audio_url ?? null);
}

function startAudioFade(url: string | null) {
  // Clear any pending fade
  if (fadeTimeout) clearTimeout(fadeTimeout);
  if (fadeInterval) clearInterval(fadeInterval);

  // Fade out current audio if playing
  if (!audioEl.paused) {
    fadeOut(() => {
      audioEl.pause();
      audioEl.currentTime = 0;
      if (url) queueFadeIn(url);
    });
  } else {
    audioEl.pause();
    audioEl.currentTime = 0;
    if (url) queueFadeIn(url);
  }
}

function queueFadeIn(url: string) {
  if (muted) return; // Don't play if muted
  fadeTimeout = setTimeout(() => {
    audioEl.src = url;
    audioEl.volume = 0;
    audioEl.loop = true;
    ensureAudioContext();
    audioEl.play().then(() => {
      initSketchIfNeeded();
      fadeIn();
    }).catch((e) => console.log("Audio play failed:", e));
  }, 3000);
}

function fadeIn() {
  const duration = 2000;
  const steps = 40;
  const stepTime = duration / steps;
  let step = 0;

  fadeInterval = setInterval(() => {
    step++;
    audioEl.volume = Math.min(1, step / steps);
    if (step >= steps && fadeInterval) clearInterval(fadeInterval);
  }, stepTime);
}

function fadeOut(onDone: () => void) {
  const duration = 500;
  const steps = 20;
  const stepTime = duration / steps;
  let step = 0;
  const startVol = audioEl.volume;

  fadeInterval = setInterval(() => {
    step++;
    audioEl.volume = Math.max(0, startVol * (1 - step / steps));
    if (step >= steps) {
      if (fadeInterval) clearInterval(fadeInterval);
      onDone();
    }
  }, stepTime);
}

export { canvasContainers, audioEl };

// --- Init ---
Promise.all([getProjects(), getServices()])
  .then(([projects, services]) => render(projects, services))
  .catch((err) => {
    console.error("Projects fetch failed:", err);
    container.style.display = "";
    emptyEl.classList.remove("hidden");
  });
