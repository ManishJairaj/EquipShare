from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import User


def main() -> None:
    unique_id = uuid4().hex
    username = f"discover_{unique_id[:20]}"
    email = f"discovery-{unique_id}@example.com"
    category = f"Discovery_{unique_id[:12]}"
    password = "DiscoveryIntegrationTest!42"
    client = TestClient(app)

    listings = [
        {
            "name": f"DSLR Camera {unique_id[:8]}",
            "description": "Professional student photography equipment",
            "condition": "good",
            "listing_mode": "rent",
            "price": "500.00",
            "availability_status": "available",
        },
        {
            "name": f"Sony Kit {unique_id[:8]}",
            "description": "Sony camera kit with battery",
            "condition": "excellent",
            "listing_mode": "rent",
            "price": "900.00",
            "availability_status": "available",
        },
        {
            "name": f"Tripod {unique_id[:8]}",
            "description": "Stable camera tripod",
            "condition": "good",
            "listing_mode": "sell",
            "price": "1200.00",
            "availability_status": "unavailable",
        },
        {
            "name": f"Scientific Calculator {unique_id[:8]}",
            "description": "Calculator for engineering classes",
            "condition": "good",
            "listing_mode": "sell",
            "price": "800.00",
            "availability_status": "available",
        },
        {
            "name": f"Lab Microscope {unique_id[:8]}",
            "description": "Microscope for biology practicals",
            "condition": "fair",
            "listing_mode": "rent",
            "price": "2000.00",
            "availability_status": "available",
        },
    ]

    try:
        registration = client.post(
            "/auth/register",
            json={
                "name": "Discovery Test Owner",
                "username": username,
                "email": email,
                "password": password,
            },
        )
        assert registration.status_code == 201, registration.text
        owner = registration.json()

        login = client.post(
            "/auth/login",
            data={"username": username, "password": password},
        )
        assert login.status_code == 200, login.text
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        created = []
        for listing in listings:
            response = client.post(
                "/equipment",
                headers=headers,
                json=listing | {"category": category},
            )
            assert response.status_code == 201, response.text
            created.append(response.json())

        basic = client.get("/equipment", params={"category": category})
        assert basic.status_code == 200, basic.text
        basic_data = basic.json()
        assert basic_data["page"] == 1
        assert basic_data["limit"] == 20
        assert basic_data["total"] == 5
        assert basic_data["total_pages"] == 1
        assert len(basic_data["items"]) == 5
        assert all(
            item["owner"]
            == {"id": owner["id"], "username": username, "name": owner["name"]}
            for item in basic_data["items"]
        )

        search = client.get(
            "/equipment",
            params={"search": "CAMERA", "category": category},
        )
        assert search.status_code == 200
        assert search.json()["total"] == 3
        assert all(
            "camera" in " ".join(
                [item["name"], item["description"] or "", item["category"]]
            ).lower()
            for item in search.json()["items"]
        )

        rent = client.get(
            "/equipment", params={"category": category, "listing_mode": "rent"}
        ).json()
        sell = client.get(
            "/equipment", params={"category": category, "listing_mode": "sell"}
        ).json()
        assert rent["total"] == 3 and all(
            item["listing_mode"] == "rent" for item in rent["items"]
        )
        assert sell["total"] == 2 and all(
            item["listing_mode"] == "sell" for item in sell["items"]
        )

        category_case = client.get(
            "/equipment", params={"category": category.upper()}
        ).json()
        assert category_case["total"] == 5

        good = client.get(
            "/equipment", params={"category": category, "condition": "good"}
        ).json()
        assert good["total"] == 3
        assert all(item["condition"] == "good" for item in good["items"])

        available = client.get(
            "/equipment",
            params={"category": category, "availability_status": "available"},
        ).json()
        assert available["total"] == 4
        assert all(
            item["availability_status"] == "available"
            for item in available["items"]
        )

        price_range = client.get(
            "/equipment",
            params={"category": category, "min_price": 600, "max_price": 1200},
        ).json()
        assert price_range["total"] == 3
        assert all(600 <= float(item["price"]) <= 1200 for item in price_range["items"])

        price_asc = client.get(
            "/equipment", params={"category": category, "sort": "price_asc"}
        ).json()["items"]
        price_desc = client.get(
            "/equipment", params={"category": category, "sort": "price_desc"}
        ).json()["items"]
        assert [float(item["price"]) for item in price_asc] == sorted(
            float(item["price"]) for item in price_asc
        )
        assert [float(item["price"]) for item in price_desc] == sorted(
            (float(item["price"]) for item in price_desc), reverse=True
        )

        newest_ids = [
            item["id"]
            for item in client.get(
                "/equipment", params={"category": category, "sort": "newest"}
            ).json()["items"]
        ]
        oldest_ids = [
            item["id"]
            for item in client.get(
                "/equipment", params={"category": category, "sort": "oldest"}
            ).json()["items"]
        ]
        assert newest_ids == list(reversed(oldest_ids))

        page_one = client.get(
            "/equipment",
            params={"category": category, "sort": "oldest", "page": 1, "limit": 2},
        ).json()
        page_two = client.get(
            "/equipment",
            params={"category": category, "sort": "oldest", "page": 2, "limit": 2},
        ).json()
        assert page_one | {"items": []} == {
            "items": [],
            "page": 1,
            "limit": 2,
            "total": 5,
            "total_pages": 3,
        }
        assert page_two["page"] == 2 and len(page_two["items"]) == 2
        assert {item["id"] for item in page_one["items"]}.isdisjoint(
            item["id"] for item in page_two["items"]
        )

        combined = client.get(
            "/equipment",
            params={
                "search": "camera",
                "listing_mode": "rent",
                "category": category,
                "condition": "good",
                "availability_status": "available",
                "max_price": 1000,
                "sort": "price_asc",
                "page": 1,
                "limit": 10,
            },
        ).json()
        assert combined["total"] == 1
        assert combined["items"][0]["name"].startswith("DSLR Camera")

        empty_search = client.get(
            "/equipment", params={"search": "   ", "category": category}
        ).json()
        assert empty_search["total"] == 5

        beyond = client.get(
            "/equipment", params={"category": category, "page": 99, "limit": 2}
        ).json()
        assert beyond["items"] == []
        assert beyond["total"] == 5 and beyond["total_pages"] == 3

        zero = client.get(
            "/equipment", params={"category": f"missing-{unique_id}"}
        ).json()
        assert zero["items"] == [] and zero["total"] == 0
        assert zero["total_pages"] == 0

        invalid_queries = [
            {"listing_mode": "exchange"},
            {"condition": "broken"},
            {"availability_status": "reserved"},
            {"sort": "popular"},
            {"min_price": -1},
            {"max_price": -1},
            {"min_price": 1000, "max_price": 100},
            {"page": 0},
            {"limit": 0},
            {"limit": 101},
        ]
        for params in invalid_queries:
            response = client.get("/equipment", params=params)
            assert response.status_code == 422, (params, response.text)

        print("Equipment search and filtering tests passed.")
        print("Equipment sorting and pagination tests passed.")
        print("Equipment discovery edge-case tests passed.")
    finally:
        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.email == email))
            if user is not None:
                db.delete(user)
                db.commit()
            assert db.scalar(select(User).where(User.email == email)) is None


if __name__ == "__main__":
    main()
