// ─────────────────────────────────────────────────────────────────────────────
// 09_reviews_with_setup.js  —  Setup / Teardown + Reviews
// Purpose : Demonstrates k6 setup() to create shared test data before the test
// Run     : k6 run 09_reviews_with_setup.js
// ─────────────────────────────────────────────────────────────────────────────
import http from "k6/http";
import { check, sleep, group } from "k6";

export const options = {
  vus: 4,
  duration: "20s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<600"],
  },
};

const BASE = "http://localhost:8000";
const H = { "Content-Type": "application/json" };
function authH(t) { return { ...H, Authorization: `Bearer ${t}` }; }

// ── setup(): runs ONCE before all VUs start ──────────────────────────────────
export function setup() {
  // Create a user
  const u = `review_setup_${Date.now()}`;
  http.post(`${BASE}/auth/register`,
    JSON.stringify({ username: u, password: "setup123", email: `${u}@k6.io` }), { headers: H });
  const login = http.post(`${BASE}/auth/login`,
    JSON.stringify({ username: u, password: "setup123" }), { headers: H });
  const token = login.json("access_token");

  // Get a real book ID from the API
  const books = http.get(`${BASE}/books?limit=10`).json("data");
  const bookId = books[0].id;

  return { token, bookId };  // passed to every VU as `data`
}

export default function ({ token, bookId }) {
  group("Post a review", () => {
    const rating = Math.ceil(Math.random() * 5);
    const res = http.post(`${BASE}/reviews`,
      JSON.stringify({ book_id: bookId, rating, comment: `Great read! Rating: ${rating}/5 from VU ${__VU}` }),
      { headers: authH(token) });
    check(res, {
      "review 201": (r) => r.status === 201,
      "rating matches": (r) => r.json("rating") === rating,
    });
  });

  sleep(0.5);

  group("Read reviews for book", () => {
    const res = http.get(`${BASE}/reviews?book_id=${bookId}`);
    check(res, {
      "reviews 200": (r) => r.status === 200,
      "reviews present": (r) => r.json("total") >= 0,
    });
  });

  group("All reviews (no filter)", () => {
    const res = http.get(`${BASE}/reviews`);
    check(res, { "reviews 200": (r) => r.status === 200 });
  });

  sleep(1);
}

// ── teardown(): runs ONCE after all VUs finish ───────────────────────────────
export function teardown(data) {
  console.log(`Test done. Used book ID: ${data.bookId}`);
  // In a real scenario, you'd clean up created data here
}
