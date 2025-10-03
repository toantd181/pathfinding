# Hanoi Pathfinding Visualizer

A full-stack web application for finding and visualizing optimal routes in Hanoi, Vietnam using A* pathfinding algorithm on OpenStreetMap road network data.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![React](https://img.shields.io/badge/react-18.0+-61DAFB.svg)

## Features

- **Interactive Map Interface**: Click anywhere on the map to set start and end points
- **Real-time Pathfinding**: A* algorithm finds optimal routes on actual Hanoi streets
- **Visual Route Display**: See the complete route drawn on OpenStreetMap with turn-by-turn directions
- **Intelligent Caching**: Frequently used routes are cached for instant retrieval
- **POI Support**: Preloaded points of interest (landmarks, attractions) for quick selection
- **Route Analytics**: Distance, travel time, and waypoint information
- **Snap-to-Road**: Automatically finds nearest road node to any clicked location

## Architecture

```
pathfinding-project/
├── backend/          # Flask REST API
│   ├── src/
│   │   ├── algorithms/    # A* pathfinding implementation
│   │   ├── api/          # REST endpoints
│   │   ├── cache/        # Route caching system
│   │   ├── core/         # Graph data structures
│   │   ├── data/         # Data processing utilities
│   │   └── utils/        # Helper functions
│   ├── data/
│   │   ├── maps/         # Raw OSM data
│   │   ├── processed/    # Processed graph files (.pkl)
│   │   └── pois.json     # Points of interest
│   └── config/          # Configuration files
└── frontend/         # React application
    ├── src/
    │   ├── App.js        # Main map component
    │   ├── index.js      # Entry point
    │   └── index.css     # Global styles
    └── public/
        └── pois.json     # POI data for frontend
```

## Technology Stack

### Backend
- **Python 3.8+**: Core language
- **Flask**: Web framework
- **Flask-CORS**: Cross-origin resource sharing
- **NetworkX**: Graph algorithms (optional)
- **Geopy**: Geographic calculations
- **SQLite**: Route caching database
- **Pickle**: Graph serialization

### Frontend
- **React 18**: UI framework
- **Leaflet**: Interactive maps
- **React-Leaflet**: React bindings for Leaflet
- **Tailwind CSS**: Styling
- **Lucide React**: Icon library

## Installation

### Prerequisites
- Python 3.8 or higher
- Node.js 14 or higher
- npm or yarn

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables (optional)
cp .env.example .env
# Edit .env with your configurations
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Copy POI data
cp ../backend/data/pois.json public/
```

## Usage

### Start Backend Server

```bash
cd backend
python run_api.py
```

Server will start at `http://localhost:5000`

### Start Frontend Development Server

```bash
cd frontend
npm start
```

Application will open at `http://localhost:3000`

## API Documentation

### Endpoints

#### Health Check
```
GET /api/health
```
Returns server status

#### Get API Information
```
GET /api/info
```
Returns API details and available endpoints

#### Find Route by Coordinates
```
POST /api/route/coordinates
Content-Type: application/json

{
  "start": {
    "lat": 21.0285,
    "lon": 105.8542
  },
  "end": {
    "lat": 21.0047,
    "lon": 105.8438
  },
  "use_cache": true
}
```

Response:
```json
{
  "success": true,
  "route": {
    "path": [123, 456, 789],
    "coordinates": [
      {"lat": 21.0285, "lon": 105.8542},
      {"lat": 21.0290, "lon": 105.8545}
    ],
    "segments": [...],
    "summary": {
      "distance": 2500,
      "distance_km": 2.5,
      "travel_time": 300,
      "travel_time_minutes": 5,
      "nodes_count": 45
    },
    "start": {...},
    "end": {...},
    "cached": false,
    "calculation_time": 0.042
  }
}
```

#### Find Nearest Road Node
```
GET /api/node/nearest?lat=21.0285&lon=105.8542&max_distance=500
```

#### Get Statistics
```
GET /api/statistics
```

## Data Processing

### Processing OpenStreetMap Data

The project includes scripts to download and process OSM data:

```bash
cd backend

# Download OSM data for a specific area
python scripts/download_osm.py --area "Hanoi, Vietnam"

# Process OSM data into graph format
python scripts/process_osm.py --input data/maps/hanoi.osm --output data/processed/hanoi_main.pkl
```

### Graph Structure

The processed graph contains:
- **Nodes**: Road intersections and points with lat/lon coordinates
- **Edges**: Road segments with distance and estimated travel time
- **Attributes**: Road names, types, and other OSM tags

## Configuration

### Backend Configuration (`backend/config/hanoi_config.yaml`)

```yaml
map:
  center:
    latitude: 21.0285
    longitude: 105.8542
  districts:
    - Hoan Kiem
    - Ba Dinh
    - Dong Da
    # ...

cache:
  enabled: true
  database: data/cache/routes.db
  max_routes: 10000

pathfinding:
  algorithm: astar
  max_search_distance: 1000  # meters
```

### Frontend Configuration

Environment variables can be set in `.env`:

```
REACT_APP_API_URL=http://localhost:5000/api
```

## Performance

- **Route Calculation**: 20-100ms for typical routes
- **Cache Hit**: < 5ms for cached routes
- **Graph Size**: ~50,000 nodes, ~100,000 edges (Hanoi main)
- **Memory Usage**: ~200MB (backend with loaded graph)

## Testing

### Backend Tests

```bash
cd backend
pytest tests/
```

### Frontend Tests

```bash
cd frontend
npm test
```

## Deployment

### Backend Deployment (Production)

```bash
# Install production server
pip install gunicorn

# Run with gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 "app:create_app()"
```

### Frontend Deployment

```bash
# Build production bundle
npm run build

# Serve with any static file server
# Example with serve:
npx serve -s build
```

## Known Issues & Limitations

1. **Route Visualization**: Routes display as straight lines between waypoints. For more accurate curved paths, additional intermediate points would be needed.

2. **Map Coverage**: Currently covers main districts of Hanoi. Expanding to full city requires processing additional OSM data.

3. **Traffic Data**: Does not account for real-time traffic conditions. Travel time estimates are based on road types only.

4. **One-way Streets**: Not fully implemented in current version.

## Future Enhancements

- [ ] Real-time traffic integration
- [ ] Multiple route options (fastest, shortest, scenic)
- [ ] Public transport integration
- [ ] Mobile-responsive design improvements
- [ ] Route sharing via URL
- [ ] Saved favorite locations
- [ ] Historical route analytics

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenStreetMap contributors for map data
- Leaflet.js for the mapping library
- A* algorithm implementation inspired by various academic sources

## Contact

For questions or support, please open an issue on GitHub.

---

**Note**: This project is for educational purposes. Map data is provided by OpenStreetMap under the Open Database License (ODbL).