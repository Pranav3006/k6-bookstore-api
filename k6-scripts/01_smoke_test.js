// ─────────────────────────────────────────────────────────────────────────────
// 01_smoke_test.js  —  Smoke Test
// Purpose : Verify the API is alive with minimal load (1 VU, 1 iteration)
// Run     : k6 run 01_smoke_test.js
// ─────────────────────────────────────────────────────────────────────────────
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  iterations: 1,
};

const BASE = "http://localhost:8000";

export default function () {
  // 1. Health check
  const res = http.get(`${BASE}/`);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "service name present": (r) => r.json("service") === "K6 Bookstore API",
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  // 2. Book listing works
  const books = http.get(`${BASE}/books`);
  check(books, {
    "books endpoint 200": (r) => r.status === 200,
    "has data array": (r) => Array.isArray(r.json("data")),
    "has total field": (r) => r.json("total") > 0,
  });

  sleep(1);
}
