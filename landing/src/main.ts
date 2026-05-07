const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/";

document.querySelectorAll<HTMLAnchorElement>("[data-store-link]").forEach((link) => {
  link.href = CHROME_WEB_STORE_URL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
});

const simulatorStates = {
  "tutorial-playing": {
    tutorial: "Playing",
    music: "Paused",
    result: "FlowTube pauses music while your tutorial is active."
  },
  "tutorial-paused": {
    tutorial: "Paused",
    music: "Playing",
    result: "FlowTube starts your focus music after the configured delay."
  },
  "work-tab": {
    tutorial: "Left for work",
    music: "Playing",
    result: "FlowTube treats the work tab as a focus moment and starts music."
  },
  "back-to-tutorial": {
    tutorial: "Returned",
    music: "Paused",
    result: "FlowTube pauses music when you return to the tutorial tab."
  }
};

const simulatorButtons = document.querySelectorAll<HTMLButtonElement>("[data-scenario]");
const simulatorTutorial = document.querySelector<HTMLElement>("[data-sim-tutorial]");
const simulatorMusic = document.querySelector<HTMLElement>("[data-sim-music]");
const simulatorResult = document.querySelector<HTMLElement>("[data-sim-result]");

simulatorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const scenario = button.dataset.scenario;
    if (!scenario || !(scenario in simulatorStates) || !simulatorTutorial || !simulatorMusic || !simulatorResult) return;

    const state = simulatorStates[scenario as keyof typeof simulatorStates];
    simulatorButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    simulatorTutorial.textContent = state.tutorial;
    simulatorMusic.textContent = state.music;
    simulatorResult.textContent = state.result;
  });
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
