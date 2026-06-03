from __future__ import annotations

import argparse
import json
import mimetypes
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DEFAULT_DB = ROOT / "flowers.db"
SEED_FILE = ROOT / "seed-data.json"

SCHEMA = """
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  agreement TEXT
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS flowers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  supplier_id TEXT NOT NULL,
  stock INTEGER NOT NULL,
  threshold INTEGER NOT NULL,
  unit TEXT NOT NULL,
  status TEXT NOT NULL,
  theme TEXT,
  description TEXT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  preference TEXT,
  level TEXT,
  notes TEXT,
  joined_at TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  shipped_at TEXT,
  delivered_at TEXT,
  cancelled_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  flower_id TEXT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS inventory_logs (
  id TEXT PRIMARY KEY,
  flower_id TEXT,
  flower_name TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  note TEXT,
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  resolved INTEGER NOT NULL DEFAULT 0,
  ref TEXT
);
"""


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def initialize_database(db_path: Path) -> None:
    with connect(db_path) as conn:
        conn.executescript(SCHEMA)
        total_rows = sum(
            conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in ("suppliers", "flowers", "customers", "orders")
        )
    if total_rows == 0 and SEED_FILE.exists():
        write_snapshot(db_path, json.loads(SEED_FILE.read_text(encoding="utf-8")))


