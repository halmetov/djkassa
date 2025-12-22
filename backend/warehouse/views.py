from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.models import Branch, Category, Product, Stock, StockMove, StockMoveItem
from warehouse.serializers import (
    BranchSerializer,
    CategorySerializer,
    ProductSerializer,
    StockSerializer,
    StockMoveSerializer,
    StockMoveItemSerializer,
)
from warehouse import services as warehouse_services
from common.permissions import IsStaffOrReadOnly


class BranchViewSet(viewsets.ViewSet):
    permission_classes = [IsStaffOrReadOnly]

    def list(self, request):
        branches = list(Branch.objects.all())
        return Response(BranchSerializer(branches, many=True).data)

    def create(self, request):
        serializer = BranchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        branch = Branch.objects.create(**serializer.validated_data)
        return Response(BranchSerializer(branch).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        branch = Branch.objects.get(pk=pk)
        serializer = BranchSerializer(branch, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(branch, field, value)
        branch.save(update_fields=list(serializer.validated_data.keys()))
        return Response(BranchSerializer(branch).data)


class CategoryViewSet(viewsets.ViewSet):
    permission_classes = [IsStaffOrReadOnly]

    def list(self, request):
        categories = list(Category.objects.all())
        return Response(CategorySerializer(categories, many=True).data)

    def create(self, request):
        serializer = CategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = Category.objects.create(**serializer.validated_data)
        return Response(CategorySerializer(category).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        category = Category.objects.get(pk=pk)
        serializer = CategorySerializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(category, field, value)
        category.save(update_fields=list(serializer.validated_data.keys()))
        return Response(CategorySerializer(category).data)


class ProductViewSet(viewsets.ViewSet):
    permission_classes = [IsStaffOrReadOnly]

    def list(self, request):
        products = list(Product.objects.select_related("category").all())
        return Response(ProductSerializer(products, many=True).data)

    def retrieve(self, request, pk=None):
        product = Product.objects.select_related("category").get(pk=pk)
        return Response(ProductSerializer(product).data)

    def create(self, request):
        serializer = ProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = Product.objects.create(**serializer.validated_data)
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        product = Product.objects.get(pk=pk)
        serializer = ProductSerializer(product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(product, field, value)
        product.save(update_fields=list(serializer.validated_data.keys()))
        refreshed = Product.objects.select_related("category").get(pk=pk)
        return Response(ProductSerializer(refreshed).data)


class StockViewSet(viewsets.ViewSet):
    def list(self, request):
        qs = Stock.objects.select_related("branch", "product")
        branch_id = request.query_params.get("branch_id")
        product_id = request.query_params.get("product_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if product_id:
            qs = qs.filter(product_id=product_id)
        stocks = list(qs.all())
        return Response(StockSerializer(stocks, many=True).data)


class StockMoveViewSet(viewsets.ViewSet):
    def list(self, request):
        moves = StockMove.objects.select_related("from_branch", "to_branch", "created_by").prefetch_related(
            "items__product"
        )
        data = [self._serialize_move(move) for move in moves]
        return Response(data)

    def retrieve(self, request, pk=None):
        move = StockMove.objects.select_related("from_branch", "to_branch", "created_by").get(pk=pk)
        return Response(self._serialize_move(move))

    def create(self, request):
        serializer = StockMoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        move = warehouse_services.create_move_with_items(
            data={
                "move_type": validated["move_type"],
                "from_branch": validated.get("from_branch"),
                "to_branch": validated.get("to_branch"),
                "note": validated.get("note"),
                "items": [
                    {
                        "product": item["product"],
                        "qty": item["qty"],
                        "price": item.get("price", 0),
                    }
                    for item in validated["items"]
                ],
            },
            user=request.user,
        )
        move_refreshed = StockMove.objects.select_related("from_branch", "to_branch", "created_by").get(pk=move.pk)
        return Response(self._serialize_move(move_refreshed), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def post(self, request, pk=None):
        move = StockMove.objects.select_related("from_branch", "to_branch").get(pk=pk)
        warehouse_services.post_stock_move(move)
        refreshed = StockMove.objects.select_related("from_branch", "to_branch", "created_by").get(pk=pk)
        return Response(self._serialize_move(refreshed))

    def _serialize_move(self, move: StockMove) -> dict:
        items = list(move.items.select_related("product").all())
        serialized = StockMoveSerializer(move).data
        serialized["items"] = StockMoveItemSerializer(items, many=True).data
        return serialized
