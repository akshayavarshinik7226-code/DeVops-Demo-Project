import "./styles.css";
import { api } from "./lib.js";
import { overview } from "./views/overview.js";
import { people } from "./views/people.js";
import { payroll } from "./views/payroll.js";
import { system } from "./views/system.js";
import { closeDrawer } from "./views/drawer.js";

const routes = {
  "": { title: "Overview", view: overview, key: "overview" },
  people: { title: "People", view: people, key: "people" },
  payroll: { title: "Payroll", view: payroll, key: "payroll" },
  system: { title: "System", view: system, key: "system" },
};

const main = document.getElementById("main");
let cleanup = null;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  return { path, params: new URLSearchParams(query) };
}

async function render() {
  const { path, params } = parseHash();
  const route = routes[path] ?? routes[""];
  if (typeof cleanup === "function") cleanup();
  cleanup = null;
  closeDrawer();

  document.getElementById("page-title").textContent = route.title;
  document.title = route.key === "overview" ? "ForgeOps" : `${route.title} · ForgeOps`;
  document.querySelectorAll(".rail nav a").forEach((a) => {
    if (a.dataset.route === route.key) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });

  main.innerHTML = "";
  const view = document.createElement("div");
  view.className = "view";
  main.append(view);
  cleanup = await route.view(view, params);
}

// ---------- theme ----------
const root = document.documentElement;
function applyTheme(theme) {
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#11171b" : "#0B6B52";
}
let stored = null;
try {
  stored = localStorage.getItem("forgeops-theme");
} catch {
  /* storage blocked: follow the system setting */
}
applyTheme(stored || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
document.getElementById("theme").addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem("forgeops-theme", next);
  } catch {
    /* ignore */
  }
});

// ---------- build stamp + health dot ----------
async function refreshStatus() {
  const dot = document.getElementById("nav-health");
  try {
    const s = await api("/api/system");
    const env = document.getElementById("env");
    env.textContent = s.env;
    env.dataset.env = s.env;
    document.getElementById("ver").textContent = `v${s.version} (${String(s.commit).slice(0, 7)})`;
    const healthy = s.database === "ok" && s.redis === "ok" && s.worker === "ok";
    dot.className = `dot ${healthy ? "ok" : "bad"}`;
    dot.title = healthy ? "All services healthy" : "A service needs attention";
  } catch {
    dot.className = "dot bad";
    dot.title = "API unreachable";
  }
}
refreshStatus();
setInterval(refreshStatus, 15000);

window.addEventListener("hashchange", render);
render();
