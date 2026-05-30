from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List
import uuid, time, random, hashlib, json
from datetime import datetime

app = FastAPI(
    title="K6 Bookstore API",
    description="A local REST API for learning and testing with k6. Covers auth, CRUD, pagination, errors, and more.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory store ──────────────────────────────────────────────────────────
USERS: dict = {}          # token -> user dict
BOOKS: dict = {}          # id -> book dict
ORDERS: dict = {}         # id -> order dict
REVIEWS: dict = {}        # id -> review dict

# ── Seed data ────────────────────────────────────────────────────────────────
SEED_BOOKS = [
    {"title": "The Pragmatic Programmer",  "author": "David Thomas",         "genre": "Technology", "price": 49.99, "stock": 25},
    {"title": "Clean Code",                "author": "Robert Martin",         "genre": "Technology", "price": 44.99, "stock": 18},
    {"title": "Dune",                      "author": "Frank Herbert",         "genre": "Sci-Fi",     "price": 14.99, "stock": 40},
    {"title": "1984",                      "author": "George Orwell",         "genre": "Dystopian",  "price": 11.99, "stock": 60},
    {"title": "The Hitchhiker's Guide",    "author": "Douglas Adams",         "genre": "Sci-Fi",     "price": 12.99, "stock": 35},
    {"title": "Sapiens",                   "author": "Yuval Harari",          "genre": "History",    "price": 18.99, "stock": 22},
    {"title": "Atomic Habits",             "author": "James Clear",           "genre": "Self-Help",  "price": 16.99, "stock": 50},
    {"title": "The Great Gatsby",          "author": "F. Scott Fitzgerald",   "genre": "Fiction",    "price":  9.99, "stock": 70},
    {"title": "Thinking, Fast and Slow",   "author": "Daniel Kahneman",       "genre": "Psychology", "price": 19.99, "stock": 15},
    {"title": "Deep Work",                 "author": "Cal Newport",           "genre": "Self-Help",  "price": 17.99, "stock": 30},
    {"title": "The Design of Everyday Things", "author": "Don Norman",        "genre": "Technology", "price": 21.99, "stock": 12},
    {"title": "Ender's Game",              "author": "Orson Scott Card",      "genre": "Sci-Fi",     "price": 13.99, "stock": 45},
    {"title": "Brave New World",           "author": "Aldous Huxley",         "genre": "Dystopian",  "price": 10.99, "stock": 55},
    {"title": "A Brief History of Time",   "author": "Stephen Hawking",       "genre": "Science",    "price": 15.99, "stock": 28},
    {"title": "The Lean Startup",          "author": "Eric Ries",             "genre": "Business",   "price": 22.99, "stock": 33},
    {"title": "Zero to One",               "author": "Peter Thiel",           "genre": "Business",   "price": 20.99, "stock": 20},
    {"title": "Meditations",               "author": "Marcus Aurelius",       "genre": "Philosophy", "price":  8.99, "stock": 80},
    {"title": "The Power of Now",          "author": "Eckhart Tolle",         "genre": "Self-Help",  "price": 14.49, "stock": 42},
    {"title": "Thinking in Systems",       "author": "Donella Meadows",       "genre": "Science",    "price": 18.49, "stock": 16},
    {"title": "The Alchemist",             "author": "Paulo Coelho",          "genre": "Fiction",    "price": 11.49, "stock": 65},
]

SEED_USERS = [
    {"username": "alice",   "password": "alice123",   "email": "alice@bookstore.io"},
    {"username": "bob",     "password": "bob12345",   "email": "bob@bookstore.io"},
    {"username": "charlie", "password": "charlie123", "email": "charlie@bookstore.io"},
    {"username": "diana",   "password": "diana1234",  "email": "diana@bookstore.io"},
    {"username": "eve",     "password": "eve12345",   "email": "eve@bookstore.io"},
]

SEED_REVIEWS = [
    # (username, book_title_fragment, rating, comment)
    ("alice",   "Pragmatic",   5, "Changed how I think about software craftsmanship. A must-read for every developer."),
    ("alice",   "Clean Code",  4, "Great principles, some examples feel a bit dated but the core ideas are timeless."),
    ("alice",   "Atomic",      5, "Completely transformed my daily habits. Tiny changes, remarkable results!"),
    ("bob",     "Dune",        5, "An absolute masterpiece of world-building. Can't believe I waited so long to read it."),
    ("bob",     "1984",        5, "Chillingly relevant. Orwell was decades ahead of his time."),
    ("bob",     "Pragmatic",   5, "Every chapter has something actionable. My most annotated book."),
    ("charlie", "Hitchhiker",  5, "Hilarious and surprisingly philosophical. Read it in one sitting."),
    ("charlie", "Sapiens",     4, "Ambitious scope, fascinating narrative. A few stretches but overall brilliant."),
    ("charlie", "Deep Work",   4, "Newport's arguments are compelling. The scheduling advice alone is worth it."),
    ("diana",   "Atomic",      5, "The best productivity book I've read. So practical, not preachy at all."),
    ("diana",   "Gatsby",      3, "Beautifully written but I found the characters hard to root for. Still worth it."),
    ("diana",   "Thinking",    5, "Kahneman's research is eye-opening. You'll never trust your intuition blindly again."),
    ("eve",     "1984",        5, "Terrifying and essential. Read alongside Brave New World for full effect."),
    ("eve",     "Meditations", 5, "Two thousand years old and more useful than most modern self-help. Remarkable."),
    ("eve",     "Lean Startup",4, "Required reading for anyone building a product. The pivot concept alone is gold."),
    ("alice",   "Alchemist",   4, "A beautiful fable. Short but lingers with you for a long time."),
    ("bob",     "Zero to One", 4, "Contrarian and thought-provoking. Not everything lands but Thiel makes you think."),
    ("charlie", "Brief History",5,"Hawking makes the incomprehensible feel within reach. Astonishing book."),
    ("diana",   "Power of Now",3, "Some great moments of clarity buried under repetitive prose. Worth skimming."),
    ("eve",     "Deep Work",   5, "Implemented his time-blocking system immediately. Productivity doubled in a week."),
]

def _seed():
    # ── Books ────────────────────────────────────────────────────────────────
    book_id_map: dict = {}   # title_fragment -> id
    for b in SEED_BOOKS:
        bid = str(uuid.uuid4())
        BOOKS[bid] = {**b, "id": bid, "created_at": "2026-01-10T09:00:00"}
        book_id_map[b["title"]] = bid

    # ── Users ────────────────────────────────────────────────────────────────
    user_token_map: dict = {}   # username -> token
    user_id_map: dict   = {}    # username -> id
    for u in SEED_USERS:
        uid   = str(uuid.uuid4())
        token = hashlib.sha256(f"seed_{u['username']}".encode()).hexdigest()[:32]
        user  = {
            "id": uid,
            "username": u["username"],
            "email": u["email"],
            "password_hash": hashlib.sha256(u["password"].encode()).hexdigest(),
            "created_at": "2026-01-11T08:00:00",
        }
        USERS[f"__user__{uid}"] = user   # lookup by username/password
        USERS[token] = user              # lookup by token
        user_token_map[u["username"]] = token
        user_id_map[u["username"]]   = uid

    # ── Orders (2–3 per user) ────────────────────────────────────────────────
    order_data = [
        ("alice",   "Clean Code",          2, "2026-02-03T14:22:00"),
        ("alice",   "Atomic Habits",       1, "2026-03-15T10:05:00"),
        ("bob",     "Dune",                1, "2026-02-10T16:40:00"),
        ("bob",     "1984",                2, "2026-03-01T11:30:00"),
        ("charlie", "The Hitchhiker's Guide", 1, "2026-02-20T09:15:00"),
        ("charlie", "Deep Work",           1, "2026-04-05T18:00:00"),
        ("diana",   "Atomic Habits",       3, "2026-02-14T12:00:00"),
        ("diana",   "Thinking, Fast and Slow", 1, "2026-03-22T15:45:00"),
        ("eve",     "Meditations",         2, "2026-01-28T08:30:00"),
        ("eve",     "1984",                1, "2026-04-10T20:00:00"),
        ("alice",   "The Alchemist",       1, "2026-04-18T13:10:00"),
        ("bob",     "Zero to One",         1, "2026-04-22T09:50:00"),
    ]
    for username, title_fragment, qty, created_at in order_data:
        book = next((b for b in BOOKS.values() if title_fragment in b["title"]), None)
        if not book:
            continue
        oid = str(uuid.uuid4())
        ORDERS[oid] = {
            "id": oid,
            "user_id": user_id_map[username],
            "book_id": book["id"],
            "book_title": book["title"],
            "quantity": qty,
            "total_price": round(book["price"] * qty, 2),
            "status": "confirmed",
            "created_at": created_at,
        }
        # Deduct stock (but don't go negative)
        BOOKS[book["id"]]["stock"] = max(0, BOOKS[book["id"]]["stock"] - qty)

    # ── Reviews ──────────────────────────────────────────────────────────────
    for username, title_fragment, rating, comment in SEED_REVIEWS:
        book = next((b for b in BOOKS.values() if title_fragment in b["title"]), None)
        if not book:
            continue
        rid = str(uuid.uuid4())
        REVIEWS[rid] = {
            "id": rid,
            "user_id": user_id_map[username],
            "username": username,
            "book_id": book["id"],
            "book_title": book["title"],
            "rating": rating,
            "comment": comment,
            "created_at": "2026-02-01T10:00:00",
        }

_seed()

# ── Helpers ──────────────────────────────────────────────────────────────────
def _token() -> str:
    return hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()[:32]

def _get_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    user = USERS.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user

# ── Models ───────────────────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=6)
    email: str

class LoginIn(BaseModel):
    username: str
    password: str

class BookIn(BaseModel):
    title: str
    author: str
    genre: str
    price: float = Field(..., gt=0)
    stock: int = Field(..., ge=0)

class OrderIn(BaseModel):
    book_id: str
    quantity: int = Field(..., ge=1)

class ReviewIn(BaseModel):
    book_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(..., min_length=5, max_length=500)

# ════════════════════════════════════════════════════════════════════════════
# 1. GET /  — health check / root
# ════════════════════════════════════════════════════════════════════════════
@app.get("/", tags=["Info"])
def root():
    """Health-check endpoint. Great for smoke tests."""
    return {
        "status": "ok",
        "service": "K6 Bookstore API",
        "version": "1.0.0",
        "docs": "http://localhost:8000/docs",
        "seed_users": [
            {"username": "alice",   "password": "alice123"},
            {"username": "bob",     "password": "bob12345"},
            {"username": "charlie", "password": "charlie123"},
            {"username": "diana",   "password": "diana1234"},
            {"username": "eve",     "password": "eve12345"},
        ],
        "endpoints": [
            "GET  /",
            "POST /auth/register",
            "POST /auth/login",
            "GET  /books",
            "GET  /books/{id}",
            "POST /books          (auth)",
            "PUT  /books/{id}     (auth)",
            "DELETE /books/{id}   (auth)",
            "POST /orders         (auth)",
            "GET  /orders         (auth)",
            "POST /reviews        (auth)",
            "GET  /reviews?book_id=",
            "GET  /slow           (latency sim)",
            "GET  /error/{code}   (error sim)",
        ]
    }

# ════════════════════════════════════════════════════════════════════════════
# 2. POST /auth/register
# ════════════════════════════════════════════════════════════════════════════
@app.post("/auth/register", status_code=201, tags=["Auth"])
def register(body: RegisterIn):
    """Register a new user. Returns user info (no token yet)."""
    for u in USERS.values():
        if u["username"] == body.username:
            raise HTTPException(status_code=409, detail="Username already taken")
    uid = str(uuid.uuid4())
    user = {
        "id": uid,
        "username": body.username,
        "email": body.email,
        "password_hash": hashlib.sha256(body.password.encode()).hexdigest(),
        "created_at": datetime.utcnow().isoformat(),
    }
    # store under a placeholder key so we can look up by username
    USERS[f"__user__{uid}"] = user
    return {"id": uid, "username": body.username, "email": body.email}

# ════════════════════════════════════════════════════════════════════════════
# 3. POST /auth/login
# ════════════════════════════════════════════════════════════════════════════
@app.post("/auth/login", tags=["Auth"])
def login(body: LoginIn):
    """Login and receive a Bearer token."""
    phash = hashlib.sha256(body.password.encode()).hexdigest()
    user = None
    for u in USERS.values():
        if u.get("username") == body.username and u.get("password_hash") == phash:
            user = u; break
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _token()
    USERS[token] = user  # also index by token
    return {"access_token": token, "token_type": "bearer", "user_id": user["id"]}

# ════════════════════════════════════════════════════════════════════════════
# 4. GET /books  — list with pagination + filtering
# ════════════════════════════════════════════════════════════════════════════
@app.get("/books", tags=["Books"])
def list_books(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    genre: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
):
    """List books with pagination and optional filters. No auth required."""
    items = list(BOOKS.values())
    if genre:
        items = [b for b in items if b["genre"].lower() == genre.lower()]
    if min_price is not None:
        items = [b for b in items if b["price"] >= min_price]
    if max_price is not None:
        items = [b for b in items if b["price"] <= max_price]
    total = len(items)
    start = (page - 1) * limit
    end = start + limit
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),
        "data": items[start:end],
    }

