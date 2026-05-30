// ─────────────────────────────────────────────────────────────────────────────
// 04_pagination_and_filters.js  —  Pagination & Filtering
// Purpose : Test page/limit params, genre filter, price range filter
// Run     : k6 run 04_pagination_and_filters.js
// ─────────────────────────────────────────────────────────────────────────────
import http from "k6/http";
import { check, sleep, group } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<400"],
  },
};

const BASE = "http://localhost:8000";

export default function () {
  group("Default pagination", () => {
    const res = http.get(`${BASE}/books`);
    check(res, {
      "200 OK": (r) => r.status === 200,
      "default limit=5": (r) => r.json("data").length <= 5,
      "has pages field": (r) => r.json("pages") >= 1,
    });
  });

  group("Custom page size", () => {
    const res = http.get(`${BASE}/books?page=1&limit=3`);
    check(res, {
      "200 OK": (r) => r.status === 200,
      "max 3 results": (r) => r.json("data").length <= 3,
    });
  });

  group("Page 2", () => {
    const p1 = http.get(`${BASE}/books?page=1&limit=3`).json("data");
    const p2 = http.get(`${BASE}/books?page=2&limit=3`).json("data");
    check({ p1, p2 }, {
      "page 2 different from page 1": ({ p1, p2 }) =>
        p1.length === 0 || p2.length === 0 || p1[0].id !== p2[0].id,
    });
  });

  group("Genre filter", () => {
    const res = http.get(`${BASE}/books?genre=Self-Help&limit=20`);
    check(res, {
      "200 OK": (r) => r.status === 200,
      "all results match genre": (r) =>
        r.json("data").every((b) => b.genre === "Self-Help"),
    });
  });

  group("Price range filter", () => {
    const res = http.get(`${BASE}/books?min_price=10&max_price=20&limit=20`);
    check(res, {
      "200 OK": (r) => r.status === 200,
      "all books within price range": (r) =>
        r.json("data").every((b) => b.price >= 10 && b.price <= 20),
    });
  });

  sleep(1);
}
