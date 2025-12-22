from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.models import Role, Employee, Branch
from users.serializers import RoleSerializer, EmployeeSerializer
from users import services

User = get_user_model()


class AuthTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]


class AuthTokenRefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


class RoleViewSet(viewsets.ViewSet):
    async def list(self, request):
        roles = [obj async for obj in Role.objects.all()]
        data = RoleSerializer(roles, many=True).data
        return Response(data)

    async def create(self, request):
        serializer = RoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = await services.ensure_role(serializer.validated_data["code"], serializer.validated_data["name"])
        return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)


class EmployeeViewSet(viewsets.ViewSet):
    async def list(self, request):
        employees = [obj async for obj in Employee.objects.select_related("user", "role", "branch").all()]
        data = EmployeeSerializer(employees, many=True).data
        return Response(data)

    async def retrieve(self, request, pk=None):
        employee = await Employee.objects.select_related("user", "role", "branch").aget(pk=pk)
        return Response(EmployeeSerializer(employee).data)

    async def create(self, request):
        serializer = EmployeeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        role_id = request.data.get("role_id")
        branch_id = request.data.get("branch_id")
        role = await Role.objects.aget(pk=role_id)
        branch = await Branch.objects.aget(pk=branch_id)
        employee = await services.create_employee(
            user=user,
            role=role,
            branch=branch,
            phone=serializer.validated_data.get("phone", ""),
            is_active=serializer.validated_data.get("is_active", True),
        )
        return Response(EmployeeSerializer(employee).data, status=status.HTTP_201_CREATED)

    async def partial_update(self, request, pk=None):
        employee = await Employee.objects.select_related("user", "role", "branch").aget(pk=pk)
        serializer = EmployeeSerializer(employee, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        await services.update_employee(employee, **serializer.validated_data)
        refreshed = await Employee.objects.select_related("user", "role", "branch").aget(pk=employee.pk)
        return Response(EmployeeSerializer(refreshed).data)
