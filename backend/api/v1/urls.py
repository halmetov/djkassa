from django.urls import path, include
from rest_framework.routers import DefaultRouter

from users.views import AuthTokenObtainPairView, AuthTokenRefreshView, RoleViewSet, EmployeeViewSet
from warehouse.views import BranchViewSet, CategoryViewSet, ProductViewSet, StockViewSet, StockMoveViewSet
from orders.views import CustomerViewSet, OrderViewSet, PaymentViewSet, CustomerDebtViewSet, DebtPaymentViewSet
from reports.views import DashboardView

router = DefaultRouter()
router.register(r"roles", RoleViewSet, basename="role")
router.register(r"employees", EmployeeViewSet, basename="employee")
router.register(r"branches", BranchViewSet, basename="branch")
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"products", ProductViewSet, basename="product")
router.register(r"stocks", StockViewSet, basename="stock")
router.register(r"stock-moves", StockMoveViewSet, basename="stock-move")
router.register(r"customers", CustomerViewSet, basename="customer")
router.register(r"orders", OrderViewSet, basename="order")
router.register(r"payments", PaymentViewSet, basename="payment")
router.register(r"customer-debts", CustomerDebtViewSet, basename="customer-debt")
router.register(r"debt-payments", DebtPaymentViewSet, basename="debt-payment")

urlpatterns = [
    path("auth/token/", AuthTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", AuthTokenRefreshView.as_view(), name="token_refresh"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("", include(router.urls)),
]
