import { api, avatar, debounce, errorBanner, esc, money, num, pill, skeletonRows } from "../lib.js";
import { openEmployee } from "./drawer.js";

const PAGE = 25;
const COLS = 6;

export async function people(el, params) {
  const state = {
    q: params.get("q") || "",
    department: params.get("department") || "",
    sort: params.get("sort") || "full_name",
    page: Number(params.get("page") || 1),
  };

  let depts = [];
  try {
    depts = await api("/api/departments");
  } catch {
    /* the table request below shows the error */
  }

  el.innerHTML = `
    <div class="toolbar">
      <label class="field grow">Search
        <span class="search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input class="input" id="q" type="search" placeholder="Name, email, ID or job title" value="${esc(state.q)}" autocomplete="off" />
        </span>
      </label>
      <label class="field">Department
        <select class="select" id="dept">
          <option value="">All departments</option>
          ${depts.map((d) => `<option ${d.department === state.department ? "selected" : ""}>${esc(d.department)}</option>`).join("")}
        </select>
      </label>
    </div>
    <div id="err"></div>
    <section class="panel">
      <div class="table-wrap">
        <table>
          <caption class="skip">Employees</caption>
          <thead><tr>
            <th scope="col">${sortBtn("full_name", "Name", state.sort)}</th>
            <th scope="col" class="hide-sm">${sortBtn("department", "Department", state.sort)}</th>
            <th scope="col" class="hide-sm">Location</th>
            <th scope="col" class="hide-sm">${sortBtn("joined_on", "Joined", state.sort)}</th>
            <th scope="col" class="hide-sm">Status</th>
            <th scope="col" class="num">${sortBtn("-monthly_salary", "Monthly salary", state.sort)}</th>
          </tr></thead>
          <tbody id="rows">${skeletonRows(COLS)}</tbody>
        </table>
      </div>
      <div class="pager" id="pager"></div>
    </section>`;

  const rows = el.querySelector("#rows");
  const pager = el.querySelector("#pager");
  const errBox = el.querySelector("#err");
  let seq = 0;

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.department) p.set("department", state.department);
    if (state.sort !== "full_name") p.set("sort", state.sort);
    if (state.page > 1) p.set("page", state.page);
    const qs = p.toString();
    history.replaceState(null, "", `#/people${qs ? `?${qs}` : ""}`);
  }

  async function load() {
    const mine = ++seq;
    syncUrl();
    rows.innerHTML = skeletonRows(COLS);
    const p = new URLSearchParams({ limit: PAGE, offset: (state.page - 1) * PAGE, sort: state.sort });
    if (state.q) p.set("q", state.q);
    if (state.department) p.set("department", state.department);
    try {
      const data = await api(`/api/employees?${p}`);
      if (mine !== seq) return; // a newer search already started
      errBox.innerHTML = "";
      renderRows(data);
    } catch (err) {
      if (mine !== seq) return;
      rows.innerHTML = "";
      pager.innerHTML = "";
      errBox.innerHTML = errorBanner(err);
      errBox.querySelector("[data-retry]").onclick = load;
    }
  }

  function renderRows(data) {
    if (!data.items.length) {
      rows.innerHTML = `<tr><td colspan="${COLS}"><div class="empty">
        <h3>Nobody matches “${esc(state.q || state.department)}”</h3>
        <p>Check the spelling, or clear the filters to see everyone.</p>
        <button class="btn small" type="button" id="clear">Clear filters</button></div></td></tr>`;
      pager.innerHTML = "";
      rows.querySelector("#clear").onclick = () => {
        state.q = "";
        state.department = "";
        state.page = 1;
        el.querySelector("#q").value = "";
        el.querySelector("#dept").value = "";
        load();
      };
      return;
    }
    rows.innerHTML = data.items
      .map(
        (e) => `<tr class="clickable" data-id="${e.id}" tabindex="0" aria-label="Open ${esc(e.full_name)}">
          <td><div class="person">${avatar(e.full_name)}<div><b>${esc(e.full_name)}</b><small>${esc(e.title)}</small></div></div></td>
          <td class="hide-sm">${esc(e.department)}</td>
          <td class="hide-sm">${esc(e.location)}</td>
          <td class="hide-sm">${new Date(e.joined_on).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</td>
          <td class="hide-sm">${pill(e.status)}</td>
          <td class="num">${money(e.monthly_salary)}</td>
        </tr>`,
      )
      .join("");

    const from = data.offset + 1;
    const to = data.offset + data.items.length;
    const pages = Math.ceil(data.total / PAGE);
    pager.innerHTML = `
      <span>Showing ${from}–${to} of ${num(data.total)}</span>
      <span class="btns">
        <button class="btn small" type="button" data-page="-1" ${state.page <= 1 ? "disabled" : ""}>Previous</button>
        <button class="btn small" type="button" data-page="1" ${state.page >= pages ? "disabled" : ""}>Next</button>
      </span>`;
  }

  el.querySelector("#q").addEventListener(
    "input",
    debounce((e) => {
      state.q = e.target.value.trim();
      state.page = 1;
      load();
    }),
  );
  el.querySelector("#dept").addEventListener("change", (e) => {
    state.department = e.target.value;
    state.page = 1;
    load();
  });
  el.querySelector("thead").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sort]");
    if (!b) return;
    state.sort = b.dataset.sort;
    state.page = 1;
    el.querySelectorAll("[data-sort]").forEach((x) => {
      x.toggleAttribute("aria-sort", x === b);
      if (x === b) x.setAttribute("aria-sort", "ascending");
      x.textContent = x.dataset.label + (x === b ? " ▾" : "");
    });
    load();
  });
  pager.addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]");
    if (!b) return;
    state.page += Number(b.dataset.page);
    load();
    el.querySelector(".panel").scrollIntoView({ block: "start", behavior: "smooth" });
  });
  rows.addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) openEmployee(tr.dataset.id);
  });
  rows.addEventListener("keydown", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openEmployee(tr.dataset.id);
    }
  });

  load();
}

function sortBtn(key, label, current) {
  return `<button type="button" data-sort="${key}" data-label="${label}" ${key === current ? 'aria-sort="ascending"' : ""}>${label}${key === current ? " ▾" : ""}</button>`;
}
