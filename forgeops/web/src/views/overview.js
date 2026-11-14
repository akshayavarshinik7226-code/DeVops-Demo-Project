import { api, errorBanner, esc, monthName, moneyShort, money, num, pill, shortMonth } from "../lib.js";

export async function overview(el) {
  el.innerHTML = `
    <section class="register" aria-busy="true">
      <span class="skel" style="width:180px"></span>
      <span class="skel" style="width:320px;height:48px;margin-top:14px"></span>
      <span class="skel" style="height:18px;margin-top:26px"></span>
    </section>`;

  let stats, depts, runs;
  try {
    [stats, depts, runs] = await Promise.all([api("/api/stats"), api("/api/departments"), api("/api/payroll-runs?limit=6")]);
  } catch (err) {
    el.innerHTML = errorBanner(err);
    el.querySelector("[data-retry]").onclick = () => overview(el);
    return;
  }

  const last = stats.last_completed_run;
  const maxHead = Math.max(...depts.map((d) => d.headcount), 1);
  const inFlight = runs.find((r) => r.status === "queued" || r.status === "running");

  el.innerHTML = `
    ${last ? register(last, inFlight) : firstRun()}

    <p class="summary">
      <b>${num(stats.headcount)}</b> people across <b>${stats.departments}</b> departments,
      <b>${num(stats.active)}</b> on payroll this month, costing <b>${moneyShort(stats.monthly_cost)}</b> a month before tax.
    </p>

    <div class="grid-2">
      <section class="panel" aria-labelledby="h-dept">
        <div class="panel-head"><h2 id="h-dept">Headcount by department</h2><a href="#/people">See everyone</a></div>
        <div class="panel-body">
          <ul class="bars">
            ${depts
              .map(
                (d) => `<li>
                  <a href="#/people?department=${encodeURIComponent(d.department)}" title="${esc(d.department)}">${esc(d.department)}</a>
                  <span class="track"><span class="fill" style="width:${(d.headcount / maxHead) * 100}%"></span></span>
                  <span class="n">${d.headcount}</span>
                </li>`,
              )
              .join("")}
          </ul>
        </div>
      </section>

      <section class="panel" aria-labelledby="h-runs">
        <div class="panel-head"><h2 id="h-runs">Recent payroll runs</h2><a href="#/payroll">All runs</a></div>
        <div class="panel-body">
          ${
            runs.length
              ? `<ul class="runs">${runs
                  .map(
                    (r) => `<li>
                      <span class="period">${monthName(r.period)}</span>
                      ${pill(r.status)}
                      <span class="amt">${r.status === "completed" ? moneyShort(r.total_net) : "—"}</span>
                    </li>`,
                  )
                  .join("")}</ul>`
              : `<div class="empty"><p>No payroll runs yet.</p></div>`
          }
        </div>
      </section>
    </div>`;
}

function register(run, inFlight) {
  const taxPct = (run.total_tax / run.total_gross) * 100 || 0;
  const netPct = 100 - taxPct;
  return `
    <section class="register" aria-labelledby="h-reg">
      <div class="register-top">
        <div>
          <h2 id="h-reg">Paid out for ${monthName(run.period)}</h2>
          <div class="net">${money(run.total_net)}<small>net</small></div>
          <div class="meta">${num(run.employee_count)} people paid, run finished ${new Date(run.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</div>
        </div>
        ${
          inFlight
            ? `<a class="btn" href="#/payroll">${shortMonth(inFlight.period)} run is ${inFlight.status}</a>`
            : `<a class="btn primary" href="#/payroll">Run payroll</a>`
        }
      </div>
      <div class="strip" role="img" aria-label="Net pay is ${netPct.toFixed(0)} percent of gross, tax is ${taxPct.toFixed(0)} percent">
        <span class="s-net" style="width:${netPct}%"></span>
        <span class="s-tax" style="width:${taxPct}%"></span>
      </div>
      <dl class="legend">
        <div><dt><i style="background:var(--ink-3)"></i>Gross</dt><dd>${money(run.total_gross)}</dd></div>
        <div><dt><i style="background:var(--green)"></i>Net to employees</dt><dd>${money(run.total_net)}</dd></div>
        <div><dt><i style="background:var(--tax)"></i>Tax withheld</dt><dd>${money(run.total_tax)}</dd></div>
      </dl>
    </section>`;
}

function firstRun() {
  return `
    <section class="register">
      <div class="empty">
        <h3>No payroll has been run yet</h3>
        <p>Run your first payroll and the totals will appear here.</p>
        <a class="btn primary" href="#/payroll">Run payroll</a>
      </div>
    </section>`;
}
