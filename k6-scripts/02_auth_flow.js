// ─────────────────────────────────────────────────────────────────────────────
// 02_auth_flow.js  —  Authentication Flow
// Purpose : Test register → login → use token flow
// Run     : k6 run 02_auth_flow.js
// ─────────────────────────────────────────────────────────────────────────────
import http from "k6/http";
import { check, sleep, group } from "k6";

export const options = {
  vus: 5,
  duration: "20s",
  thresholds: {
    http_req_failed: ["rate<0.01"],            // <1% errors
    http_req_duration: ["p(95)<600"],          // 95% under 600ms
  },
};

const BASE = "http://localhost:8000";
const HEADERS = { "Content-Type": "application/json" };

export default function () {
  const unique = `user_${__VU}_${Date.now()}`;

  group("Register", () => {
    const res = http.post(
      `${BASE}/auth/register`,
      JSON.stringify({ username: unique, password: "pass1234", email: `${unique}@test.com` }),
      { headers: HEADERS }
    );
    check(res, {
      "register 201": (r) => r.status === 201,
      "has user id": (r) => r.json("id") !== undefined,
    });
  });

  sleep(0.5);

  let token = "";
  group("Login", () => {
    const res = http.post(
      `${BASE}/auth/login`,
      JSON.stringify({ username: unique, password: "pass1234" }),
      { headers: HEADERS }
    );
    check(res, {
      "login 200": (r) => r.status === 200,
      "has access_token": (r) => r.json("access_token") !== undefined,
    });
    if (res.status === 200) token = res.json("access_token");
  });

  sleep(0.5);

  group("Wrong password rejected", () => {
    const res = http.post(
      `${BASE}/auth/login`,
      JSON.stringify({ username: unique, password: "wrong!" }),
      { headers: HEADERS }
    );
    check(res, { "wrong password → 401": (r) => r.status === 401 });
  });

  group("Access protected route with token", () => {
    const res = http.get(`${BASE}/orders`, {
      headers: { ...HEADERS, Authorization: `Bearer ${token}` },
    });
    check(res, {
      "orders 200 with valid token": (r) => r.status === 200,
    });
  });

  group("Access protected route without token", () => {
    const res = http.get(`${BASE}/orders`);
    check(res, { "no token → 401": (r) => r.status === 401 });
  });

  sleep(1);
}
