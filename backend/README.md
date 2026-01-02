# IşıkSchedule Backend

Enterprise-grade course scheduling API powered by FastAPI.

## Tech Stack
- **FastAPI** - Async API framework
- **PostgreSQL** - Primary database
- **Redis** - Caching & job queue
- **Celery** - Background task processing
- **SQLAlchemy** - ORM

## Quick Start

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env

# Run development server
uvicorn app.main:app --reload
```

## Project Structure
```
backend/
├── app/
│   ├── main.py          # FastAPI application
│   ├── config.py        # Settings
│   ├── api/routes/      # API endpoints
│   ├── core/            # Business logic (from PyQt6)
│   ├── algorithms/      # Scheduling algorithms
│   ├── services/        # Service layer
│   ├── tasks/           # Celery tasks
│   └── db/              # Database models
├── tests/               # Test suite
├── requirements.txt
└── Dockerfile
```

## API Documentation
Available at `/docs` (Swagger) or `/redoc` when running.
