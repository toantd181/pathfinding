# 🗺️ PathFinder - Advanced Route Planning Application

A modern pathfinding application built with OpenStreetMap data, A* algorithm, and intelligent caching.

## Features

- 🗺️ **Interactive Maps**: Built with Leaflet and OpenStreetMap
- 🧠 **A* Algorithm**: Efficient pathfinding with geographic heuristics
- ⚡ **Smart Caching**: Pre-calculated routes for optimal performance
- 📱 **Mobile-First**: Responsive PWA design
- 🔄 **Real-time**: Live route updates and alternatives
- 💾 **Offline**: Works without internet connection

## Project Structure

```
pathfinding-project/
├── backend/          # Flask API server
├── frontend/         # React web application
├── mobile/          # React Native app (optional)
├── docs/            # Documentation
└── deployment/      # Deployment configs
```

## Quick Start

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python app.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

Visit http://localhost:3000 to see the application.

## Development Status

✅ **Part 1**: Project Structure & Environment Setup
⏳ **Part 2**: Core Data Structures
⏳ **Part 3**: OSM Data Parser
⏳ **Part 4**: A* Algorithm Implementation

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/info` - API information
- `POST /api/route` - Calculate route (coming soon)
- `GET /api/geocode` - Address lookup (coming soon)

## Technology Stack

### Backend
- Python 3.8+
- Flask
- SQLAlchemy
- Redis (caching)
- OpenStreetMap data

### Frontend
- React 18
- TypeScript
- Tailwind CSS
- Leaflet.js
- PWA capabilities

## Contributing

This project is built part-by-part following a structured roadmap. Each part is self-contained and thoroughly tested.

## License

MIT License - feel free to use for learning and projects!
