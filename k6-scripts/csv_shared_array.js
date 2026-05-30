import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import papaparse from "https://jslib.k6.io/papaparse/5.1.1/index.js";

// Loads users.csv ONCE and parses it — shared across all VUs
const users = new SharedArray("users", function () {
  return papaparse.parse(open("./users.csv"), { header: true }).data;
});

export const options = {
  vus: 5,
  duration: "20s",
};

const BASE = "http://localhost:8000";
const HEADERS = { "Content-Type": "application/json" };

export default function () {
  const user = users[__VU % users.length];

  // Register
  const register = http.post(
    `${BASE}/auth/register`,
    JSON.stringify({ username: user.username, password: user.password, email: user.email }),
    { headers: HEADERS }
  );
  check(register, { "registered or already exists": (r) => r.status === 201 || r.status === 409 });

  sleep(0.5);

  // Login
  const login = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ username: user.username, password: user.password }),
    { headers: HEADERS }
  );
  check(login, {
    "login 200":        (r) => r.status === 200,
    "has access_token": (r) => r.json("access_token") !== undefined,
  });

  console.log(`VU ${__VU} → ${user.username} (${user.email})`);

  sleep(1);
}
