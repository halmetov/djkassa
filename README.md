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

### Локальный запуск (кратко)

```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head  # применит миграции (dev: если миграций нет, схема создастся из моделей)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd ../frontend && npm install
npm run dev  # http://localhost:5173
```

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
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload  # приложение само запускает bootstrap при старте
```

### Возможности

- JWT (access + refresh) авторизация и проверки ролей (admin/seller)
- CRUD для категорий, товаров, сотрудников, филиалов, клиентов
- Приходы с автоматическим обновлением склада
- Продажи (POS API) c учётом остатков и долгов
- Возвраты, отчёты, статические загрузки фото
- Alembic миграции и модульная структура сервисов

### Производство (Цех)

- Добавлена роль `manager`, видящая только разделы цеха.
- Новые API с префиксом `/api/workshop` (заказы, материалы, выплаты, отчет, сотрудники цеха).
- В таблице филиалов используется флаг `is_workshop` для отметки цеха (миграция проставляет для ветки с названием «Цех»).
- После миграции выполните `alembic upgrade head`, затем перезапустите backend и фронтенд.

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
set PYTHONPATH=.  # или $env:PYTHONPATH='.' для PowerShell
python main.py  # или uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd ..\frontend
npm install
npm run dev  # или npm run build
```

## Дополнительно

- При первом запуске (через `python -m app.bootstrap` или при старте uvicorn) автоматически создаются филиалы: `Магазин`, `Склад1`, `Склад2`, а также пользователь `admin` с паролем из переменной `ADMIN_PASSWORD` (или `admin` по умолчанию).
- CORS настроен для `http://localhost:8080`, `http://127.0.0.1:8080`, `http://localhost:5173`, `http://127.0.0.1:5173` (credentials включены).
- В каталоге `backend/app/static/uploads` сохраняются фото товаров.
- Схема базы данных покрывает таблицы: `users, categories, products, branches, stock, income, income_items, sales, sales_items, clients, debts, returns, logs`.
- Для интеграции с мобильной кассой используйте endpoints `/api/sales`, `/api/categories`, `/api/products`.

## После обновления кода

- Backend: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && alembic upgrade head && uvicorn app.main:app --reload`
- Frontend: `cd frontend && npm install && npm run dev`
