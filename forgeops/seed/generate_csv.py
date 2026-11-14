"""Regenerates the fictional seed CSVs. Deterministic (fixed random seed).

You never need to run this; employees.csv and payroll_runs.csv are already committed.
"""

import csv
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(2026)
HERE = Path(__file__).parent
TOTAL = 441

FIRST = (
    "Aarav Aditi Akash Ananya Arjun Bhavya Chetan Deepa Divya Farhan Gautam Harini Ishaan Janani Karthik "
    "Kavya Lakshmi Manoj Meera Naveen Nisha Pooja Pranav Priya Rahul Riya Rohan Saanvi Sanjay Shreya "
    "Siddharth Sneha Suresh Tanvi Varun Vidya Vikram Yamini Zoya Aisha Neha Kiran Ravi Asha Dev"
).split()
LAST = (
    "Iyer Nair Reddy Sharma Patel Menon Rao Kumar Pillai Das Gupta Joshi Krishnan Bose Shetty Verma "
    "Chandran Naidu Mehta Kapoor Banerjee Mishra Sinha Varghese Raman Subramanian"
).split()
DEPTS = {
    "Engineering": (
        ["Software Engineer", "Senior Engineer", "Tech Lead", "QA Engineer", "DevOps Engineer"],
        55000,
        180000,
        140,
    ),
    "Operations": (["Operations Associate", "Operations Manager", "Analyst"], 30000, 110000, 70),
    "Sales": (["Sales Executive", "Account Manager", "Sales Lead"], 32000, 130000, 65),
    "Customer Success": (["Support Specialist", "CS Manager"], 28000, 95000, 55),
    "Finance": (["Accountant", "Payroll Specialist", "Finance Manager"], 40000, 150000, 35),
    "People": (["HR Executive", "Recruiter", "HR Manager"], 35000, 120000, 30),
    "Marketing": (["Content Writer", "Marketing Executive", "Growth Lead"], 32000, 125000, 30),
    "Design": (["Product Designer", "UX Researcher"], 45000, 140000, 16),
}
LOCATIONS = ["Chennai", "Bengaluru", "Hyderabad", "Pune", "Coimbatore", "Remote"]

rows, n = [], 0
for dept, (titles, lo, hi, count) in DEPTS.items():
    for _ in range(count):
        n += 1
        first, last = random.choice(FIRST), random.choice(LAST)
        rows.append(
            {
                "emp_code": f"FO{n:04d}",
                "full_name": f"{first} {last}",
                "email": f"{first.lower()}.{last.lower()}{n}@example.test",
                "department": dept,
                "title": random.choice(titles),
                "location": random.choice(LOCATIONS),
                "monthly_salary": round(random.uniform(lo, hi) / 500) * 500,
                "status": "on_leave" if random.random() < 0.04 else "active",
                "joined_on": (date(2019, 1, 1) + timedelta(days=random.randint(0, 2700))).isoformat(),
            }
        )
assert len(rows) == TOTAL, len(rows)

with open(HERE / "employees.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)

gross = sum(r["monthly_salary"] for r in rows if r["status"] == "active")
active = sum(1 for r in rows if r["status"] == "active")
with open(HERE / "payroll_runs.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["period", "status", "employee_count", "total_gross", "total_tax", "total_net"])
    for m in range(5, 11):
        g = round(gross * random.uniform(0.97, 1.0), 2)
        t = round(g * 0.12, 2)
        w.writerow([f"2026-{m:02d}", "completed", active - random.randint(0, 6), g, t, round(g - t, 2)])
print(f"wrote {len(rows)} employees")
