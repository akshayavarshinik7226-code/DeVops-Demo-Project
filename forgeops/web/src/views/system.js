import { api, errorBanner, esc, pill } from "../lib.js";

const SERVICES = [
  { key: "api", name: "API", ok: "Answering requests.", down: "Not answering. Check the api container logs." },
  { key: "database", name: "Database", ok: "PostgreSQL is accepting queries.", down: "PostgreSQL is not reachable from the API." },
  { key: "redis", name: "Job queue", ok: "Redis is up.", down: "Redis is not reachable. Payroll runs can't start." },
  { key: "worker", name: "Payroll worker", ok: "Picking up jobs.", down: "No heartbeat in the last 30 seconds. Queued runs will wait." },
];

export async function system(el) {
  let timer;

  async function load() {
    let s;
    try {
      s = await api("/api/system");
      s.api = "ok";
    } catch (err) {
      s = { api: "down", database: "unknown", redis: "unknown", worker: "unknown", error: err };
    }

    el.innerHTML = `
      ${s.error ? errorBanner(s.error, "Check again") : ""}
      <div class="services">
        ${SERVICES.map(
          (v) => `<section class="panel svc">
            <h3>${v.name} ${pill(s[v.key])}</h3>
            <p>${s[v.key] === "ok" ? v.ok : s[v.key] === "down" ? v.down : "Can't tell while the API is down."}</p>
          </section>`,
        ).join("")}
      </div>

      <div class="grid-2">
        <section class="panel" aria-labelledby="h-build">
          <div class="panel-head"><h2 id="h-build">What is running</h2></div>
          <div class="panel-body">
            <dl class="kv">
              <dt>Environment</dt><dd>${esc(s.env ?? "—")}</dd>
              <dt>Version</dt><dd>${esc(s.version ?? "—")}</dd>
              <dt>Git commit</dt><dd><code>${esc(s.commit ?? "—")}</code></dd>
              <dt>Jobs waiting</dt><dd>${s.queue_depth ?? "—"}</dd>
              <dt>Checked</dt><dd>${new Date().toLocaleTimeString("en-IN")}, refreshes every 10 seconds</dd>
            </dl>
          </div>
        </section>
        <section class="panel" aria-labelledby="h-links">
          <div class="panel-head"><h2 id="h-links">Endpoints for monitoring</h2></div>
          <div class="panel-body">
            <dl class="kv">
              <dt><a href="/health" target="_blank" rel="noopener">/health</a></dt><dd>200 when the database and Redis are reachable, 503 otherwise. Used by Docker health checks and uptime monitors.</dd>
              <dt><code>/metrics</code></dt><dd>Prometheus metrics (api_requests_total, api_request_seconds). Kept private: scraped inside the Docker network only.</dd>
              <dt><code>/api/system</code></dt><dd>The data behind this page.</dd>
            </dl>
          </div>
        </section>
      </div>`;
    el.querySelector("[data-retry]")?.addEventListener("click", load);
    clearTimeout(timer);
    timer = setTimeout(load, 10000);
  }

  await load();
  return () => clearTimeout(timer);
}