def rows(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> list[dict]:
    return [dict(row) for row in conn.execute(sql, params).fetchall()]


def read_snapshot(db_path: Path) -> dict:
    with connect(db_path) as conn:
        suppliers = rows(conn, "SELECT * FROM suppliers ORDER BY id")
        payments = rows(conn, "SELECT supplier_id, date, amount, status FROM supplier_payments ORDER BY id")
        payments_by_supplier: dict[str, list[dict]] = {}
        for payment in payments:
            supplier_id = payment.pop("supplier_id")
            payments_by_supplier.setdefault(supplier_id, []).append(payment)
        for supplier in suppliers:
            supplier["paymentRecords"] = payments_by_supplier.get(supplier["id"], [])

        orders = rows(conn, "SELECT * FROM orders ORDER BY created_at DESC")
        items = rows(conn, "SELECT order_id, flower_id, name, price, quantity FROM order_items ORDER BY id")
        items_by_order: dict[str, list[dict]] = {}
        for item in items:
            order_id = item.pop("order_id")
            item["flowerId"] = item.pop("flower_id")
            items_by_order.setdefault(order_id, []).append(item)
        for order in orders:
            order["customerId"] = order.pop("customer_id")
            order["customerName"] = order.pop("customer_name")
            order["createdAt"] = order.pop("created_at")
            order["paidAt"] = order.pop("paid_at") or ""
            order["shippedAt"] = order.pop("shipped_at") or ""
            order["deliveredAt"] = order.pop("delivered_at") or ""
            order["cancelledAt"] = order.pop("cancelled_at") or ""
            order["items"] = items_by_order.get(order["id"], [])

        flowers = rows(
            conn,
            """
            SELECT id, name, sku, category, price, supplier_id, stock, threshold, unit, status, theme, description
            FROM flowers ORDER BY id
            """,
        )
        for flower in flowers:
            flower["supplierId"] = flower.pop("supplier_id")

        customers = rows(conn, "SELECT * FROM customers ORDER BY id")
        for customer in customers:
            customer["joinedAt"] = customer.pop("joined_at") or ""

        inventory_logs = rows(conn, "SELECT * FROM inventory_logs ORDER BY date DESC")
        for log in inventory_logs:
            log["flowerId"] = log.pop("flower_id")
            log["flowerName"] = log.pop("flower_name")

        notifications = rows(conn, "SELECT * FROM notifications ORDER BY created_at DESC")
        for notice in notifications:
            notice["createdAt"] = notice.pop("created_at")
            notice["read"] = bool(notice["read"])
            notice["resolved"] = bool(notice["resolved"])

        return {
            "suppliers": suppliers,
            "flowers": flowers,
            "customers": customers,
            "orders": orders,
            "inventoryLogs": inventory_logs,
            "notifications": notifications,
        }


def write_snapshot(db_path: Path, data: dict) -> None:
    with connect(db_path) as conn:
        conn.execute("BEGIN")
        try:
            for table in [
                "supplier_payments",
                "order_items",
                "inventory_logs",
                "notifications",
                "orders",
                "flowers",
                "customers",
                "suppliers",
            ]:
                conn.execute(f"DELETE FROM {table}")

            for supplier in data.get("suppliers", []):
                conn.execute(
                    """
                    INSERT INTO suppliers (id, name, contact, phone, email, agreement)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        supplier.get("id"),
                        supplier.get("name", ""),
                        supplier.get("contact", ""),
                        supplier.get("phone", ""),
                        supplier.get("email", ""),
                        supplier.get("agreement", ""),
                    ),
                )
                for payment in supplier.get("paymentRecords", []):
                    conn.execute(
                        """
                        INSERT INTO supplier_payments (supplier_id, date, amount, status)
                        VALUES (?, ?, ?, ?)
                        """,
                        (
                            supplier.get("id"),
                            payment.get("date", ""),
                            float(payment.get("amount") or 0),
                            payment.get("status", ""),
                        ),
                    )

            for customer in data.get("customers", []):
                conn.execute(
                    """
                    INSERT INTO customers (id, name, phone, email, address, preference, level, notes, joined_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        customer.get("id"),
                        customer.get("name", ""),
                        customer.get("phone", ""),
                        customer.get("email", ""),
                        customer.get("address", ""),
                        customer.get("preference", ""),
                        customer.get("level", ""),
                        customer.get("notes", ""),
                        customer.get("joinedAt", ""),
                    ),
                )

            for flower in data.get("flowers", []):
                conn.execute(
                    """
                    INSERT INTO flowers (id, name, sku, category, price, supplier_id, stock, threshold, unit, status, theme, description)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        flower.get("id"),
                        flower.get("name", ""),
                        flower.get("sku", ""),
                        flower.get("category", ""),
                        float(flower.get("price") or 0),
                        flower.get("supplierId", ""),
                        int(flower.get("stock") or 0),
                        int(flower.get("threshold") or 0),
                        flower.get("unit", ""),
                        flower.get("status", ""),
                        flower.get("theme", ""),
                        flower.get("description", ""),
                    ),
                )

            for order in data.get("orders", []):
                conn.execute(
                    """
                    INSERT INTO orders (id, customer_id, customer_name, total, status, created_at, paid_at, shipped_at, delivered_at, cancelled_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        order.get("id"),
                        order.get("customerId", ""),
                        order.get("customerName", ""),
                        float(order.get("total") or 0),
                        order.get("status", ""),
                        order.get("createdAt", ""),
                        order.get("paidAt", ""),
                        order.get("shippedAt", ""),
                        order.get("deliveredAt", ""),
                        order.get("cancelledAt", ""),
                    ),
                )
                for item in order.get("items", []):
                    conn.execute(
                        """
                        INSERT INTO order_items (order_id, flower_id, name, price, quantity)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (
                            order.get("id"),
                            item.get("flowerId"),
                            item.get("name", ""),
                            float(item.get("price") or 0),
                            int(item.get("quantity") or 0),
                        ),
                    )

            for log in data.get("inventoryLogs", []):
                conn.execute(
                    """
                    INSERT INTO inventory_logs (id, flower_id, flower_name, type, quantity, note, date)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        log.get("id"),
                        log.get("flowerId"),
                        log.get("flowerName", ""),
                        log.get("type", ""),
                        int(log.get("quantity") or 0),
                        log.get("note", ""),
                        log.get("date", ""),
                    ),
                )

            for notice in data.get("notifications", []):
                conn.execute(
                    """
                    INSERT INTO notifications (id, type, title, message, created_at, read, resolved, ref)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        notice.get("id"),
                        notice.get("type", ""),
                        notice.get("title", ""),
                        notice.get("message", ""),
                        notice.get("createdAt", ""),
                        1 if notice.get("read") else 0,
                        1 if notice.get("resolved") else 0,
                        notice.get("ref", ""),
                    ),
                )
            conn.commit()
        except Exception:
            conn.rollback()
            raise


class FlowerHandler(SimpleHTTPRequestHandler):
    db_path = DEFAULT_DB

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            self.send_json({"ok": True, "database": str(self.db_path)})
            return
        if path == "/api/data":
            self.send_json(read_snapshot(self.db_path))
            return
        self.serve_static(path)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/data":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            write_snapshot(self.db_path, data)
            self.send_json({"ok": True})
        except Exception as exc:
            self.send_json({"ok": False, "error": str(exc)}, status=500)

    def serve_static(self, path: str) -> None:
        if path == "/":
            path = "/index.html"
        target = (ROOT / path.lstrip("/")).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            self.send_error(403)
            return
        if not target.exists() or not target.is_file():
            self.send_error(404)
            return
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Flower management system local server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    args = parser.parse_args()

    db_path = args.db.resolve()
    initialize_database(db_path)
    FlowerHandler.db_path = db_path

    server = ThreadingHTTPServer((args.host, args.port), FlowerHandler)
    print(f"Flower management system: http://{args.host}:{args.port}")
    print(f"SQLite database: {db_path}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == "__main__":
    main()
