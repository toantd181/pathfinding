# Installation Guide

Complete step-by-step guide to set up the Hanoi Pathfinding Visualizer on your local machine.

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Backend Setup](#backend-setup)
3. [Frontend Setup](#frontend-setup)
4. [Data Preparation](#data-preparation)
5. [Running the Application](#running-the-application)
6. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Minimum Requirements
- **Operating System**: Linux, macOS, or Windows 10+
- **Python**: 3.8 or higher
- **Node.js**: 14.0 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 2GB free space

### Required Software
- Git (for cloning the repository)
- Python pip (package manager)
- npm or yarn (Node.js package manager)

---

## Backend Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/hanoi-pathfinding.git
cd hanoi-pathfinding
```

### Step 2: Set Up Python Virtual Environment

**On Linux/macOS:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

**On Windows:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
```

You should see `(venv)` in your terminal prompt.

### Step 3: Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

This will install:
- Flask (web framework)
- Flask-CORS (cross-origin support)
- lxml (XML parsing)
- geopy (geographic calculations)
- shapely (geometric operations)
- SQLAlchemy (database ORM)
- And other dependencies

### Step 4: Configure Environment Variables

Create a `.env` file in the backend directory:

```bash
cp .env.example .env
```

Edit `.env` with your preferred settings:

```env
# Flask Configuration
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
HOST=0.0.0.0
PORT=5000

# API Configuration
API_HOST=0.0.0.0
API_PORT=5000

# CORS Settings
CORS_ORIGINS=http://localhost:3000

# Cache Configuration
CACHE_ENABLED=true
CACHE_DATABASE=data/cache/routes.db
```

### Step 5: Verify Backend Installation

```bash
python -c "import flask; import geopy; print('Backend dependencies OK')"
```

If no errors appear, the backend is ready.

---

## Frontend Setup

### Step 1: Navigate to Frontend Directory

```bash
cd ../frontend
```

### Step 2: Install Node.js Dependencies

**Using npm:**
```bash
npm install
```

**Using yarn:**
```bash
yarn install
```

This installs:
- React and React-DOM
- React-Leaflet (map component)
- Leaflet (mapping library)
- Tailwind CSS (styling)
- Lucide React (icons)

### Step 3: Configure Tailwind CSS

Tailwind should already be configured, but verify these files exist:

**tailwind.config.js:**
```javascript
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**postcss.config.js:**
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### Step 4: Add Leaflet CSS to index.html

Open `public/index.html` and ensure this line is in the `<head>` section:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

### Step 5: Copy POI Data

```bash
cp ../backend/data/pois.json public/
```

### Step 6: Verify Frontend Installation

```bash
npm run build
```

If the build completes without errors, the frontend is ready.

---

## Data Preparation

### Option 1: Use Provided Data (Recommended)

The repository includes pre-processed graph data for Hanoi districts:

```bash
cd backend/data/processed
ls -lh
# Should show: hanoi_main.pkl and other district files
```

### Option 2: Process Your Own OSM Data

If you want to process custom areas:

#### Download OSM Data

```bash
cd backend
python scripts/download_osm.py --area "Hanoi, Vietnam" --output data/maps/hanoi.osm
```

#### Process OSM Data into Graph

```bash
python scripts/process_osm.py \
  --input data/maps/hanoi.osm \
  --output data/processed/hanoi_main.pkl \
  --config config/hanoi_config.yaml
```

This creates a graph with:
- Road network nodes (intersections)
- Edges (road segments)
- Distance and time calculations

**Processing time**: 5-15 minutes depending on area size

---

## Running the Application

### Terminal 1: Start Backend Server

```bash
cd backend
source venv/bin/activate  # On Linux/Mac
# OR
venv\Scripts\activate     # On Windows

python run_api.py
```

Expected output:
```
========================================
🚀 STARTING PATHFINDING API SERVER
========================================

📍 Server starting on http://0.0.0.0:5000
🔧 Debug mode: True

📚 API Documentation:
   Health: http://localhost:5000/api/health
   Info: http://localhost:5000/api/info
   Route: POST http://localhost:5000/api/route/coordinates

========================================
```

### Terminal 2: Start Frontend Development Server

```bash
cd frontend
npm start
```

Expected output:
```
Compiled successfully!

You can now view hanoi-pathfinding-frontend in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.1.x:3000
```

### Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

You should see:
- A map of Hanoi
- Blue markers for POI locations
- A green "Connected" status indicator
- Controls to select start and end points

---

## Troubleshooting

### Backend Issues

#### Problem: `ModuleNotFoundError: No module named 'flask'`
**Solution:**
```bash
# Make sure virtual environment is activated
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

#### Problem: `FileNotFoundError: Graph file not found`
**Solution:**
```bash
# Check if graph file exists
ls -l backend/data/processed/hanoi_main.pkl

# If missing, download or process OSM data
# See "Data Preparation" section above
```

#### Problem: Port 5000 already in use
**Solution:**
```bash
# Change port in .env file
echo "API_PORT=5001" >> backend/.env

# Or kill existing process
# Linux/Mac:
lsof -ti:5000 | xargs kill -9
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Frontend Issues

#### Problem: `npm ERR! ENETUNREACH`
**Solution:**
```bash
# Use HTTPS registry
npm config set registry https://registry.npmjs.org/

# Clear cache
npm cache clean --force

# Try again
npm install
```

#### Problem: Tailwind styles not working
**Solution:**
```bash
# Reinstall Tailwind
npm install -D tailwindcss@3 postcss@8 autoprefixer@10

# Make sure src/index.css has:
# @tailwind base;
# @tailwind components;
# @tailwind utilities;
```

#### Problem: Map not showing
**Solution:**
1. Check browser console for errors
2. Verify Leaflet CSS is loaded in `public/index.html`
3. Check backend is running: `curl http://localhost:5000/api/health`

#### Problem: "Backend Offline" warning
**Solution:**
```bash
# Check if backend is running
curl http://localhost:5000/api/health

# If not, start backend:
cd backend
python run_api.py

# Check CORS settings in backend/.env:
# CORS_ORIGINS should include http://localhost:3000
```

### Common Issues

#### Problem: POI markers not showing
**Solution:**
```bash
# Copy POI data to frontend
cp backend/data/pois.json frontend/public/

# Verify file exists
cat frontend/public/pois.json
```

#### Problem: Route not displaying on map
**Solution:**
1. Check browser console for errors
2. Verify backend response: Check Network tab in browser DevTools
3. Ensure start and end points are within map bounds
4. Check backend logs for errors

---

## Verification Checklist

After installation, verify:

- [ ] Backend server starts without errors
- [ ] Frontend builds successfully
- [ ] Browser shows map with Hanoi centered
- [ ] Backend status shows "Connected" in green
- [ ] Blue POI markers are visible on map
- [ ] Clicking map sets start/end points
- [ ] "Find Route" button works
- [ ] Route displays as blue line on map
- [ ] Turn-by-turn directions appear

---

## Next Steps

After successful installation:

1. Read [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for API details
2. See [USER_GUIDE.md](USER_GUIDE.md) for usage instructions
3. Check [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines

---

## Getting Help

If you encounter issues not covered here:

1. Check [GitHub Issues](https://github.com/toantd181/pathfinding/issues)
2. Search for similar problems
3. Open a new issue with:
   - Operating system
   - Python and Node.js versions
   - Error messages
   - Steps to reproduce

---

**Last Updated**: October 2025