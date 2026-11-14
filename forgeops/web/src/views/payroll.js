import { api, currentPeriod, errorBanner, esc, money, monthName, moneyShort, num, pill, shortMonth, skeletonRows, timeAgo, toast } from "../lib.js";

export async function payroll(el) {
  el.innerHTML = `
    <section class="panel">
      <form class="run-form" id="run-form" novalidate>
        <p>Pick a month and start the run. The worker totals salaries for everyone on active status, withholds 12% tax, and records the result. It usually takes a few seconds.</p>
        <label class="field">Pay month
          <input class="input" type="month" id="period" value="${currentPeriod()}" required />
        </label>
        <button class="btn primary" type="submit" id="start">Start payroll run</button>
      </form>
    </section>

    <div class="grid-2">
      <section class="panel" aria-labelledby="h-hist">
        <div class="panel-head"><h2 id="h-hist">Run history</h2><span class="muted" id="live"></span></div>
        <div id="err"></div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th scope="col">Month</th><th scope="col">Status</th>
              <th scope="col" class="num hide-sm">People</th><th scope="col" class="num">Net paid</th>
            </tr></thead>
            <tbody id="rows">${skeletonRows(4, 6)}</tbody>
          </table>
        </div>
      </section>
      <section class="panel" aria-labelledby="h-trend">
        <div class="panel-head"><h2 id="h-trend">Net pay by month</h2></div>
        <div class="panel-body" id="trend"></div>
      </section>
    </div>`;

  const rows = el.querySelector("#rows");
  const errBox = el.querySelector("#err");
  const live = el.querySelector("#live");
  const form = el.querySelector("#run-form");
  const startBtn = el.querySelector("#start");
  let timer = null;
  let known = new Map();

  async function load() {
    let runs;
    try {
      runs = await api("/api/payroll-runs?limit=24");
      errBox.innerHTML = "";
    } catch (err) {
      errBox.innerHTML = `<div style="padding:0 20px">${errorBanner(err)}</div>`;
      errBox.querySelector("[data-retry]").onclick = load;
      rows.innerHTML = "";
      return;
    }

    // tell the person when a run they are watching finishes
    for (const r of runs) {
      const before = known.get(r.id);
      if (before && before !== r.status) {
        if (r.status === "completed") toast(`${monthName(r.period)} payroll completed: ${moneyShort(r.total_net)} net.`);
        if (r.status === "failed") toast(`${monthName(r.period)} payroll failed: ${r.error || "see worker logs"}.`, "err");
      }
    }
    known = new Map(runs.map((r) => [r.id, r.status]));

    rows.innerHTML = runs.length
      ? runs
          .map(
            (r) => `<tr>
              <td><b>${monthName(r.period)}</b><br><small class="muted">${r.status === "completed" ? `Finished ${timeAgo(r.completed_at)}` : `Started ${timeAgo(r.created_at)}`}</small></td>
              <td>${pill(r.status)}${r.error ? `<br><small class="muted">${esc(r.error)}</small>` : ""}</td>
              <td class="num hide-sm">${r.status === "completed" ? num(r.employee_count) : "—"}</td>
              <td class="num">${r.status === "completed" ? money(r.total_net) : "—"}</td>
            </tr>`,
          )
          .join("")
      : `<tr><td colspan="4"><div class="empty"><h3>No payroll runs yet</h3><p>Start your first run above.</p></div></td></tr>`;

    const done = runs.filter((r) => r.status === "completed").slice(0, 8).reverse();
    const max = Math.max(...done.map((r) => r.total_net), 1);
    el.querySelector("#trend").innerHTML = done.length
      ? `<div class="trend" role="img" aria-label="Net pay for the last ${done.length} completed months">
          ${done.map((r) => `<div title="${monthName(r.period)}: ${money(r.total_net)}"><span class="b" style="height:${Math.max(6, (r.total_net / max) * 100)}%"></span>${shortMonth(r.period)}</div>`).join("")}
        </div>
        <p class="muted" style="margin:12px 0 0;font-size:13.5px">Latest: ${money(done.at(-1).total_net)} for ${monthName(done.at(-1).period)}</p>`
      : `<div class="empty"><p>The chart appears after the first completed run.</p></div>`;

    const busy = runs.some((r) => r.status === "queued" || r.status === "running");
    live.textContent = busy ? "Updating live" : "";
    clearTimeout(timer);
    timer = setTimeout(load, busy ? 1500 : 10000);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const period = el.querySelector("#period").value;
    if (!period) {
      toast("Choose a pay month first.", "err");
      return;
    }
    startBtn.disabled = true;
    startBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span> Starting`;
    try {
      const run = await api("/api/payroll-runs", { method: "POST", body: JSON.stringify({ period }) });
      known.set(run.id, run.status);
      toast(`${monthName(period)} payroll run started.`);
      await load();
    } catch (err) {
      toast(err.message, "err");
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = "Start payroll run";
    }
  });

  load();
  return () => clearTimeout(timer);
}
