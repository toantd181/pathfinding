import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, Loader, AlertCircle, Info, Target } from 'lucide-react';

const HanoiMapVisualizer = () => {
  const [pois, setPois] = useState([]);
  const [selectedStart, setSelectedStart] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [mapMode, setMapMode] = useState('start'); // 'start' or 'end'

  const API_BASE = 'http://localhost:5000/api';

  // Hanoi bounds for the map
  const HANOI_CENTER = { lat: 21.0285, lon: 105.8542 };
  const MAP_BOUNDS = {
    minLat: 20.95,
    maxLat: 21.15,
    minLon: 105.75,
    maxLon: 105.95
  };

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
            lon: selectedStart.lon
          },
          end: {
            lat: selectedEnd.lat,
            lon: selectedEnd.lon
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

  const handleMapClick = (poi) => {
    if (mapMode === 'start') {
      setSelectedStart(poi);
      setMapMode('end');
    } else {
      setSelectedEnd(poi);
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

  // Convert lat/lon to SVG coordinates
  const latLonToSVG = (lat, lon) => {
    const x = ((lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * 800;
    const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 600;
    return { x, y };
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
              Hanoi Pathfinding Visualizer
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
                <p>Start the backend server with: <code className="bg-yellow-100 px-2 py-0.5 rounded">cd backend && python run_api.py</code></p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-gray-600">
              Click on locations on the map to set start and end points
            </p>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <Target size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-700">
                Click to set: {mapMode === 'start' ? 'START' : 'END'} location
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Selected Locations & Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Selected Locations */}
            <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Location
                </label>
                {selectedStart ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin size={16} className="text-green-600" />
                      <span className="text-sm font-bold">{selectedStart.name}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {selectedStart.name_en}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {selectedStart.lat.toFixed(4)}, {selectedStart.lon.toFixed(4)}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedStart(null);
                        setMapMode('start');
                      }}
                      className="mt-2 text-xs text-red-500 hover:text-red-700"
                    >
                      Clear and select again
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                    {mapMode === 'start' ? 'Click a location on the map' : 'Already set, click to change'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Location
                </label>
                {selectedEnd ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin size={16} className="text-red-600" />
                      <span className="text-sm font-bold">{selectedEnd.name}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {selectedEnd.name_en}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {selectedEnd.lat.toFixed(4)}, {selectedEnd.lon.toFixed(4)}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedEnd(null);
                        setMapMode('end');
                      }}
                      className="mt-2 text-xs text-red-500 hover:text-red-700"
                    >
                      Clear and select again
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                    {mapMode === 'end' ? 'Click a location on the map' : 'Set start location first'}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={findRoute}
                  disabled={!selectedStart || !selectedEnd || loading || backendStatus !== 'connected'}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? (
                    <>
                      <Loader className="animate-spin" size={16} />
                      Finding Route...
                    </>
                  ) : (
                    <>
                      <Navigation size={16} />
                      Find Route
                    </>
                  )}
                </button>
                <button
                  onClick={reset}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Route Summary */}
            {route && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-lg font-bold mb-3">Route Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-gray-600">Distance</span>
                    <span className="text-lg font-bold text-blue-600">
                      {route.summary.distance_km} km
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-gray-600">Travel Time</span>
                    <span className="text-lg font-bold text-green-600">
                      {route.summary.travel_time_minutes} min
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm text-gray-600">Waypoints</span>
                    <span className="text-lg font-bold text-purple-600">
                      {route.summary.nodes_count}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Interactive Map */}
          <div className="lg:col-span-2 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-red-800">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Interactive Map */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Interactive Map</h2>
              <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                <svg viewBox="0 0 800 600" className="w-full h-auto bg-gray-50">
                  {/* Grid lines */}
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="gray" strokeWidth="0.5" opacity="0.2"/>
                    </pattern>
                  </defs>
                  <rect width="800" height="600" fill="url(#grid)" />

                  {/* Route path */}
                  {route && route.coordinates && route.coordinates.length > 1 && (
                    <g>
                      <polyline
                        points={route.coordinates.map(coord => {
                          const { x, y } = latLonToSVG(coord.lat, coord.lon);
                          return `${x},${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#3B82F6"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.7"
                      />
                    </g>
                  )}

                  {/* POI markers */}
                  {pois.map((poi) => {
                    const { x, y } = latLonToSVG(poi.lat, poi.lon);
                    const isStart = selectedStart?.id === poi.id;
                    const isEnd = selectedEnd?.id === poi.id;
                    
                    return (
                      <g key={poi.id}>
                        <circle
                          cx={x}
                          cy={y}
                          r={isStart || isEnd ? 12 : 8}
                          fill={isStart ? '#10B981' : isEnd ? '#EF4444' : '#6B7280'}
                          stroke="white"
                          strokeWidth="2"
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleMapClick(poi)}
                        />
                        {(isStart || isEnd) && (
                          <text
                            x={x}
                            y={y - 20}
                            textAnchor="middle"
                            className="text-xs font-bold pointer-events-none"
                            fill={isStart ? '#10B981' : '#EF4444'}
                          >
                            {isStart ? 'START' : 'END'}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Legend */}
                  <g transform="translate(10, 10)">
                    <rect width="180" height="90" fill="white" opacity="0.9" rx="5" />
                    <text x="10" y="25" className="text-sm font-bold" fill="#374151">Map Legend</text>
                    <circle cx="20" cy="45" r="6" fill="#10B981" />
                    <text x="35" y="50" className="text-xs" fill="#374151">Start Point</text>
                    <circle cx="20" cy="70" r="6" fill="#EF4444" />
                    <text x="35" y="75" className="text-xs" fill="#374151">End Point</text>
                  </g>
                </svg>
              </div>
              <p className="text-sm text-gray-500 mt-2 text-center">
                Click on any gray dot to select it as {mapMode === 'start' ? 'start' : 'end'} location
              </p>
            </div>

            {/* Turn-by-Turn Directions */}
            {route && route.segments && route.segments.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">Turn-by-Turn Directions</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {route.segments.map((segment, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">
                          {segment.road_name || 'Unnamed road'}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
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

export default HanoiMapVisualizer;