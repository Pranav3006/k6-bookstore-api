// ─────────────────────────────────────────────────────────────────────────────
// 08_latency_thresholds.js  —  Response Time / SLO Testing
// Purpose : Use /slow?delay_ms= to understand k6 threshold failures
// Run     : k6 run 08_latency_thresholds.js
// ─────────────────────────────────────────────────────────────────────────────
import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend } from "k6/metrics";

// Custom metrics track each endpoint separately
const fastTrend = new Trend("fast_endpoint_duration");
const slowTrend = new Trend("slow_endpoint_duration");

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    // Fast endpoint SLO: p95 under 200ms
    fast_endpoint_duration: ["p(95)<200"],
    // Slow endpoint SLO (we expect it to be slow, so we're generous)
    slow_endpoint_duration: ["p(95)<2000"],
    // Overall error rate
    http_req_failed: ["rate<0.01"],
  },
};

const BASE = "http://localhost:8000";

export default function () {
  group("Fast endpoint (health check)", () => {
    const res = http.get(`${BASE}/`);
    fastTrend.add(res.timings.duration);
    check(res, {
      "200 OK": (r) => r.status === 200,
      "under 300ms": (r) => r.timings.duration < 300,
    });
  });

  sleep(0.5);

  group("Slow endpoint (300ms delay)", () => {
    const res = http.get(`${BASE}/slow?delay_ms=300`);
    slowTrend.add(res.timings.duration);
    check(res, {
      "200 OK": (r) => r.status === 200,
      "at least 300ms": (r) => r.timings.duration >= 300,
      "delay_ms in response": (r) => r.json("delay_ms") === 300,
    });
  });

  sleep(0.5);

  group("Variable latency", () => {
    // Randomise between 100–800ms to simulate real-world variance
    const delay = Math.floor(Math.random() * 700 + 100);
    const res = http.get(`${BASE}/slow?delay_ms=${delay}`);
    check(res, {
      "200 OK": (r) => r.status === 200,
    });
  });

  sleep(1);
}
