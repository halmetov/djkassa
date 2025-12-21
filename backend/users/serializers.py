from django.contrib.auth import get_user_model
from rest_framework import serializers
from core.models import Role, Employee, Branch

User = get_user_model()


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "code", "name"]


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "name", "address", "is_active"]


class EmployeeSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), write_only=True)
    role = RoleSerializer(read_only=True)
    branch = BranchSerializer(read_only=True)

    class Meta:
        model = Employee
        fields = ["id", "user", "role", "branch", "phone", "is_active"]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "is_active", "is_staff"]
