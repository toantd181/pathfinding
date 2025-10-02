import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './InteractiveMap.css';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// POI marker icons
const poiIcons = {
  university: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  hospital: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  landmark: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
};

// Component for handling map clicks
function MapClickHandler({ onClick }) {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng);
    },
  });
  return null;
}

function InteractiveMap() {
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clickMode, setClickMode] = useState('start'); // 'start' or 'end'
  const [pois, setPois] = useState([]);
  const [showPOIs, setShowPOIs] = useState(true);
  
  const API_URL = 'http://localhost:5000/api';
  
  // Hanoi center coordinates (adjust based on your map coverage)
  const mapCenter = [21.03, 105.85];
  const mapBounds = [[20.996, 105.775], [21.085, 105.873]]; // Adjust to your coverage

  // Fetch POIs on mount
  useEffect(() => {
    fetchPOIs();
  }, []);

  const fetchPOIs = async () => {
    // Sample POIs - in production, fetch from your backend
    const samplePOIs = [
      { id: 1, name: 'Hoan Kiem Lake', name_en: 'Hoan Kiem Lake', type: 'landmark', lat: 21.0285, lon: 105.8542 },
      { id: 2, name: 'HUST', name_en: 'Hanoi University of Science and Technology', type: 'university', lat: 21.0047, lon: 105.8438 },
      { id: 3, name: 'Bach Mai Hospital', name_en: 'Bach Mai Hospital', type: 'hospital', lat: 21.0032, lon: 105.8412 },
    ];
    setPois(samplePOIs);
  };

  const handleMapClick = (latlng) => {
    if (clickMode === 'start') {
      setStartPoint({ lat: latlng.lat, lng: latlng.lng });
      setClickMode('end');
      setRoute(null);
      setError(null);
    } else {
      setEndPoint({ lat: latlng.lat, lng: latlng.lng });
      setClickMode('start');
      // Auto-calculate route when both points are set
      calculateRoute({ lat: latlng.lat, lng: latlng.lng });
    }
  };

  const calculateRoute = async (endPt = endPoint) => {
    if (!startPoint || !endPt) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/route/coordinates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: { lat: startPoint.lat, lon: startPoint.lng },
          end: { lat: endPt.lat, lon: endPt.lng }
        }),
      });

      const data = await response.json();

      if (data.success) {
        setRoute(data.route);
      } else {
        setError(data.error || 'Could not find route');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Route calculation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearRoute = () => {
    setStartPoint(null);
    setEndPoint(null);
    setRoute(null);
    setError(null);
    setClickMode('start');
  };

  const handlePOIClick = (poi) => {
    if (clickMode === 'start') {
      setStartPoint({ lat: poi.lat, lng: poi.lon });
      setClickMode('end');
      setRoute(null);
    } else {
      setEndPoint({ lat: poi.lat, lng: poi.lon });
      setClickMode('start');
      calculateRoute({ lat: poi.lat, lng: poi.lon });
    }
  };

  return (
    <div className="map-wrapper">
      {/* Control Panel */}
      <div className="control-panel">
        <h2>🗺️ Hanoi Pathfinding</h2>
        
        <div className="instructions">
          <p>
            {clickMode === 'start' 
              ? '🟢 Click map to set START point' 
              : '🔴 Click map to set END point'}
          </p>
        </div>

        {startPoint && (
          <div className="point-info">
            <strong>Start:</strong> {startPoint.lat.toFixed(5)}, {startPoint.lng.toFixed(5)}
          </div>
        )}

        {endPoint && (
          <div className="point-info">
            <strong>End:</strong> {endPoint.lat.toFixed(5)}, {endPoint.lng.toFixed(5)}
          </div>
        )}

        {route && (
          <div className="route-info">
            <h3>📊 Route Information</h3>
            <div className="route-stats">
              <div className="stat">
                <span className="label">Distance:</span>
                <span className="value">{route.summary.distance_km} km</span>
              </div>
              <div className="stat">
                <span className="label">Travel Time:</span>
                <span className="value">{route.summary.travel_time_minutes} min</span>
              </div>
              <div className="stat">
                <span className="label">Nodes:</span>
                <span className="value">{route.summary.nodes_count}</span>
              </div>
              {route.cached && (
                <div className="cached-badge">⚡ Cached</div>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Calculating route...</p>
          </div>
        )}

        {error && (
          <div className="error">
            ❌ {error}
          </div>
        )}

        <div className="actions">
          <button onClick={clearRoute} className="btn-clear">
            🗑️ Clear Route
          </button>
          <button 
            onClick={() => setShowPOIs(!showPOIs)} 
            className="btn-toggle"
          >
            {showPOIs ? '👁️ Hide POIs' : '👁️‍🗨️ Show POIs'}
          </button>
        </div>

        {showPOIs && pois.length > 0 && (
          <div className="poi-list">
            <h3>📍 Points of Interest</h3>
            {pois.map(poi => (
              <div 
                key={poi.id} 
                className="poi-item"
                onClick={() => handlePOIClick(poi)}
              >
                <span className="poi-icon">
                  {poi.type === 'university' ? '🎓' : 
                   poi.type === 'hospital' ? '🏥' : '🏛️'}
                </span>
                <span className="poi-name">{poi.name_en}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="map-container">
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          maxBounds={mapBounds}
          maxBoundsViscosity={1.0}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler onClick={handleMapClick} />

          {/* Start Marker */}
          {startPoint && (
            <Marker 
              position={[startPoint.lat, startPoint.lng]} 
              icon={startIcon}
            >
              <Popup>
                <strong>Start Point</strong><br />
                {startPoint.lat.toFixed(5)}, {startPoint.lng.toFixed(5)}
              </Popup>
            </Marker>
          )}

          {/* End Marker */}
          {endPoint && (
            <Marker 
              position={[endPoint.lat, endPoint.lng]} 
              icon={endIcon}
            >
              <Popup>
                <strong>End Point</strong><br />
                {endPoint.lat.toFixed(5)}, {endPoint.lng.toFixed(5)}
              </Popup>
            </Marker>
          )}

          {/* POI Markers */}
          {showPOIs && pois.map(poi => (
            <Marker
              key={poi.id}
              position={[poi.lat, poi.lon]}
              icon={poiIcons[poi.type] || poiIcons.landmark}
              eventHandlers={{
                click: () => handlePOIClick(poi)
              }}
            >
              <Popup>
                <strong>{poi.name_en}</strong><br />
                <em>{poi.type}</em><br />
                <button 
                  onClick={() => {
                    setStartPoint({ lat: poi.lat, lng: poi.lon });
                    setClickMode('end');
                  }}
                  style={{ marginTop: '5px', marginRight: '5px' }}
                >
                  Set as Start
                </button>
                <button 
                  onClick={() => {
                    setEndPoint({ lat: poi.lat, lng: poi.lon });
                    setClickMode('start');
                    if (startPoint) calculateRoute({ lat: poi.lat, lng: poi.lon });
                  }}
                  style={{ marginTop: '5px' }}
                >
                  Set as End
                </button>
              </Popup>
            </Marker>
          ))}

          {/* Route Polyline */}
          {route && route.coordinates && (
            <Polyline
              positions={route.coordinates.map(c => [c.lat, c.lon])}
              color="#2563eb"
              weight={5}
              opacity={0.7}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default InteractiveMap;