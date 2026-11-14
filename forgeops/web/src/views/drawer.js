import { api, avatar, dateText, esc, money, pill } from "../lib.js";

const drawer = () => document.getElementById("drawer");
const back = () => document.getElementById("drawer-back");
let returnFocus = null;

export function closeDrawer() {
  const d = drawer();
  if (!d.classList.contains("open")) return;
  d.classList.remove("open");
  d.setAttribute("aria-hidden", "true");
  back().hidden = true;
  returnFocus?.focus();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});
document.addEventListener("click", (e) => {
  if (e.target.id === "drawer-back" || e.target.closest("[data-close]")) closeDrawer();
});

export async function openEmployee(id) {
  returnFocus = document.activeElement;
  const d = drawer();
  d.innerHTML = `<span class="skel" style="width:60%;height:24px"></span><span class="skel" style="margin-top:14px"></span>`;
  d.classList.add("open");
  d.setAttribute("aria-hidden", "false");
  back().hidden = false;

  try {
    const e = await api(`/api/employees/${id}`);
    const years = ((Date.now() - new Date(e.joined_on)) / (365.25 * 864e5)).toFixed(1);
    d.innerHTML = `
      <div class="drawer-head">
        ${avatar(e.full_name)}
        <div>
          <h2 id="drawer-title">${esc(e.full_name)}</h2>
          <p>${esc(e.title)}, ${esc(e.department)}</p>
        </div>
        <button class="close" type="button" data-close aria-label="Close">×</button>
      </div>
      <div class="salary"><span>Monthly salary, before tax</span><strong>${money(e.monthly_salary)}</strong></div>
      <dl class="kv">
        <dt>Status</dt><dd>${pill(e.status)}</dd>
        <dt>Employee ID</dt><dd>${esc(e.emp_code)}</dd>
        <dt>Email</dt><dd><a href="mailto:${esc(e.email)}">${esc(e.email)}</a></dd>
        <dt>Location</dt><dd>${esc(e.location)}</dd>
        <dt>Joined</dt><dd>${dateText(e.joined_on)} (${years} years)</dd>
        <dt>Yearly cost</dt><dd>${money(e.monthly_salary * 12)}</dd>
      </dl>`;
  } catch (err) {
    d.innerHTML = `<div class="drawer-head"><h2 id="drawer-title">Couldn't open this person</h2>
      <button class="close" type="button" data-close aria-label="Close">×</button></div><p>${esc(err.message)}</p>`;
  }
  d.querySelector(".close")?.focus();
}
