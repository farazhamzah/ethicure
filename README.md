# Ethicure

This repo has 2 parts:
- `ethicure/` = frontend (React + Vite)
- `backend/` = backend (Django + PostgreSQL)

You need both running.

## 1) Requirements

Install these first:
- Git
- Node.js 18+ (npm included)
- Python 3.10+
- PostgreSQL

## 2) Clone

HTTPS:

```bash
git clone https://github.com/farazhamzah/ethicure.git
```

SSH:

```bash
git clone git@github.com:farazhamzah/ethicure.git
```

Then:

```bash
cd ethicure
```

## 3) Frontend Setup

From project root:

```bash
cd ethicure
npm install
```

If your machine misses some packages for some reason, run:

```bash
npm i react-router-dom recharts lucide-react tailwindcss zod
```

Create/edit `.env.local` in `ethicure/`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Important: use `VITE_API_BASE_URL` (not `VITE_API_URL`).

## 4) Backend Setup

From project root:

```bash
cd backend
python -m venv .venv
```

Activate it:

Linux/Mac:

```bash
source .venv/bin/activate
```

Windows:

```powershell
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install Django==4.2.27 djangorestframework==3.16.1 djangorestframework-simplejwt==5.5.1 django-cors-headers==4.9.0 psycopg2-binary==2.9.11 PyJWT==2.10.1
```

Optional for AI endpoints:

```bash
pip install openai
```

Notes:
- This backend currently has no `requirements.txt` in repo, so use the pip command above.
- OpenAI is not required for normal app flows.
- OpenAI is needed if you want AI chat/recommendations endpoints.

## 5) Database Setup (PostgreSQL)

Backend settings currently point to:
- DB name: `health_app`
- user: `health_admin`
- host: `127.0.0.1`
- port: `5432`

Make sure your local Postgres matches that, or update `backend/health_backend/settings.py`.

Then run migrations:

```bash
cd backend
source .venv/bin/activate
python manage.py migrate
```

Optional admin user:

```bash
python manage.py createsuperuser
```

## 6) OpenAI Key

Linux/Mac:

```bash
export OPENAI_API_KEY="your_real_key_here"
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your_real_key_here"
```

## 7) Run The App

Terminal 1 (backend):

```bash
cd backend
source .venv/bin/activate
python manage.py runserver
```

Terminal 2 (frontend):

```bash
cd ethicure
npm run dev
```

Open in browser:

```text
http://localhost:5173
```

## 8) Debug Note

For Django debugging, use:

```python
DEBUG=True
```

in `backend/health_backend/settings.py`.

If you wrote `/debug=True` in your notes before, no stress, the real Django setting is `DEBUG=True`.

## 9) Troubleshooting

Port 5173 busy (Linux/Mac):

```bash
lsof -i :5173
kill <PID>
```

If needed:

```bash
kill -9 <PID>
```

Port 8000 busy (Linux/Mac):

```bash
lsof -i :8000
kill <PID>
```

Windows:

```powershell
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

If backend import errors happen:
- Make sure the venv is activated.
- Re-run the backend pip install command.

If frontend cannot reach backend:
- Check `.env.local` has `VITE_API_BASE_URL`.
- Restart `npm run dev` after env changes.

## 10) Useful Frontend Scripts

From `ethicure/`:
- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run preview` - preview build
- `npm run lint` - linting
- `npm run test:component` - component tests
