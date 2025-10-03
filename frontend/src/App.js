import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Clock, Loader, AlertCircle, Target, RotateCcw, MapPinned } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
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

const poiIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -28],
  shadowSize: [33, 33]
});

// Component to handle map clicks
function MapClickHandler({ onMapClick, mapMode }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

const HanoiLeafletMap = () => {
  const [pois, setPois] = useState([]);
  const [selectedStart, setSelectedStart] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [mapMode, setMapMode] = useState('start');
  const [showPOIs, setShowPOIs] = useState(true);

  const API_BASE = 'http://localhost:5000/api';
  const HANOI_CENTER = [21.0285, 105.8542];

  useEffect(() => {
    checkBackend();
    loadPOIs();
  }, []);

  const checkBackend = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (response.ok) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('error');
      }
    } catch (err) {
      setBackendStatus('disconnected');
    }
  };

  const loadPOIs = async () => {
    try {
      const response = await fetch('/pois.json');
      const data = await response.json();
      setPois(data.pois || []);
    } catch (err) {
      console.error('Failed to load POIs:', err);
    }
  };

  const findRoute = async () => {
    if (!selectedStart || !selectedEnd) {
      setError('Please select both start and end locations');
      return;
    }

    setLoading(true);
    setError(null);
    setRoute(null);

    try {
      const response = await fetch(`${API_BASE}/route/coordinates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: {
            lat: selectedStart.lat,
            lon: selectedStart.lng || selectedStart.lon
          },
          end: {
            lat: selectedEnd.lat,
            lon: selectedEnd.lng || selectedEnd.lon
          },
          use_cache: true
        })
      });

      const data = await response.json();

      if (data.success) {
        setRoute(data.route);
      } else {
        setError(data.error || 'Failed to find route');
      }
    } catch (err) {
      setError('Failed to connect to backend. Make sure the API server is running.');
      console.error('Route error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = useCallback((latlng) => {
    const location = {
      lat: latlng.lat,
      lng: latlng.lng,
      lon: latlng.lng,
      name: `Custom Point (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`,
      isCustom: true
    };

    if (mapMode === 'start') {
      setSelectedStart(location);
      setMapMode('end');
    } else {
      setSelectedEnd(location);
    }
    setRoute(null);
    setError(null);
  }, [mapMode]);

  const handlePOIClick = (poi) => {
    const location = {
      ...poi,
      lng: poi.lon,
      isCustom: false
    };

    if (mapMode === 'start') {
      setSelectedStart(location);
      setMapMode('end');
    } else {
      setSelectedEnd(location);
    }
    setRoute(null);
    setError(null);
  };

  const reset = () => {
    setSelectedStart(null);
    setSelectedEnd(null);
    setRoute(null);
    setError(null);
    setMapMode('start');
  };

  const getStatusColor = () => {
    switch (backendStatus) {
      case 'connected': return 'text-green-600';
      case 'disconnected': return 'text-red-600';
      case 'error': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (backendStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Backend Offline';
      case 'error': return 'Backend Error';
      default: return 'Checking...';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-800">
              Hanoi Pathfinding - Real Map
            </h1>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                backendStatus === 'connected' ? 'bg-green-500' : 
                backendStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
              }`}></div>
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
          </div>

          {backendStatus === 'disconnected' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">Backend server not running</p>
                <p>Start: <code className="bg-yellow-100 px-2 py-0.5 rounded">cd backend && python run_api.py</code></p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-gray-600">
              <MapPinned size={16} className="inline mr-1" />
              Click anywhere on the map to set start and end points
            </p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showPOIs}
                  onChange={(e) => setShowPOIs(e.target.checked)}
                  className="rounded"
                />
                Show POIs
              </label>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <Target size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-700">
                  Click to set: {mapMode === 'start' ? 'START' : 'END'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Location
                </label>
                {selectedStart ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="font-medium text-sm">
                      {selectedStart.isCustom ? '📍' : selectedStart.icon} {selectedStart.name}
                    </div>
                    {!selectedStart.isCustom && (
                      <div className="text-xs text-gray-600 mt-1">{selectedStart.name_en}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {selectedStart.lat.toFixed(5)}, {(selectedStart.lng || selectedStart.lon).toFixed(5)}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedStart(null);
                        setMapMode('start');
                      }}
                      className="mt-2 text-xs text-red-500 hover:text-red-700"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                    {mapMode === 'start' ? 'Click on map' : 'Already set'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Location
                </label>
                {selectedEnd ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="font-medium text-sm">
                      {selectedEnd.isCustom ? '📍' : selectedEnd.icon} {selectedEnd.name}
                    </div>
                    {!selectedEnd.isCustom && (
                      <div className="text-xs text-gray-600 mt-1">{selectedEnd.name_en}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {selectedEnd.lat.toFixed(5)}, {(selectedEnd.lng || selectedEnd.lon).toFixed(5)}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedEnd(null);
                        setMapMode('end');
                      }}
                      className="mt-2 text-xs text-red-500 hover:text-red-700"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                    {mapMode === 'end' ? 'Click on map' : 'Set start first'}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={findRoute}
                  disabled={!selectedStart || !selectedEnd || loading || backendStatus !== 'connected'}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {loading ? (
                    <>
                      <Loader className="animate-spin" size={14} />
                      Finding...
                    </>
                  ) : (
                    <>
                      <Navigation size={14} />
                      Find Route
                    </>
                  )}
                </button>
                <button
                  onClick={reset}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>

            {route && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-lg font-bold mb-3">Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-blue-50 rounded">
                    <span className="text-xs text-gray-600">Distance</span>
                    <span className="text-sm font-bold text-blue-600">
                      {route.summary.distance_km} km
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-green-50 rounded">
                    <span className="text-xs text-gray-600">Time</span>
                    <span className="text-sm font-bold text-green-600">
                      {route.summary.travel_time_minutes} min
                    </span>
                  </div>
                  <div className="flex justify-between p-2 bg-purple-50 rounded">
                    <span className="text-xs text-gray-600">Nodes</span>
                    <span className="text-sm font-bold text-purple-600">
                      {route.summary.nodes_count}
                    </span>
                  </div>
                  {route.start.snap_distance > 0 && (
                    <div className="text-xs text-gray-500 mt-2 p-2 bg-yellow-50 rounded">
                      Start snapped to nearest road: {route.start.snap_distance.toFixed(0)}m away
                    </div>
                  )}
                  {route.end.snap_distance > 0 && (
                    <div className="text-xs text-gray-500 p-2 bg-yellow-50 rounded">
                      End snapped to nearest road: {route.end.snap_distance.toFixed(0)}m away
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Map Container */}
          <div className="lg:col-span-3 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-red-800">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="h-[600px] rounded-lg overflow-hidden border-2 border-gray-200">
                <MapContainer
                  center={HANOI_CENTER}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <MapClickHandler onMapClick={handleMapClick} mapMode={mapMode} />

                  {/* POI Markers */}
                  {showPOIs && pois.map((poi) => {
                    const isStart = selectedStart?.id === poi.id && !selectedStart?.isCustom;
                    const isEnd = selectedEnd?.id === poi.id && !selectedEnd?.isCustom;
                    
                    if (isStart || isEnd) return null;
                    
                    return (
                      <Marker
                        key={poi.id}
                        position={[poi.lat, poi.lon]}
                        icon={poiIcon}
                        eventHandlers={{
                          click: () => handlePOIClick(poi)
                        }}
                      >
                        <Popup>
                          <div className="text-sm">
                            <div className="font-bold">{poi.icon} {poi.name}</div>
                            <div className="text-gray-600 text-xs">{poi.name_en}</div>
                            <div className="text-gray-500 text-xs mt-1">{poi.category}</div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {/* Start Marker */}
                  {selectedStart && (
                    <Marker
                      position={[selectedStart.lat, selectedStart.lng || selectedStart.lon]}
                      icon={startIcon}
                    >
                      <Popup>
                        <div className="text-sm font-bold">Start: {selectedStart.name}</div>
                      </Popup>
                    </Marker>
                  )}

                  {/* End Marker */}
                  {selectedEnd && (
                    <Marker
                      position={[selectedEnd.lat, selectedEnd.lng || selectedEnd.lon]}
                      icon={endIcon}
                    >
                      <Popup>
                        <div className="text-sm font-bold">End: {selectedEnd.name}</div>
                      </Popup>
                    </Marker>
                  )}

                  {/* Route Polyline with waypoint markers */}
                  {route && route.coordinates && (
                    <>
                      <Polyline
                        positions={route.coordinates.map(c => [c.lat, c.lon])}
                        color="#3B82F6"
                        weight={5}
                        opacity={0.7}
                      />
                      {/* Show waypoint nodes */}
                      {route.coordinates.map((coord, idx) => (
                        <CircleMarker
                          key={idx}
                          center={[coord.lat, coord.lon]}
                          radius={2}
                          fillColor="#1E40AF"
                          fillOpacity={0.8}
                          stroke={false}
                        />
                      ))}
                    </>
                  )}
                </MapContainer>
              </div>
            </div>

            {route && route.segments && route.segments.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">Directions ({route.segments.length} segments)</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {route.segments.map((segment, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-800">
                          {segment.road_name || 'Unnamed road'}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {(segment.distance / 1000).toFixed(2)} km • {(segment.time / 60).toFixed(1)} min
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HanoiLeafletMap;