export type Lang = "es" | "en";

const STORAGE_KEY = "cardinal_lang";

const strings: Record<string, Record<Lang, string>> = {
  // Nav
  "nav.home": { es: "Inicio", en: "Home" },
  "nav.projects": { es: "Proyectos", en: "Projects" },
  "nav.services": { es: "Servicios", en: "Services" },
  "nav.blog": { es: "Blog", en: "Blog" },
  "nav.rental": { es: "Rental", en: "Rental" },
  "nav.training": { es: "Formación", en: "Training" },
  "nav.contact": { es: "Contacto", en: "Contact" },

  // Contact form
  "contact.title": { es: "Contacto", en: "Contact" },
  "contact.name": { es: "Nombre", en: "Name" },
  "contact.email": { es: "Email", en: "Email" },
  "contact.message": { es: "Mensaje", en: "Message" },
  "contact.submit": { es: "Enviar", en: "Send" },
  "contact.sending": { es: "Enviando...", en: "Sending..." },
  "contact.success": { es: "Mensaje enviado. Gracias.", en: "Message sent. Thank you." },
  "contact.error": { es: "Error al enviar. Intentá de nuevo.", en: "Error sending. Please try again." },
  "contact.required": { es: "Completá todos los campos.", en: "Please fill in all fields." },

  // Services
  "services.title": { es: "Servicios", en: "Services" },
  "services.empty": { es: "No hay servicios aún", en: "No services yet" },
  "services.related": { es: "Proyectos relacionados", en: "Related projects" },

  // Projects
  "projects.empty": { es: "No hay proyectos aún", en: "No projects yet" },
  "projects.home": { es: "Inicio", en: "Home" },
  "projects.sound_off": { es: "Sonido: Off", en: "Sound: Off" },
  "projects.sound_on": { es: "Sonido: On", en: "Sound: On" },

  // Blog
  "blog.empty": { es: "Sin entradas", en: "No entries yet" },

  // Home
  "home.empty": { es: "Sin contenido", en: "No content yet" },
};

/**
 * Detect language: ?lang= param > localStorage > 'es'
 * Also persists the param choice to localStorage.
 */
export function detectLang(): Lang {
  const params = new URLSearchParams(window.location.search);
  const paramLang = params.get("lang");
  if (paramLang === "en" || paramLang === "es") {
    localStorage.setItem(STORAGE_KEY, paramLang);
    return paramLang;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "es") return stored;

  return "es";
}

export function t(key: string): string {
  const entry = strings[key];
  if (!entry) return key;
  return entry[currentLang] ?? entry.es;
}

export function switchLang(lang: Lang) {
  localStorage.setItem(STORAGE_KEY, lang);
  // Preserve current URL, update/add ?lang= param
  const url = new URL(window.location.href);
  url.searchParams.set("lang", lang);
  window.location.href = url.toString();
}

/** Current active language — set once on module load */
export const currentLang: Lang = detectLang();

/** Language query string to append to API calls */
export const langParam: string = `lang=${currentLang}`;

// Update <html lang=""> to match
document.documentElement.lang = currentLang;
