from rest_framework.permissions import BasePermission


class IsStaffOrReadOnly(BasePermission):
    """
    Простое разрешение: чтение доступно всем авторизованным, запись — только staff.
    """

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return request.user.is_staff
