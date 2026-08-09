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

- `POST /auth/register` creates a user.
- `POST /auth/login` accepts an OAuth2 form with the email in `username`.
- `GET /auth/me` returns the authenticated user for a valid Bearer token.
