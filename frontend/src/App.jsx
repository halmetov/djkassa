import { useEffect, useState } from "react";
import { fetchCustomers, login, logout } from "./api/client";
import { getTokens, isAuthenticated } from "./api/auth";

const defaultForm = { username: "", password: "" };

function App() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [customers, setCustomers] = useState([]);
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());

  useEffect(() => {
    if (authenticated) {
      handleLoad();
    }
  }, [authenticated]);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const tokens = await login(form);
      setAuthenticated(true);
      setMessage("Авторизация успешна. Access и refresh сохранены.");
      setForm(defaultForm);
      setCustomers([]);
      const loaded = await fetchCustomers();
      setCustomers(loaded);
      console.info("Tokens", tokens);
    } catch (err) {
      const detail = err?.response?.data || err.message;
      setError(`Не удалось войти: ${JSON.stringify(detail)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async () => {
    setLoading(true);
    setError("");
    try {
      const loaded = await fetchCustomers();
      setCustomers(loaded);
      setMessage("Данные клиентов загружены.");
    } catch (err) {
      const detail = err?.response?.data || err.message;
      setError(`Ошибка загрузки: ${JSON.stringify(detail)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setMessage("Вы вышли из системы, токены очищены.");
    setCustomers([]);
    setAuthenticated(false);
  };

  const { access, refresh } = getTokens();

  return (
    <div className="app">
      <div className="header">
        <h1>Kassa Frontend (Vite + React)</h1>
        <div className="badge">API: {import.meta.env.VITE_API_BASE_URL || "/api/v1"}</div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Логин (JWT)</h2>
          <form className="stack" onSubmit={handleLogin}>
            <label className="stack">
              <span>Имя пользователя</span>
              <input
                className="input"
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="admin"
                required
              />
            </label>

            <label className="stack">
              <span>Пароль</span>
              <input
                className="input"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
            </label>

            <div className="stack" style={{ gap: 8, flexDirection: "row" }}>
              <button className="button" type="submit" disabled={loading}>
                {loading ? "..." : "Войти и получить токены"}
              </button>
              <button className="button secondary" type="button" onClick={handleLogout}>
                Выйти
              </button>
            </div>
          </form>

          {message && <p style={{ color: "#065f46" }}>{message}</p>}
          {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

          <div className="stack" style={{ marginTop: 12 }}>
            <strong>Текущие токены:</strong>
            <div className="stack">
              <code>access: {access ? `${access.slice(0, 24)}...` : "—"}</code>
              <code>refresh: {refresh ? `${refresh.slice(0, 24)}...` : "—"}</code>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="header">
            <h2>Клиенты</h2>
            <button className="button secondary" onClick={handleLoad} disabled={loading}>
              {loading ? "..." : "Обновить"}
            </button>
          </div>
          {!customers.length && <p>Нет данных. Авторизуйтесь и загрузите список.</p>}
          <ul className="list">
            {customers.map((customer) => (
              <li className="list-item" key={customer.id}>
                <div className="stack">
                  <strong>{customer.name}</strong>
                  {customer.phone && <span>{customer.phone}</span>}
                  {customer.email && <span>{customer.email}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
