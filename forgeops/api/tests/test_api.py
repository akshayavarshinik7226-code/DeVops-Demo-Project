def test_health_ok_when_db_and_redis_up(client, fake_redis):
    fake_redis.up = True
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["checks"] == {"database": "ok", "redis": "ok"}


def test_health_503_when_redis_down(client, fake_redis):
    fake_redis.up = False
    try:
        r = client.get("/health")
        assert r.status_code == 503
        assert r.json()["checks"]["redis"] == "down"
    finally:
        fake_redis.up = True


def test_employees_seeded_with_441(client):
    r = client.get("/api/employees?limit=10")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 441
    assert len(body["items"]) == 10


def test_employee_limit_over_200_returns_400(client):
    assert client.get("/api/employees?limit=500").status_code == 400


def test_search_and_department_filter(client):
    r = client.get("/api/employees", params={"department": "Design", "limit": 200})
    body = r.json()
    assert body["total"] == 16
    assert all(e["department"] == "Design" for e in body["items"])
    one = body["items"][0]
    found = client.get("/api/employees", params={"q": one["emp_code"]}).json()
    assert found["total"] == 1


def test_employee_detail_and_404(client):
    assert client.get("/api/employees/1").json()["id"] == 1
    assert client.get("/api/employees/999999").status_code == 404


def test_create_payroll_run_queues_job(client, fake_redis):
    r = client.post("/api/payroll-runs", json={"period": "2026-11"})
    assert r.status_code == 202
    assert r.json()["status"] == "queued"
    assert fake_redis.llen("payroll:queue") >= 1
    # a second run for the same period while one is queued is refused
    assert client.post("/api/payroll-runs", json={"period": "2026-11"}).status_code == 409


def test_payroll_period_validation(client):
    assert client.post("/api/payroll-runs", json={"period": "2026-13"}).status_code == 422
    assert client.post("/api/payroll-runs", json={"period": "Nov"}).status_code == 422


def test_stats_and_departments(client):
    s = client.get("/api/stats").json()
    assert s["headcount"] == 441 and s["departments"] == 8
    depts = client.get("/api/departments").json()
    assert sum(d["headcount"] for d in depts) == 441


def test_metrics_exposed(client):
    client.get("/api/version")
    text = client.get("/metrics").text
    assert "api_requests_total" in text
    assert "api_request_seconds" in text
