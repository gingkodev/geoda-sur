const SVG = `<svg id="custom-cursor" width="24" height="24" viewBox="0 0 24 24">
  <polygon points="0,0 0,17 4,10 12,12" fill="#ffffff" />
</svg>`;

export function initCursor() {
  if (window.innerWidth < 768) return;

  document.body.insertAdjacentHTML("beforeend", SVG);
  const el = document.getElementById("custom-cursor")!;

  document.addEventListener("mousemove", (e) => {
    el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  });
}
