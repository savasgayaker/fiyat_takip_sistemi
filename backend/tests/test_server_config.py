"""Server wiring: localhost-only CORS, no wildcard."""
from fastapi.testclient import TestClient

import server

client = TestClient(server.app)


def test_cors_allows_local_frontend_and_tauri():
    for origin in ("http://localhost:3000", "tauri://localhost"):
        r = client.options("/api/meta", headers={
            "Origin": origin, "Access-Control-Request-Method": "GET"})
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") == origin


def test_cors_rejects_foreign_origin():
    r = client.options("/api/meta", headers={
        "Origin": "http://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers


def test_bind_is_loopback():
    assert server.HOST == "127.0.0.1"
    assert "*" not in server.CORS_ORIGINS
