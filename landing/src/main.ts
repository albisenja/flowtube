const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/";

document.querySelectorAll<HTMLAnchorElement>("[data-store-link]").forEach((link) => {
  link.href = CHROME_WEB_STORE_URL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
});

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.16 }
);

document.querySelectorAll<HTMLElement>(".reveal").forEach((element, index) => {
  element.style.setProperty("--reveal-delay", `${Math.min(index * 45, 260)}ms`);
  observer.observe(element);
});

document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");
    if (!targetId || targetId === "#") return;

    const target = document.querySelector<HTMLElement>(targetId);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const text = button.dataset.copy;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      const previous = button.textContent;
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = previous;
      }, 1400);
    } catch {
      button.textContent = "Select text";
    }
  });
});
