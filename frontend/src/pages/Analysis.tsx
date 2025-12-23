import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { apiGet } from "@/api/client";
import { toast } from "sonner";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

type DailyReport = { day: string; amount: number; credit: number };
type TopProduct = { name: string; quantity: number; revenue: number };
type PaymentBreakdown = { cash: number; kaspi: number; credit: number };

type AnalyticsResponse = {
  sales_by_date: { day: string; total_sales: number; total_credit: number }[];
  payment_breakdown: PaymentBreakdown;
  top_products: TopProduct[];
  total_sales: number;
  total_debt: number;
  total_receipts: number;
};

export default function Analysis() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [salesByDate, setSalesByDate] = useState<DailyReport[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown>({ cash: 0, kaspi: 0, credit: 0 });
  const [totalStats, setTotalStats] = useState({ totalSales: 0, totalDebt: 0, totalReceipts: 0 });

  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
    fetchAnalytics(start, end);
  }, []);

  const fetchAnalytics = async (start: Date, end: Date) => {
    try {
      const params = new URLSearchParams({ start_date: start.toISOString().split('T')[0], end_date: end.toISOString().split('T')[0] });
      const data = await apiGet<AnalyticsResponse>(`/api/reports/analytics?${params.toString()}`);
      setSalesByDate(data.sales_by_date.map((d) => ({ day: d.day, amount: d.total_sales, credit: d.total_credit })));
      setTopProducts(data.top_products);
      setPaymentBreakdown(data.payment_breakdown);
      setTotalStats({ totalSales: data.total_sales, totalDebt: data.total_debt, totalReceipts: data.total_receipts });
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить аналитику");
    }
  };

  const handleFilter = () => {
    if (startDate && endDate) {
      fetchAnalytics(new Date(startDate), new Date(endDate));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Анализ</h1>
        <p className="text-muted-foreground">Аналитика продаж</p>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <Label>Дата начала</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>Дата окончания</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={handleFilter} className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
              Применить
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Всего продаж</div>
            <div className="text-3xl font-bold">{totalStats.totalSales.toFixed(2)} ₸</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Общий долг</div>
            <div className="text-3xl font-bold text-destructive">{totalStats.totalDebt.toFixed(2)} ₸</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Количество чеков</div>
            <div className="text-3xl font-bold">{totalStats.totalReceipts}</div>
          </Card>
        </div>

        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Продажи по дням</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesByDate}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="amount" stroke="#8884d8" name="Сумма (₸)" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Топ 10 товаров</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#8884d8" name="Выручка (₸)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Распределение оплат</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  dataKey="value"
                  data={[
                    { name: 'Наличные', value: paymentBreakdown.cash },
                    { name: 'Карта', value: paymentBreakdown.kaspi },
                    { name: 'В долг', value: paymentBreakdown.credit },
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {[
                    { name: 'Наличные', value: paymentBreakdown.cash },
                    { name: 'Карта', value: paymentBreakdown.kaspi },
                    { name: 'В долг', value: paymentBreakdown.credit },
                  ].map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </Card>
    </div>
  );
}
