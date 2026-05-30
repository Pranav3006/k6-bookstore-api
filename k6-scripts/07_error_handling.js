// ─────────────────────────────────────────────────────────────────────────────
// 07_error_handling.js  —  Error Handling & Status Code Assertions
// Purpose : Use the /error/{code} utility to verify k6 handles non-2xx well
// Run     : k6 run 07_error_handling.js
// ─────────────────────────────────────────────────────────────────────────────
import http from "k6/http";
import { check, sleep, group } from "k6";

export const options = {
  vus: 3,
  iterations: 15,
};

const BASE = "http://localhost:8000";

export default function () {
  group("4xx Errors", () => {
    const codes = [400, 401, 403, 404, 429];
    codes.forEach((code) => {
      const res = http.get(`${BASE}/error/${code}`);
      check(res, {
        [`/error/${code} returns ${code}`]: (r) => r.status === code,
        "has detail message": (r) => r.json("detail") !== undefined,
      });
    });
  });

  sleep(0.5);

  group("5xx Errors", () => {
    const codes = [500, 502, 503];
    codes.forEach((code) => {
      const res = http.get(`${BASE}/error/${code}`);
      check(res, {
        [`/error/${code} returns ${code}`]: (r) => r.status === code,
      });
    });
  });

  sleep(0.5);

  group("404 on missing book", () => {
    const res = http.get(`${BASE}/books/nonexistent-id-12345`);
    check(res, {
      "missing book → 404": (r) => r.status === 404,
    });
  });

  group("Unauthorized on protected route", () => {
    const res = http.post(`${BASE}/books`,
      JSON.stringify({ title: "Hack", author: "X", genre: "X", price: 1, stock: 1 }),
      { headers: { "Content-Type": "application/json" } });
    check(res, { "no auth → 401": (r) => r.status === 401 });
  });

  sleep(1);
}
