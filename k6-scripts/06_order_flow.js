// ─────────────────────────────────────────────────────────────────────────────
// 06_order_flow.js  —  End-to-end Order Flow
// Purpose : Register → Login → Browse → Order → Confirm in order history
// Run     : k6 run 06_order_flow.js
// ─────────────────────────────────────────────────────────────────────────────
import http from "k6/http";
import { check, sleep, group } from "k6";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "group_duration{group:::Place order}": ["p(95)<800"],
  },
};

const BASE = "http://localhost:8000";
const H = { "Content-Type": "application/json" };

function authHeaders(token) {
  return { ...H, Authorization: `Bearer ${token}` };
}

export default function () {
  // 1. Register a fresh user per VU iteration
  const u = `order_user_${__VU}_${Date.now()}`;
  http.post(`${BASE}/auth/register`,
    JSON.stringify({ username: u, password: "k6rocks!", email: `${u}@k6.io` }), { headers: H });

  const loginRes = http.post(`${BASE}/auth/login`,
    JSON.stringify({ username: u, password: "k6rocks!" }), { headers: H });

  let token = "";
  check(loginRes, { "login OK": (r) => r.status === 200 });
  if (loginRes.status !== 200) return;
  token = loginRes.json("access_token");

  sleep(0.5);

  // 2. Browse books
  let bookId;
  group("Browse books", () => {
    const res = http.get(`${BASE}/books?limit=10`);
    check(res, { "books listed": (r) => r.status === 200 });
    const books = res.json("data");
    if (books && books.length > 0) {
      // pick a book that has stock
      const available = books.filter((b) => b.stock > 0);
      if (available.length > 0) bookId = available[0].id;
    }
  });

  if (!bookId) return;
  sleep(0.5);

  // 3. Place order
  let orderId;
  group("Place order", () => {
    const res = http.post(`${BASE}/orders`,
      JSON.stringify({ book_id: bookId, quantity: 1 }),
      { headers: authHeaders(token) });
    check(res, {
      "order 201": (r) => r.status === 201,
      "order confirmed": (r) => r.json("status") === "confirmed",
      "has total_price": (r) => r.json("total_price") > 0,
    });
    if (res.status === 201) orderId = res.json("id");
  });

  sleep(0.5);

  // 4. Verify order in history
  group("Check order history", () => {
    const res = http.get(`${BASE}/orders`, { headers: authHeaders(token) });
    check(res, {
      "orders 200": (r) => r.status === 200,
      "new order appears": (r) =>
        orderId && r.json("data").some((o) => o.id === orderId),
    });
  });

  sleep(1);
}
