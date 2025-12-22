from django.contrib.auth import get_user_model
from django.db import transaction
from core.models import Role, Employee, Branch

User = get_user_model()


def ensure_role(code: str, name: str) -> Role:
    with transaction.atomic():
        role, _ = Role.objects.get_or_create(code=code, defaults={"name": name})
    return role


def create_employee(user: User, role: Role, branch: Branch, phone: str = "", is_active: bool = True) -> Employee:
    with transaction.atomic():
        employee = Employee.objects.create(
            user=user,
            role=role,
            branch=branch,
            phone=phone,
            is_active=is_active,
        )
    return employee


def update_employee(employee: Employee, **kwargs) -> Employee:
    for field, value in kwargs.items():
        setattr(employee, field, value)
    employee.save(update_fields=list(kwargs.keys()))
    return employee