# ════════════════════════════════════════════════════════════════════════════
# 5. GET /books/{id}
# ════════════════════════════════════════════════════════════════════════════
@app.get("/books/{book_id}", tags=["Books"])
def get_book(book_id: str):
    """Fetch a single book by ID."""
    book = BOOKS.get(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

# ════════════════════════════════════════════════════════════════════════════
# 6. POST /books  (auth required)
# ════════════════════════════════════════════════════════════════════════════
@app.post("/books", status_code=201, tags=["Books"])
def create_book(body: BookIn, user=Depends(_get_user)):
    """Create a new book. Requires authentication."""
    bid = str(uuid.uuid4())
    book = {**body.dict(), "id": bid, "created_by": user["id"], "created_at": datetime.utcnow().isoformat()}
    BOOKS[bid] = book
    return book

# ════════════════════════════════════════════════════════════════════════════
# 7. PUT /books/{id}  (auth required)
# ════════════════════════════════════════════════════════════════════════════
@app.put("/books/{book_id}", tags=["Books"])
def update_book(book_id: str, body: BookIn, user=Depends(_get_user)):
    """Update an existing book. Requires authentication."""
    if book_id not in BOOKS:
        raise HTTPException(status_code=404, detail="Book not found")
    BOOKS[book_id].update({**body.dict(), "updated_at": datetime.utcnow().isoformat()})
    return BOOKS[book_id]

# ════════════════════════════════════════════════════════════════════════════
# 8. DELETE /books/{id}  (auth required)
# ════════════════════════════════════════════════════════════════════════════
@app.delete("/books/{book_id}", status_code=204, tags=["Books"])
def delete_book(book_id: str, user=Depends(_get_user)):
    """Delete a book. Requires authentication."""
    if book_id not in BOOKS:
        raise HTTPException(status_code=404, detail="Book not found")
    del BOOKS[book_id]

# ════════════════════════════════════════════════════════════════════════════
# 9. POST /orders  (auth required)
# ════════════════════════════════════════════════════════════════════════════
@app.post("/orders", status_code=201, tags=["Orders"])
def place_order(body: OrderIn, user=Depends(_get_user)):
    """Place an order for a book. Decrements stock."""
    book = BOOKS.get(body.book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book["stock"] < body.quantity:
        raise HTTPException(status_code=422, detail=f"Insufficient stock. Available: {book['stock']}")
    BOOKS[body.book_id]["stock"] -= body.quantity
    oid = str(uuid.uuid4())
    order = {
        "id": oid,
        "user_id": user["id"],
        "book_id": body.book_id,
        "book_title": book["title"],
        "quantity": body.quantity,
        "total_price": round(book["price"] * body.quantity, 2),
        "status": "confirmed",
        "created_at": datetime.utcnow().isoformat(),
    }
    ORDERS[oid] = order
    return order

# ════════════════════════════════════════════════════════════════════════════
# 10. GET /orders  (auth required)
# ════════════════════════════════════════════════════════════════════════════
@app.get("/orders", tags=["Orders"])
def list_orders(user=Depends(_get_user)):
    """List all orders for the authenticated user."""
    user_orders = [o for o in ORDERS.values() if o["user_id"] == user["id"]]
    return {"total": len(user_orders), "data": user_orders}

# ════════════════════════════════════════════════════════════════════════════
# 11. POST /reviews  (auth required)
# ════════════════════════════════════════════════════════════════════════════
@app.post("/reviews", status_code=201, tags=["Reviews"])
def add_review(body: ReviewIn, user=Depends(_get_user)):
    """Add a review for a book. Requires authentication."""
    if body.book_id not in BOOKS:
        raise HTTPException(status_code=404, detail="Book not found")
    rid = str(uuid.uuid4())
    review = {
        "id": rid,
        "user_id": user["id"],
        **body.dict(),
        "created_at": datetime.utcnow().isoformat(),
    }
    REVIEWS[rid] = review
    return review

# ════════════════════════════════════════════════════════════════════════════
# 12. GET /reviews?book_id=  (public)
# ════════════════════════════════════════════════════════════════════════════
@app.get("/reviews", tags=["Reviews"])
def list_reviews(book_id: Optional[str] = None):
    """List reviews. Filter by book_id optionally."""
    items = list(REVIEWS.values())
    if book_id:
        items = [r for r in items if r["book_id"] == book_id]
    return {"total": len(items), "data": items}

# ════════════════════════════════════════════════════════════════════════════
# 13. GET /slow  — variable latency simulation
# ════════════════════════════════════════════════════════════════════════════
@app.get("/slow", tags=["Testing Utilities"])
def slow_endpoint(delay_ms: int = Query(500, ge=0, le=5000)):
    """
    Simulates a slow endpoint. Use `delay_ms` (0–5000) to control latency.
    Great for testing k6 thresholds on response time.
    """
    time.sleep(delay_ms / 1000)
    return {"message": "Response after delay", "delay_ms": delay_ms, "timestamp": datetime.utcnow().isoformat()}

# ════════════════════════════════════════════════════════════════════════════
# 14. GET /error/{code}  — error simulation
# ════════════════════════════════════════════════════════════════════════════
SUPPORTED_ERRORS = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
}

@app.get("/error/{code}", tags=["Testing Utilities"])
def trigger_error(code: int):
    """
    Returns any HTTP error code you specify.
    Supported: 400, 401, 403, 404, 429, 500, 502, 503.
    Perfect for testing k6 error-rate checks.
    """
    if code not in SUPPORTED_ERRORS:
        raise HTTPException(status_code=400, detail=f"Unsupported error code. Choose from: {list(SUPPORTED_ERRORS.keys())}")
    raise HTTPException(status_code=code, detail=SUPPORTED_ERRORS[code])
