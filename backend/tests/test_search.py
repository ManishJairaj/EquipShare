import pytest


pytestmark = pytest.mark.integration


@pytest.fixture
def discovery_items(users, equipment_factory):
    owner = users["owner"]
    return [
        equipment_factory(
            owner=owner, name="DSLR Camera", description="Photography kit",
            category="Cameras", condition="good", listing_mode="rent", price="500"
        ),
        equipment_factory(
            owner=owner, name="Camera Tripod", description="Stable support",
            category="Cameras", condition="excellent", listing_mode="sell", price="1200"
        ),
        equipment_factory(
            owner=owner, name="Scientific Calculator", description="Engineering classes",
            category="Electronics", condition="good", listing_mode="sell", price="800"
        ),
        equipment_factory(
            owner=owner, name="Lab Microscope", description="Biology lab camera adapter",
            category="Lab", condition="fair", listing_mode="rent", price="2000",
            availability_status="unavailable"
        ),
    ]


def test_basic_listing_has_pagination_and_owner(client, discovery_items, users):
    response = client.get("/equipment", params={"search": "Camera"})
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["limit"] == 20
    assert data["total"] == 3
    assert data["total_pages"] == 1
    assert all(item["owner"]["username"] == users["owner"].username for item in data["items"])


def test_search_is_case_insensitive_across_supported_fields(client, discovery_items):
    response = client.get("/equipment", params={"search": "CAMERA"})
    assert response.status_code == 200
    assert {item["name"] for item in response.json()["items"]} == {
        "DSLR Camera", "Camera Tripod", "Lab Microscope"
    }


@pytest.mark.parametrize(
    ("params", "expected_names"),
    [
        ({"listing_mode": "rent"}, {"DSLR Camera", "Lab Microscope"}),
        ({"category": "electronics"}, {"Scientific Calculator"}),
        ({"condition": "good"}, {"DSLR Camera", "Scientific Calculator"}),
        ({"availability_status": "unavailable"}, {"Lab Microscope"}),
        ({"min_price": 600, "max_price": 1300}, {"Camera Tripod", "Scientific Calculator"}),
    ],
)
def test_equipment_filters(client, discovery_items, params, expected_names):
    response = client.get("/equipment", params=params)
    assert response.status_code == 200
    assert {item["name"] for item in response.json()["items"]} == expected_names


def test_max_price_applies_to_rent_and_sell_listings(client, discovery_items):
    response = client.get("/equipment", params={"max_price": 1000})
    assert response.status_code == 200
    items = response.json()["items"]
    assert {item["name"] for item in items} == {
        "DSLR Camera",
        "Scientific Calculator",
    }
    assert {item["listing_mode"] for item in items} == {"rent", "sell"}
    assert all(float(item["price"]) <= 1000 for item in items)


@pytest.mark.parametrize("sort", ["price_asc", "price_desc", "newest"])
def test_equipment_sorting(client, discovery_items, sort):
    items = client.get("/equipment", params={"sort": sort}).json()["items"]
    if sort == "price_asc":
        assert [float(item["price"]) for item in items] == sorted(float(item["price"]) for item in items)
    elif sort == "price_desc":
        assert [float(item["price"]) for item in items] == sorted(
            (float(item["price"]) for item in items), reverse=True
        )
    else:
        assert [item["id"] for item in items] == sorted(
            (item["id"] for item in items), reverse=True
        )


def test_pagination_returns_distinct_pages_and_metadata(client, discovery_items):
    first = client.get("/equipment", params={"sort": "oldest", "page": 1, "limit": 2}).json()
    second = client.get("/equipment", params={"sort": "oldest", "page": 2, "limit": 2}).json()
    assert first | {"items": []} == {"items": [], "page": 1, "limit": 2, "total": 4, "total_pages": 2}
    assert second["page"] == 2 and len(second["items"]) == 2
    assert {item["id"] for item in first["items"]}.isdisjoint(item["id"] for item in second["items"])


def test_combined_discovery_query(client, discovery_items):
    response = client.get(
        "/equipment",
        params={
            "search": "camera", "listing_mode": "rent", "condition": "good",
            "availability_status": "available", "max_price": 1000,
            "sort": "price_asc", "page": 1, "limit": 10,
        },
    )
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["name"] == "DSLR Camera"


@pytest.mark.parametrize(
    "params",
    [
        {"listing_mode": "exchange"}, {"condition": "broken"},
        {"availability_status": "reserved"}, {"min_price": -1},
        {"max_price": -1}, {"min_price": 1000, "max_price": 100},
        {"page": 0}, {"limit": 0}, {"limit": 101},
    ],
)
def test_invalid_discovery_parameters_return_validation_error(client, params):
    response = client.get("/equipment", params=params)
    assert response.status_code == 422
    assert response.json().get("detail")
