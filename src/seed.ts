import "dotenv/config";
import pool from "./db.js";

async function seed() {
  console.log("Seeding database...");

  // Services
  const services = [
    { name: "Dirección Musical Creativa", name_en: "Creative Music Direction", description: "Creamos dirección musical a medida para producciones audiovisuales, sesiones en vivo y proyectos artísticos. Trabajamos de cerca con el artista para encontrar la identidad sonora del proyecto.", description_en: "We create custom music direction for audiovisual productions, live sessions, and artistic projects. We work closely with the artist to find the sonic identity of each project." },
    { name: "Producción Musical", name_en: "Music Production", description: "Producción integral desde la preproducción hasta el master final. Grabación, mezcla y masterización en nuestro estudio o de forma remota.", description_en: "Full-cycle production from pre-production to final master. Recording, mixing, and mastering in our studio or remotely." },
    { name: "Diseño Sonoro", name_en: "Sound Design", description: "Diseño de sonido para cine, publicidad, instalaciones y experiencias interactivas. Creamos paisajes sonoros únicos que potencian la narrativa visual.", description_en: "Sound design for film, advertising, installations, and interactive experiences. We create unique soundscapes that enhance the visual narrative." },
    { name: "Formación", name_en: "Training", description: "Talleres y clases particulares de producción musical, síntesis, mezcla y tecnología musical. Programas personalizados para todos los niveles.", description_en: "Workshops and private lessons in music production, synthesis, mixing, and music technology. Customized programs for all levels." },
  ];

  for (const s of services) {
    await pool.query(
      `INSERT INTO services (name, name_en, description, description_en) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE description = VALUES(description), name_en = VALUES(name_en), description_en = VALUES(description_en)`,
      [s.name, s.name_en, s.description, s.description_en]
    );
  }
  console.log(`  ✓ ${services.length} services`);

  // Projects
  const projects = [
    { name: "Noche Polar — EP Debut", name_en: "Noche Polar — Debut EP", writeup: "Producción integral del EP debut de Noche Polar. 5 tracks que combinan electrónica con instrumentación orgánica. Grabado en Buenos Aires durante el invierno de 2024.", writeup_en: "Full production of Noche Polar's debut EP. 5 tracks blending electronic and organic instrumentation. Recorded in Buenos Aires during winter 2024.", img_url: "/uploads/images/5f8034c6-3cb6-4f01-8be5-3e19b42383b1.webp", audio_url: "/uploads/audio/c54c91a1-cbef-44c3-a281-b1f3d0323310.mp3" },
    { name: "Saramalacara — Dirección Musical en Vivo", name_en: "Saramalacara — Live Music Direction", writeup: "Dirección musical para la gira 2024 de Saramalacara. Arreglos para banda de 6 integrantes, diseño de setlist y dirección de ensayos.", writeup_en: "Music direction for Saramalacara's 2024 tour. Arrangements for a 6-piece band, setlist design, and rehearsal direction.", img_url: "/uploads/images/5f8034c6-3cb6-4f01-8be5-3e19b42383b1.webp", audio_url: null },
    { name: "Vecino Studios — Identidad Sonora", name_en: "Vecino Studios — Sonic Identity", writeup: "Diseño de la identidad sonora completa para Vecino Studios. Incluye logo sonoro, música de espera, transiciones y paisaje sonoro del espacio físico.", writeup_en: "Complete sonic identity design for Vecino Studios. Includes sonic logo, hold music, transitions, and physical space soundscape.", img_url: "/uploads/images/5f8034c6-3cb6-4f01-8be5-3e19b42383b1.webp", audio_url: null },
    { name: "Acru — Sesión Cardinal", name_en: "Acru — Cardinal Session", writeup: "Sesión de grabación y producción en vivo para el proyecto especial de Acru. Captura multitrack con arreglos en tiempo real.", writeup_en: "Live recording and production session for Acru's special project. Multitrack capture with real-time arrangements.", img_url: "/uploads/images/5f8034c6-3cb6-4f01-8be5-3e19b42383b1.webp", audio_url: "/uploads/audio/c54c91a1-cbef-44c3-a281-b1f3d0323310.mp3" },
    { name: "La Plazuela — Mezcla y Master", name_en: "La Plazuela — Mix & Master", writeup: "Mezcla y masterización del álbum completo de La Plazuela. 12 tracks de folk contemporáneo con arreglos orquestales.", writeup_en: "Mixing and mastering of La Plazuela's full album. 12 tracks of contemporary folk with orchestral arrangements.", img_url: "/uploads/images/5f8034c6-3cb6-4f01-8be5-3e19b42383b1.webp", audio_url: null },
  ];

  for (const p of projects) {
    await pool.query(
      `INSERT INTO projects (name, name_en, writeup, writeup_en, img_url, audio_url) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE writeup = VALUES(writeup), name_en = VALUES(name_en), writeup_en = VALUES(writeup_en)`,
      [p.name, p.name_en, p.writeup, p.writeup_en, p.img_url, p.audio_url]
    );
  }
  console.log(`  ✓ ${projects.length} projects`);

  // Link projects to services
  const [projectRows] = await pool.query<any[]>("SELECT id FROM projects WHERE is_deleted = 0 ORDER BY id");
  const [serviceRows] = await pool.query<any[]>("SELECT id FROM services WHERE is_deleted = 0 ORDER BY id");

  if (projectRows.length && serviceRows.length) {
    const links = [
      [0, 0], [0, 1], // project 0 → services 0,1
      [1, 0],         // project 1 → service 0
      [2, 2],         // project 2 → service 2
      [3, 0], [3, 1], // project 3 → services 0,1
      [4, 1],         // project 4 → service 1
    ];
    for (const [pi, si] of links) {
      if (projectRows[pi] && serviceRows[si]) {
        await pool.query(
          `INSERT IGNORE INTO projects_services (project_id, service_id) VALUES (?, ?)`,
          [projectRows[pi].id, serviceRows[si].id]
        );
      }
    }
    console.log(`  ✓ project-service links`);
  }

  // Blog entries
  const blogEntries = [
    { title: "Sobre el proceso creativo en producción", title_en: "On the creative process in production", category: "PRODUCCIÓN", type: "post", writeup: "Reflexiones sobre cómo abordamos cada proyecto de producción musical. Desde la primera escucha hasta el master final, cada decisión es una conversación entre el artista y el productor. El proceso creativo no es lineal — es un diálogo constante.", writeup_en: "Reflections on how we approach each music production project. From the first listen to the final master, every decision is a conversation between the artist and the producer. The creative process is not linear — it's a constant dialogue.", audio_url: null },
    { title: "Nuevo taller: Síntesis Modular", title_en: "New workshop: Modular Synthesis", category: "FORMACIÓN", type: "post", writeup: "Anunciamos un nuevo ciclo de talleres sobre síntesis modular. 8 encuentros semanales donde exploramos desde los fundamentos del voltaje hasta técnicas avanzadas de generación sonora. Arrancamos en marzo.", writeup_en: "Announcing a new cycle of modular synthesis workshops. 8 weekly sessions exploring from voltage fundamentals to advanced sound generation techniques. Starting in March.", audio_url: null },
    { title: "Sesión en vivo — Noche Polar", title_en: "Live session — Noche Polar", category: "DIRECCIÓN MUSICAL CREATIVA", type: "audio", writeup: "Registro de la sesión en vivo de Noche Polar en nuestro estudio. Captura multitrack sin edición posterior.", writeup_en: "Recording of Noche Polar's live session in our studio. Multitrack capture with no post-editing.", audio_url: "/uploads/audio/c54c91a1-cbef-44c3-a281-b1f3d0323310.mp3" },
    { title: "La importancia del espacio acústico", title_en: "The importance of acoustic space", category: "SONIDO", type: "post", writeup: "El espacio donde grabamos define el resultado tanto como los micrófonos que usamos. Un análisis de cómo diferentes salas afectan la captura de instrumentos acústicos y voces.", writeup_en: "The space where we record defines the result as much as the microphones we use. An analysis of how different rooms affect the capture of acoustic instruments and voices.", audio_url: null },
    { title: "Mix check: técnicas de referencia", title_en: "Mix check: reference techniques", category: "PRODUCCIÓN", type: "note", writeup: "Nota rápida sobre técnicas de referencia en mezcla. Siempre escuchá tu mezcla en al menos 3 sistemas diferentes antes de tomar decisiones finales.", writeup_en: "Quick note on reference techniques in mixing. Always listen to your mix on at least 3 different systems before making final decisions.", audio_url: null },
    { title: "Demo — Paisaje sonoro urbano", title_en: "Demo — Urban soundscape", category: "SONIDO", type: "audio", writeup: "Field recording procesado con granular synthesis. Captura original en microcentro porteño.", writeup_en: "Field recording processed with granular synthesis. Original capture in Buenos Aires downtown.", audio_url: "/uploads/audio/c54c91a1-cbef-44c3-a281-b1f3d0323310.mp3" },
    { title: "Próximos talleres 2025", title_en: "Upcoming workshops 2025", category: "FORMACIÓN", type: "post", writeup: "Ya están abiertas las inscripciones para el ciclo de talleres 2025. Este año sumamos producción con Ableton Live, diseño sonoro para videojuegos, y un intensivo de mezcla.", writeup_en: "Registration is now open for the 2025 workshop cycle. This year we're adding Ableton Live production, sound design for video games, and an intensive mixing course.", audio_url: null },
    { title: "Reflexión: menos es más", title_en: "Reflection: less is more", category: "DIRECCIÓN MUSICAL CREATIVA", type: "note", writeup: "A veces el mejor arreglo es el que deja espacio. La dirección musical no siempre consiste en agregar — muchas veces consiste en quitar.", writeup_en: "Sometimes the best arrangement is the one that leaves space. Music direction isn't always about adding — often it's about removing.", audio_url: null },
  ];

  for (const b of blogEntries) {
    await pool.query(
      `INSERT INTO blog (title, title_en, category, type, writeup, writeup_en, audio_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [b.title, b.title_en, b.category, b.type, b.writeup, b.writeup_en, b.audio_url]
    );
  }
  console.log(`  ✓ ${blogEntries.length} blog entries`);

  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
