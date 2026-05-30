// ─────────────────────────────────────────────────────────────────────────────
// 03_crud_books.js  —  Full CRUD lifecycle for Books
// Purpose : Create → Read → Update → Delete a book (authenticated)
// Run     : k6 run 03_crud_books.js
// ─────────────────────────────────────────────────────────────────────────────
import http from "k6/http";
import { check, sleep, group } from "k6";

export const options = {
  vus: 3,
  iterations: 9,   // 3 VUs × 3 iterations each
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(99)<1000"],
  },
};

const BASE = "http://localhost:8000";
const JSON_HEADERS = { "Content-Type": "application/json" };

function getAuthHeaders(token) {
  return { ...JSON_HEADERS, Authorization: `Bearer ${token}` };
}

// ── Setup: create a user and return token ────────────────────────────────────
export function setup() {
  const u = `crud_user_${Date.now()}`;
  http.post(`${BASE}/auth/register`,
    JSON.stringify({ username: u, password: "test1234", email: `${u}@k6.io` }),
    { headers: JSON_HEADERS });
  const login = http.post(`${BASE}/auth/login`,
    JSON.stringify({ username: u, password: "test1234" }),
    { headers: JSON_HEADERS });
  return { token: login.json("access_token") };
}

export default function ({ token }) {
  let bookId;

  group("Create book", () => {
    const payload = {
      title: `Test Book ${__VU}-${__ITER}`,
      author: "K6 Author",
      genre: "Technology",
      price: 29.99,
      stock: 10,
    };
    const res = http.post(`${BASE}/books`, JSON.stringify(payload), {
      headers: getAuthHeaders(token),
    });
    check(res, {
      "create book 201": (r) => r.status === 201,
      "book has id": (r) => r.json("id") !== undefined,
      "title matches": (r) => r.json("title") === payload.title,
    });
    if (res.status === 201) bookId = res.json("id");
  });

  sleep(0.3);

  group("Read book", () => {
    if (!bookId) return;
    const res = http.get(`${BASE}/books/${bookId}`);
    check(res, {
      "get book 200": (r) => r.status === 200,
      "correct book returned": (r) => r.json("id") === bookId,
    });
  });

  sleep(0.3);

  group("Update book", () => {
    if (!bookId) return;
    const updated = { title: "Updated Title", author: "K6 Author", genre: "Technology", price: 39.99, stock: 5 };
    const res = http.put(`${BASE}/books/${bookId}`, JSON.stringify(updated), {
      headers: getAuthHeaders(token),
    });
    check(res, {
      "update 200": (r) => r.status === 200,
      "price updated": (r) => r.json("price") === 39.99,
    });
  });

  sleep(0.3);

  group("Delete book", () => {
    if (!bookId) return;
    const del = http.del(`${BASE}/books/${bookId}`, null, {
      headers: getAuthHeaders(token),
    });
    check(del, { "delete 204": (r) => r.status === 204 });

    // Confirm it's gone
    const get = http.get(`${BASE}/books/${bookId}`);
    check(get, { "deleted book is 404": (r) => r.status === 404 });
  });

  sleep(1);
}
