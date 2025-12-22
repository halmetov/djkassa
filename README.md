# Kassa Skald Backend (Django 5 + DRF)

Асинхронный backend для "КАССА СКЛАД" на Django 5.x с DRF, SimpleJWT и drf-spectacular. Репозиторий содержит приложения для склада, заказов, долгов, отчетов и пользователей.

## Структура
```
backend/
  manage.py
  kassa_project/
  core/           # базовые модели
  common/         # permissions, utils, exceptions
  users/          # роли, сотрудники, auth
  warehouse/      # товары, склады, движения
  orders/         # заказы, оплаты, долги
  reports/        # дашборд
  api/            # v1 маршруты
```

## Установка
```bash
python -m venv .venv
source .venv/bin/activate  # или .venv\\Scripts\\activate в Windows
pip install -r backend/requirements.txt
```

## Переменные окружения
Создайте файл `.env` (опционально) или передайте переменные напрямую:
- `DJANGO_SECRET_KEY` — секретный ключ.
- `DJANGO_DEBUG` — `true/false`.
- `DJANGO_ALLOWED_HOSTS` — список хостов через запятую.
- `DATABASE_URL` — строка подключения (PostgreSQL). Если отсутствует, берутся переменные `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`. По умолчанию используется SQLite.
- `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS` — время жизни токенов.

## Миграции и запуск
```bash
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

## Swagger и API
- OpenAPI схема: `http://localhost:8000/api/schema/`
- Swagger UI: `http://localhost:8000/api/schema/swagger/`
- Базовые маршруты размещены под `/api/v1/`.
- JWT: `POST http://localhost:8000/api/v1/auth/token/` (только POST, GET вернёт 405)
- Обновление токена: `POST http://localhost:8000/api/v1/auth/token/refresh/`
- Пример получения токена:
```bash
curl -X POST http://localhost:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'
```
- Пример авторизованного запроса (список клиентов):
```bash
curl http://localhost:8000/api/v1/customers/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Frontend (Vite + React)
- Код расположен в `frontend/`. Используется единый `baseURL` для API: `/api/v1` (или из `VITE_API_BASE_URL`).\
  При запуске dev-сервера настроен прокси на `http://localhost:8000/api`.
- Установка зависимостей: `cd frontend && npm install`
- Запуск dev: `npm run dev`
- Сборка: `npm run build`
- Переменные окружения:
  - `VITE_API_BASE_URL` — базовый путь к API (по умолчанию `/api/v1`). Пример: `http://localhost:8000/api/v1`

## Тесты
```bash
cd backend
python manage.py test
```
