# Kassa (Склад + Касса)

Полноценный моно-репозиторий с FastAPI backend и Vite + React frontend.

## Структура

```
/backend
  app/
    api, models, schemas, services, auth, database
  migrations/
  requirements.txt
/frontend
  package.json, vite.config.ts, src/
```

## Backend

### Версия Python

Проект собран и проверен на **Python 3.11/3.12**. Новые версии (например, 3.14) могут быть несовместимы с FastAPI/Starlette/Passlib, поэтому используйте 3.11 или 3.12 для создания окружения.

### Быстрый старт (Unix/macOS)

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # настройте DATABASE_URL и JWT_SECRET_KEY при необходимости
alembic upgrade head           # применит миграции
python -m app.bootstrap        # создаст admin (пароль из ADMIN_PASSWORD или 'admin') и филиалы
uvicorn app.main:app --reload  # приложение само запускает bootstrap при старте
```

### Возможности

- JWT (access + refresh) авторизация и проверки ролей (admin/seller)
- CRUD для категорий, товаров, сотрудников, филиалов, клиентов
- Приходы с автоматическим обновлением склада
- Продажи (POS API) c учётом остатков и долгов
- Возвраты, отчёты, статические загрузки фото
- Alembic миграции и модульная структура сервисов

API доступен по `http://localhost:8000`, статические файлы — `/static`.

## Frontend

### Быстрый старт

```bash
cd frontend
npm install
npm run dev
```

Vite поднимет SPA на `http://localhost:5173`. В `.env` приложения можно указать `VITE_API_URL` (по умолчанию `http://localhost:8000`).

### Запуск на Windows (PowerShell)

```powershell
# Backend
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
$env:DATABASE_URL="postgresql+psycopg2://postgres:123@localhost:5432/kassa_db"  # пример
alembic upgrade head
python -m app.bootstrap
python main.py  # или uvicorn app.main:app --reload

# Frontend
cd ..\frontend
npm install
npm run dev  # или npm run build
```

## Дополнительно

- При первом запуске (через `python -m app.bootstrap` или при старте uvicorn) автоматически создаются филиалы: `Магазин`, `Склад1`, `Склад2`, а также пользователь `admin` с паролем из переменной `ADMIN_PASSWORD` (или `admin` по умолчанию).
- CORS настроен для `http://localhost:8080` и `http://127.0.0.1:8080` с поддержкой credentials.
- В каталоге `backend/app/static/uploads` сохраняются фото товаров.
- Схема базы данных покрывает таблицы: `users, categories, products, branches, stock, income, income_items, sales, sales_items, clients, debts, returns, logs`.
- Для интеграции с мобильной кассой используйте endpoints `/api/sales`, `/api/categories`, `/api/products`.

## После обновления кода

- Backend: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && alembic upgrade head && uvicorn app.main:app --reload`
- Frontend: `cd frontend && npm install && npm run dev`
