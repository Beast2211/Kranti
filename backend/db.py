"""MongoDB connection (motor) shared across the backend."""
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Collections
users = db.users
members = db.members
payments = db.vargani_payments
expenses = db.expenses
events = db.events
notifications = db.notifications
audit_logs = db.audit_logs
password_resets = db.password_resets
