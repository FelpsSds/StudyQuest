def _register_user(client, email: str = "profile@example.com") -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Study User", "email": email, "password": "StrongPass123!"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def test_user_can_update_own_display_name(client):
    token = _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.put("/api/v1/users/me", json={"name": "  Nova Estudante  "}, headers=headers)

    assert response.status_code == 200
    assert response.json()["name"] == "Nova Estudante"
    assert response.json()["email"] == "profile@example.com"
    assert client.get("/api/v1/users/dashboard", headers=headers).json()["user"]["name"] == "Nova Estudante"


def test_update_user_name_rejects_blank_and_too_long_values(client):
    token = _register_user(client, email="invalid-profile@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    blank_response = client.put("/api/v1/users/me", json={"name": "   "}, headers=headers)
    long_response = client.put("/api/v1/users/me", json={"name": "n" * 121}, headers=headers)

    assert blank_response.status_code == 422
    assert long_response.status_code == 422


def test_update_user_name_requires_authentication(client):
    response = client.put("/api/v1/users/me", json={"name": "Study User"})

    assert response.status_code == 401
