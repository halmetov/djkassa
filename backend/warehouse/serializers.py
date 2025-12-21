from rest_framework import serializers
from core.models import Branch, Category, Product, Stock, StockMove, StockMoveItem


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "name", "address", "is_active"]


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "is_active"]


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), write_only=True, source="category"
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "category",
            "category_id",
            "name",
            "sku",
            "unit",
            "purchase_price",
            "sale_price",
            "is_active",
        ]


class StockSerializer(serializers.ModelSerializer):
    branch = BranchSerializer(read_only=True)
    product = ProductSerializer(read_only=True)

    class Meta:
        model = Stock
        fields = ["id", "branch", "product", "qty", "updated_at"]


class StockMoveItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), write_only=True, source="product"
    )

    class Meta:
        model = StockMoveItem
        fields = ["id", "product", "product_id", "qty", "price"]


class StockMoveSerializer(serializers.ModelSerializer):
    items = StockMoveItemSerializer(many=True)

    class Meta:
        model = StockMove
        fields = [
            "id",
            "move_type",
            "status",
            "from_branch",
            "to_branch",
            "created_by",
            "created_at",
            "note",
            "items",
        ]
        read_only_fields = ["id", "status", "created_at", "created_by"]
