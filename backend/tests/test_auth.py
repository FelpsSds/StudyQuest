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


def test_register_rejects_blank_name(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "   ",
            "email": "blankname@example.com",
            "password": "StrongPass123!",
        },
    )

    assert response.status_code == 422


def test_register_rejects_name_and_email_longer_than_database_columns(client):
    long_name_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "n" * 121,
            "email": "longname@example.com",
            "password": "StrongPass123!",
        },
    )
    long_email_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Alice",
            "email": f"{'a' * 244}@example.com",
            "password": "StrongPass123!",
        },
    )
    long_login_email_response = client.post(
        "/api/v1/auth/login",
        json={"email": f"{'a' * 244}@example.com", "password": "StrongPass123!"},
    )

    assert long_name_response.status_code == 422
    assert long_email_response.status_code == 422
    assert long_login_email_response.status_code == 422


def test_auth_rejects_passwords_over_bcrypt_byte_limit(client):
    exact_limit_password = "a" * 72
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Alice",
            "email": "bcrypt-limit@example.com",
            "password": exact_limit_password,
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "bcrypt-limit@example.com", "password": exact_limit_password},
    )
    assert login_response.status_code == 200

    long_ascii_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Bob",
            "email": "bcrypt-long-ascii@example.com",
            "password": "a" * 73,
        },
    )
    long_unicode_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Carol",
            "email": "bcrypt-long-unicode@example.com",
            "password": "é" * 37,
        },
    )
    truncated_password_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "bcrypt-limit@example.com",
            "password": exact_limit_password + "suffix",
        },
    )

    assert long_ascii_response.status_code == 422
    assert long_unicode_response.status_code == 422
    assert truncated_password_login.status_code == 422


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
