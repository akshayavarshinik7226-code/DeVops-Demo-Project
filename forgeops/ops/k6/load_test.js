// k6 load test. Point it at STAGING only, never at a server you do not own.
//   k6 run -e BASE_URL=https://staging.YOUR-IP.sslip.io ops/k6/load_test.js
//   k6 run -e BASE_URL=... -e PEAK=80 ops/k6/load_test.js   (stress)
import http from "k6/http";
import { check, sleep, group } from "k6";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:8081";
const PEAK = Number(__ENV.PEAK || 50);

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: PEAK },
    { duration: "2m", target: PEAK },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],          // under 1% errors
    http_req_duration: ["p(95)<500"],        // p95 under 500 ms
    "http_req_duration{name:employees_search}": ["p(95)<800"],
  },
};

const terms = ["iyer", "engineer", "nair", "chennai", "lead", "FO01"];
const depts = ["Engineering", "Sales", "Finance", "Design", "Operations"];

export default function () {
  group("browse", () => {
    const r1 = http.get(`${BASE}/api/stats`, { tags: { name: "stats" } });
    check(r1, { "stats 200": (r) => r.status === 200 });

    const r2 = http.get(`${BASE}/api/employees?limit=25&offset=${Math.floor(Math.random() * 400)}`, { tags: { name: "employees_page" } });
    check(r2, { "page 200": (r) => r.status === 200 });

    const q = terms[Math.floor(Math.random() * terms.length)];
    const r3 = http.get(`${BASE}/api/employees?limit=25&q=${q}`, { tags: { name: "employees_search" } });
    check(r3, { "search 200": (r) => r.status === 200 });

    const d = depts[Math.floor(Math.random() * depts.length)];
    const r4 = http.get(`${BASE}/api/employees?limit=50&department=${d}&sort=-monthly_salary`, { tags: { name: "employees_dept" } });
    check(r4, { "dept 200": (r) => r.status === 200 });

    http.get(`${BASE}/api/payroll-runs?limit=6`, { tags: { name: "runs" } });
  });
  sleep(1);
}
