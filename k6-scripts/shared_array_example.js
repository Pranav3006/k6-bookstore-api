import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

// Loads users.json ONCE into shared memory — all VUs read from the same copy
const users = new SharedArray("users", function () {
  return JSON.parse(open("./users.json"));
});

export const options = {
  vus: 5,
  duration: "20s",
};

const BASE = "http://localhost:8000";

export default function () {
  // Each VU picks a user by its index (cycles through if more VUs than users)
  const user = users[__VU % users.length];

  const res = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ username: user.username, password: user.password }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(res, {
    "login 200":        (r) => r.status === 200,
    "has access_token": (r) => r.json("access_token") !== undefined,
  });

  console.log(`VU ${__VU} logged in as: ${user.username}`);

  sleep(1);
}
