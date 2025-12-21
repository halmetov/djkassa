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

## Тесты
```bash
cd backend
python manage.py test
```
