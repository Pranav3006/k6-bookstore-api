// ─────────────────────────────────────────────────────────────────────────────
// 10_stress_test.js  —  Stress Test (push until it breaks)
// Purpose : Find the API's breaking point with aggressive ramp-up
// Run     : k6 run 10_stress_test.js
// NOTE    : Expects some threshold failures — that's the point!
// ─────────────────────────────────────────────────────────────────────────────
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "20s", target: 20  },
    { duration: "30s", target: 80  },
    { duration: "30s", target: 150 },  // ← stress zone
    { duration: "20s", target: 0   },  // recovery
  ],
  thresholds: {
    // We accept higher error rates under stress
    http_req_failed: ["rate<0.10"],          // tolerate up to 10% errors
    http_req_duration: ["p(90)<2000"],       // 90% under 2s
  },
};

const BASE = "http://localhost:8000";

export default function () {
  const r = Math.random();

  if (r < 0.5) {
    http.get(`${BASE}/books?page=${Math.ceil(Math.random() * 5)}&limit=5`);
  } else if (r < 0.75) {
    http.get(`${BASE}/`);
  } else if (r < 0.9) {
    // Simulate slow response under load
    http.get(`${BASE}/slow?delay_ms=100`);
  } else {
    http.get(`${BASE}/reviews`);
  }

  // Check response — don't assert status so the test continues even with errors
  sleep(Math.random() * 0.5);
}
