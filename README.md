# Kassa (модели Django)

Это минимальный Django-проект с приложением `core`, где уже есть модели под "Касса + Склад".

## Быстрый старт
```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install django
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```
Затем открой: http://127.0.0.1:8000/admin/

## Про async
Модели одинаковые, а асинхронность — во вьюхах/сервисах (aget/acreate и т.п.).
