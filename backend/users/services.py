from django.contrib.auth import get_user_model
from django.db import transaction
from core.models import Role, Employee, Branch

User = get_user_model()


async def ensure_role(code: str, name: str) -> Role:
    async with transaction.async_atomic():
        role, _ = await Role.objects.aget_or_create(code=code, defaults={"name": name})
    return role


async def create_employee(user: User, role: Role, branch: Branch, phone: str = "", is_active: bool = True) -> Employee:
    async with transaction.async_atomic():
        employee = await Employee.objects.acreate(
            user=user,
            role=role,
            branch=branch,
            phone=phone,
            is_active=is_active,
        )
    return employee


async def update_employee(employee: Employee, **kwargs) -> Employee:
    for field, value in kwargs.items():
        setattr(employee, field, value)
    await employee.asave(update_fields=list(kwargs.keys()))
    return employee
