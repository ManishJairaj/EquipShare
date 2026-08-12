# EquipShare

EquipShare is a full-stack web application for college students to share, rent,
lend, and borrow equipment such as cameras, calculators, lab equipment, sports
gear, electronics, and tools.

This repository currently contains the frontend and backend foundations only.

## Tech stack

- Frontend: React, Vite, JavaScript, React Router, Axios, and plain CSS
- Backend: Python, FastAPI, SQLAlchemy, PostgreSQL, Pydantic, Uvicorn, and Alembic

## Project structure

```text
EquipShare/
├── frontend/             # React and Vite application
├── backend/
│   ├── app/              # FastAPI application
│   ├── alembic/          # Database migration files
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env.example
├── .gitignore
└── README.md
```

## Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

## Start the backend

1. Create and activate a virtual environment:

   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install the dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Copy the example environment file and update it with your PostgreSQL details:

   ```bash
   cp .env.example .env
   ```

4. Start the development server:

   ```bash
   fastapi dev app/main.py
   ```

The API runs at `http://localhost:8000`. Visit `http://localhost:8000/docs` for
the interactive API documentation.

## Database and migrations

EquipShare uses SQLAlchemy and the `psycopg` driver to connect from FastAPI to a
PostgreSQL database. Supabase may host that PostgreSQL database, but the frontend
does not connect to Supabase directly.

Set the Supabase PostgreSQL connection string in `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://username:password@host:5432/postgres
SECRET_KEY=replace-with-a-secure-random-value
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

## Backend tests

Tests never use `DATABASE_URL`. Configure a separate PostgreSQL database in
`backend/.env` before running database integration tests:

```env
TEST_DATABASE_URL=postgresql+psycopg://username:password@test-host:5432/postgres
```

Install the development dependencies and migrate only that dedicated test
database. The migration helper reads `TEST_DATABASE_URL`, verifies that it is
PostgreSQL and differs from `DATABASE_URL`, and does not display either URL:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-dev.txt
python -m scripts.migrate_test_db
pytest -v
```

If `TEST_DATABASE_URL` is absent, the database integration tests are skipped.
The fixture also refuses SQLite and refuses a test URL equal to `DATABASE_URL`.
Each test runs inside an outer transaction that is rolled back afterward.

Sale purchases currently reuse the rental-request table and action routes. A
same-day request for a `sell` listing is treated as a purchase request; future
date ranges are rejected for sale listings. A dedicated purchase-request type or
table would make this distinction more explicit in a future backend revision.

After activating the backend virtual environment, verify the connection with:

```bash
python -m scripts.check_db
```

Create and apply future migrations with:

```bash
alembic revision --autogenerate -m "describe the schema change"
alembic upgrade head
```

## Authentication API

Authentication is handled entirely by FastAPI using the `users` PostgreSQL
table. Passwords are hashed with Argon2 and access tokens are signed JWTs.
Registration requires a unique username and email. Usernames are lowercase,
3–30 characters, and may contain letters, numbers, and underscores.

- `POST /auth/register` creates a user.
- `POST /auth/login` accepts an OAuth2 form with either username or email in the
  form's `username` field.
- `GET /auth/me` returns the authenticated user for a valid Bearer token.

## Equipment API

- `POST /equipment` creates a listing owned by the authenticated user.
- `GET /equipment` lists equipment publicly with search, filters, sorting, and
  page-based pagination. Its response contains `items`, `page`, `limit`, `total`,
  and `total_pages`.
- `GET /equipment/me` lists the authenticated user's equipment.
- `GET /equipment/{equipment_id}` returns one public listing.
- `PATCH /equipment/{equipment_id}` updates an owned listing.
- `DELETE /equipment/{equipment_id}` deletes an owned listing.

Only a listing's owner can update or delete it. Ownership is derived from the
authenticated user and is never accepted from request data.

Equipment listings use `listing_mode` (`rent` or `sell`) and one numeric `price`.
Rental prices are displayed per day, while sale prices are displayed as one-time
prices. API responses include only the owner's public `id`, `username`, and
`name`; PostgreSQL relationships continue to use `owner_id`.

## Rental request API

- `POST /rentals` creates a pending request for the authenticated borrower.
- `GET /rentals/my-requests` lists the borrower's outgoing requests.
- `GET /rentals/incoming` lists requests for the owner's equipment.
- `GET /rentals/{request_id}` is available to the borrower and equipment owner.
- `PATCH /rentals/{request_id}/accept` accepts a pending request as the owner.
- `PATCH /rentals/{request_id}/reject` rejects a pending request as the owner.
- `PATCH /rentals/{request_id}/cancel` cancels a pending or accepted request as
  the borrower.

Accepted requests cannot overlap for the same equipment and date range.
Equipment availability is not changed automatically because requests may be for
future dates; accepted rental requests are the reservation source of truth.
