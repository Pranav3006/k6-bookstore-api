# 📚 K6 Bookstore API — Local Learning API

A self-contained REST API built specifically for learning and testing with **k6**.
Runs locally via Docker in seconds. No internet required, no rate limits, no auth tokens to manage externally.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 2. Start the API
```bash
docker compose up -d
```
> First run takes ~1–2 minutes to build. Subsequent starts are instant.

### 3. Verify it's running
Open **http://localhost:8000/** in your browser  
Or: `curl http://localhost:8000/`

### 4. View interactive docs
Open **http://localhost:8000/docs** — full Swagger UI

### 5. Stop the API
```bash
docker compose down
```

---

## 🗺️ API Endpoints

| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 1 | GET | `/` | No | Health check, endpoint list |
| 2 | POST | `/auth/register` | No | Create a new user account |
| 3 | POST | `/auth/login` | No | Login, receive Bearer token |
| 4 | GET | `/books` | No | List books (pagination + filters) |
| 5 | GET | `/books/{id}` | No | Get a single book |
| 6 | POST | `/books` | ✅ | Create a new book |
| 7 | PUT | `/books/{id}` | ✅ | Update a book |
| 8 | DELETE | `/books/{id}` | ✅ | Delete a book |
| 9 | POST | `/orders` | ✅ | Place an order (decrements stock) |
| 10 | GET | `/orders` | ✅ | List your orders |
| 11 | POST | `/reviews` | ✅ | Add a book review |
| 12 | GET | `/reviews` | No | List reviews (filter by book_id) |
| 13 | GET | `/slow` | No | Simulate latency (`?delay_ms=500`) |
| 14 | GET | `/error/{code}` | No | Trigger any HTTP error code |

### Query Params for `/books`
| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `page` | int | `?page=2` | Page number (default: 1) |
| `limit` | int | `?limit=10` | Results per page (default: 5, max: 50) |
| `genre` | string | `?genre=Sci-Fi` | Filter by genre |
| `min_price` | float | `?min_price=10` | Minimum price |
| `max_price` | float | `?max_price=30` | Maximum price |

### Supported Error Codes for `/error/{code}`
`400`, `401`, `403`, `404`, `429`, `500`, `502`, `503`

---

## 🧪 K6 Test Scripts

All scripts are in the `k6-scripts/` folder.

| Script | What You Learn |
|--------|---------------|
| `01_smoke_test.js` | Smoke test — basic assertions, minimal load |
| `02_auth_flow.js` | Register, login, use tokens, test 401s |
| `03_crud_books.js` | Full Create/Read/Update/Delete lifecycle |
| `04_pagination_and_filters.js` | Pagination, query params, response assertions |
| `05_load_test.js` | Ramping VUs, stages, thresholds |
| `06_order_flow.js` | Multi-step user journey, `group()` usage |
| `07_error_handling.js` | Checking non-2xx responses intentionally |
| `08_latency_thresholds.js` | Custom metrics (`Trend`), SLO thresholds |
| `09_reviews_with_setup.js` | `setup()` and `teardown()` lifecycle functions |
| `10_stress_test.js` | Aggressive ramp-up, finding breaking points |

### Run any script
```bash
k6 run k6-scripts/01_smoke_test.js
```

### Recommended learning order
```
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10
```

---

## 💡 Example: Quick Manual Test with curl

```bash
# Register
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"pass1234","email":"alice@k6.io"}'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"pass1234"}'

# Use the token from login response:
TOKEN="<paste token here>"

# List books
curl http://localhost:8000/books

# Place an order (get a book ID from the list above)
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"book_id":"<book-id>","quantity":1}'

# Test latency simulation
curl "http://localhost:8000/slow?delay_ms=500"

# Trigger a 500 error
curl http://localhost:8000/error/500
```

---

## 📦 Tech Stack
- **Python 3.11** + **FastAPI** — lightweight, async REST API
- **In-memory storage** — resets on restart (great for repeatable tests)
- **Docker** — zero dependencies on your host machine beyond Docker Desktop

---

## 🔄 Resetting Data
Since all data is in-memory, just restart the container:
```bash
docker compose restart
```
All orders, reviews, and user accounts are wiped. The 10 seed books come back fresh.
