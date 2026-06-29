# IşıkSchedule

🎓 Enterprise-grade course scheduling platform for universities.

## Features

- 📊 Upload Excel course schedules
- 🧠 Multiple scheduling algorithms (DFS, BFS, A*, Genetic, etc.)
- 📱 Fully responsive design
- 📤 Export to PDF, iCal
- 🔗 Shareable schedule links

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | FastAPI, Python 3.12 |
| Frontend | Next.js 16, React 19, TailwindCSS |
| Database | SQLite |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20.9+ (for local frontend dev)
- Python 3.12+ (for local backend dev)

### Development with Docker

```bash
# Clone repository
git clone https://github.com/yourusername/isikschedule.git
cd isikschedule

# Start all services
docker-compose up -d

# Access
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
```

### Local Development

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Project Structure

```
isikschedule/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/       # API routes
│   │   ├── core/      # Business logic
│   │   ├── algorithms # Scheduling algorithms
│   │   └── tests/
├── frontend/          # Next.js frontend
│   ├── app/
│   ├── components/
│   └── lib/
└── docker-compose.yml
```

## License

MIT License - See [LICENSE](LICENSE) for details.
