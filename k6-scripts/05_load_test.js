// ─────────────────────────────────────────────────────────────────────────────
// 05_load_test.js  —  Load Test with Stages
// Purpose : Ramp up to 50 VUs, hold, then ramp down. Classic load test shape.
// Run     : k6 run 05_load_test.js
// ─────────────────────────────────────────────────────────────────────────────
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 },   // ramp up
    { duration: "1m",  target: 50 },   // ramp to peak
    { duration: "30s", target: 50 },   // hold peak
    { duration: "20s", target: 0  },   // ramp down
  ],
  thresholds: {
    http_req_failed:   ["rate<0.02"],         // error rate < 2%
    http_req_duration: ["p(90)<500", "p(99)<1500"],  // latency SLOs
  },
};

const BASE = "http://localhost:8000";

export default function () {
  // Mix of read-heavy traffic (realistic ratio)
  const scenario = Math.random();

  if (scenario < 0.6) {
    // 60%: list books (most common operation)
    const page = Math.ceil(Math.random() * 3);
    http.get(`${BASE}/books?page=${page}&limit=5`);
  } else if (scenario < 0.85) {
    // 25%: get individual book
    const list = http.get(`${BASE}/books?limit=10`).json("data");
    if (list && list.length > 0) {
      const book = list[Math.floor(Math.random() * list.length)];
      http.get(`${BASE}/books/${book.id}`);
    }
  } else if (scenario < 0.95) {
    // 10%: reviews
    http.get(`${BASE}/reviews`);
  } else {
    // 5%: health check
    http.get(`${BASE}/`);
  }

  sleep(Math.random() * 1 + 0.5); // think time 0.5–1.5s
}
