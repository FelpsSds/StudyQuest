def test_register_user(client):
    payload = {
        "name": "Alice",
        "email": "alice@example.com",
        "password": "StrongPass123!",
    }

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["user"]["email"] == payload["email"]
    assert data["user"]["name"] == payload["name"]
    assert "password" not in data["user"]


def test_login_user(client):
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Alice",
            "email": "alice@example.com",
            "password": "StrongPass123!",
        },
    )
    assert register_response.status_code == 201

    payload = {
        "email": "alice@example.com",
        "password": "StrongPass123!",
    }

    response = client.post("/api/v1/auth/login", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_get_current_user_requires_token(client):
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_email_whitespace_is_trimmed_for_register_and_login(client):
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Alice",
            "email": "  Alice@Example.com  ",
            "password": "StrongPass123!",
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "alice@example.com",
            "password": "StrongPass123!",
        },
    )

    assert login_response.status_code == 200
    assert login_response.json()["token_type"] == "bearer"
