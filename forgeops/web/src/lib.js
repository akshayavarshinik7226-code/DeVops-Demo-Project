// Small helpers shared by every view.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      headers: { "content-type": "application/json" },
      ...options,
    });
  } catch {
    throw new ApiError("Can't reach the API. Check that the api container is running.", 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.detail;
    const msg = Array.isArray(detail) ? detail.map((d) => d.msg).join(", ") : detail;
    throw new ApiError(msg || `The API answered ${res.status}.`, res.status);
  }
  return body;
}

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const money = (n) => inr.format(n ?? 0);

/** ₹3.26 Cr / ₹4.2 L style, the way Indian payroll teams read big totals. */
export function moneyShort(n) {
  const v = Number(n || 0);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return money(v);
}

export const num = (n) => new Intl.NumberFormat("en-IN").format(n ?? 0);

export function monthName(period, style = "long") {
  if (!period) return "";
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: style, year: "numeric" });
}

export function shortMonth(period) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short" });
}

export function dateText(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return dateText(iso);
}

const statusText = {
  completed: "Completed",
  queued: "Queued",
  running: "Running",
  failed: "Failed",
  active: "Active",
  on_leave: "On leave",
  ok: "Healthy",
  down: "Down",
  unknown: "Unknown",
};
export const pill = (status) => `<span class="pill ${esc(status)}">${statusText[status] ?? esc(status)}</span>`;

const palette = ["#0B6B52", "#3F4BB0", "#8A5A00", "#7A3E9D", "#B42318", "#1F6F8B", "#5B6B1E", "#9C4A1A"];
export function avatar(name, size = "") {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `<span class="avatar ${size}" style="background:${palette[h % palette.length]}" aria-hidden="true">${esc(initials)}</span>`;
}

export function toast(message, kind = "") {
  const box = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  box.append(el);
  setTimeout(() => el.remove(), 4200);
}

export function errorBanner(err, retryLabel = "Try again") {
  return `<div class="banner" role="alert">
    <p><strong>Couldn't load this page.</strong>${esc(err.message)}</p>
    <button class="btn small" data-retry type="button">${retryLabel}</button>
  </div>`;
}

export function skeletonRows(cols, rows = 8) {
  const cell = `<td><span class="skel"></span></td>`;
  return Array.from({ length: rows }, () => `<tr>${cell.repeat(cols)}</tr>`).join("");
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
