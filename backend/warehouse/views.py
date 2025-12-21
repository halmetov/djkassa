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

    async def list(self, request):
        branches = [b async for b in Branch.objects.all()]
        return Response(BranchSerializer(branches, many=True).data)

    async def create(self, request):
        serializer = BranchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        branch = await Branch.objects.acreate(**serializer.validated_data)
        return Response(BranchSerializer(branch).data, status=status.HTTP_201_CREATED)

    async def partial_update(self, request, pk=None):
        branch = await Branch.objects.aget(pk=pk)
        serializer = BranchSerializer(branch, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(branch, field, value)
        await branch.asave(update_fields=list(serializer.validated_data.keys()))
        return Response(BranchSerializer(branch).data)


class CategoryViewSet(viewsets.ViewSet):
    permission_classes = [IsStaffOrReadOnly]

    async def list(self, request):
        categories = [c async for c in Category.objects.all()]
        return Response(CategorySerializer(categories, many=True).data)

    async def create(self, request):
        serializer = CategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = await Category.objects.acreate(**serializer.validated_data)
        return Response(CategorySerializer(category).data, status=status.HTTP_201_CREATED)

    async def partial_update(self, request, pk=None):
        category = await Category.objects.aget(pk=pk)
        serializer = CategorySerializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(category, field, value)
        await category.asave(update_fields=list(serializer.validated_data.keys()))
        return Response(CategorySerializer(category).data)


class ProductViewSet(viewsets.ViewSet):
    permission_classes = [IsStaffOrReadOnly]

    async def list(self, request):
        products = [p async for p in Product.objects.select_related("category").all()]
        return Response(ProductSerializer(products, many=True).data)

    async def retrieve(self, request, pk=None):
        product = await Product.objects.select_related("category").aget(pk=pk)
        return Response(ProductSerializer(product).data)

    async def create(self, request):
        serializer = ProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = await Product.objects.acreate(**serializer.validated_data)
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)

    async def partial_update(self, request, pk=None):
        product = await Product.objects.aget(pk=pk)
        serializer = ProductSerializer(product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(product, field, value)
        await product.asave(update_fields=list(serializer.validated_data.keys()))
        refreshed = await Product.objects.select_related("category").aget(pk=pk)
        return Response(ProductSerializer(refreshed).data)


class StockViewSet(viewsets.ViewSet):
    async def list(self, request):
        qs = Stock.objects.select_related("branch", "product")
        branch_id = request.query_params.get("branch_id")
        product_id = request.query_params.get("product_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if product_id:
            qs = qs.filter(product_id=product_id)
        stocks = [s async for s in qs.all()]
        return Response(StockSerializer(stocks, many=True).data)


class StockMoveViewSet(viewsets.ViewSet):
    async def list(self, request):
        moves = [m async for m in StockMove.objects.select_related("from_branch", "to_branch", "created_by").all()]
        data = []
        for move in moves:
            items = [item async for item in move.items.select_related("product").all()]
            serialized = StockMoveSerializer(move).data
            serialized["items"] = StockMoveItemSerializer(items, many=True).data
            data.append(serialized)
        return Response(data)

    async def retrieve(self, request, pk=None):
        move = await StockMove.objects.select_related("from_branch", "to_branch", "created_by").aget(pk=pk)
        items = [item async for item in move.items.select_related("product").all()]
        data = StockMoveSerializer(move).data
        data["items"] = StockMoveItemSerializer(items, many=True).data
        return Response(data)

    async def create(self, request):
        serializer = StockMoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        move = await warehouse_services.create_move_with_items(
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
        return await self.retrieve(request, pk=move.pk)

    @action(detail=True, methods=["post"])
    async def post(self, request, pk=None):
        move = await StockMove.objects.select_related("from_branch", "to_branch").aget(pk=pk)
        await warehouse_services.post_stock_move(move)
        return await self.retrieve(request, pk=pk)
