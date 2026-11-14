#!/usr/bin/env bash
# Quick checks that a release really works.  usage: ops/scripts/smoke.sh https://your-site
set -uo pipefail
BASE="${1:-http://127.0.0.1:8080}"
fail=0
body="$(mktemp)"
trap 'rm -f "$body"' EXIT

check() {
  local name="$1" path="$2" expect="$3" code
  code=$(curl -s -o "$body" -w '%{http_code}' --max-time 10 "$BASE$path")
  if [[ "$code" == "$expect" ]]; then echo "ok    $name ($code)"; else echo "FAIL  $name: got $code, expected $expect"; fail=1; fi
}

check "web page loads"         "/"                              200
check "health"                 "/health"                        200
check "employees API"          "/api/employees?limit=1"         200
total=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["total"])' "$body" 2>/dev/null || echo "?")
if [[ "$total" =~ ^[0-9]+$ && "$total" -ge 441 ]]; then echo "ok    $total employees"; else echo "FAIL  expected at least 441 employees, got $total"; fail=1; fi
check "limit guard returns 400" "/api/employees?limit=500"      400
check "payroll runs API"       "/api/payroll-runs?limit=1"      200
curl -s --max-time 10 -o "$body" "$BASE/metrics"
if grep -q api_requests_total "$body"; then echo "FAIL  /metrics is public"; fail=1; else echo "ok    /metrics is not public"; fi

[[ $fail -eq 0 ]] && echo "smoke test passed" || echo "smoke test FAILED"
exit $fail
