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

### Быстрый старт

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # настройте DATABASE_URL и JWT_SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload
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

## Дополнительно

- В каталоге `backend/app/static/uploads` сохраняются фото товаров.
- Схема базы данных покрывает таблицы: `users, categories, products, branches, stock, income, income_items, sales, sales_items, clients, debts, returns, logs`.
- Для интеграции с мобильной кассой используйте endpoints `/api/sales`, `/api/categories`, `/api/products`.
