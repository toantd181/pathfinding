import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { Play, Pause, RotateCcw, Ban, Trash2, Upload } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

function MapClickHandler({ onMapClick, mode }) {
  useMapEvents({
    click: (e) => {
      if (mode === 'select' || mode === 'block') {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

const PathfindingVisualizer = () => {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [startNode, setStartNode] = useState(null);
  const [endNode, setEndNode] = useState(null);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [blockedEdges, setBlockedEdges] = useState(new Set());
  const [trafficJamEdges, setTrafficJamEdges] = useState(new Set());
  const [mode, setMode] = useState('select');
  const [blockingMode, setBlockingMode] = useState('full');
  const [firstBlockNode, setFirstBlockNode] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pathData, setPathData] = useState([]);
  const [stats, setStats] = useState({
    distance: 0,
    nodesExplored: 0,
    pathLength: 0,
    executionTime: 0
  });
  const [speed, setSpeed] = useState(50);
  const [isComplete, setIsComplete] = useState(false);
  const [graphSource, setGraphSource] = useState('backend');
  const [uploadedFileName, setUploadedFileName] = useState('');
  
  const fileInputRef = useRef(null);
  const HANOI_CENTER = [21.0285, 105.8542];

  useEffect(() => {
    loadGraph();
  }, []);

  const loadGraph = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/graph/load');
      const data = await response.json();
      
      console.log('Loaded graph from backend:', data);
      console.log('Nodes:', data.nodes?.length || 0);
      console.log('Edges:', data.edges?.length || 0);
      
      if (data.nodes && data.nodes.length > 0) {
        setGraph(data);
        setGraphSource('backend');
        setUploadedFileName('');
      }
    } catch (error) {
      console.error('Error loading graph from backend:', error);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        console.log('Loaded graph from file:', file.name);
        console.log('Nodes:', data.nodes?.length || 0);
        console.log('Edges:', data.edges?.length || 0);
        
        if (!data.nodes || !data.edges) {
          alert('Invalid graph file. Must contain "nodes" and "edges" arrays.');
          return;
        }

        setGraph(data);
        setGraphSource('uploaded');
        setUploadedFileName(file.name);
        resetVisualization();
        
      } catch (err) {
        alert('Failed to parse JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const haversineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const findNearestEdgeAndProjection = (clickedLat, clickedLng) => {
    if (graph.edges.length === 0) return null;

    let nearestEdge = null;
    let minDistance = Infinity;
    let projectionPoint = null;

    graph.edges.forEach(edge => {
      const fromNode = graph.nodes.find(n => n.id === edge.from);
      const toNode = graph.nodes.find(n => n.id === edge.to);
      
      if (!fromNode || !toNode) return;

      const fromLng = fromNode.lng || fromNode.lon;
      const toLng = toNode.lng || toNode.lon;

      const dx = toLng - fromLng;
      const dy = toNode.lat - fromNode.lat;
      const lengthSquared = dx * dx + dy * dy;

      if (lengthSquared === 0) {
        const dist = haversineDistance(clickedLat, clickedLng, fromNode.lat, fromLng);
        if (dist < minDistance) {
          minDistance = dist;
          nearestEdge = edge;
          projectionPoint = { lat: fromNode.lat, lng: fromLng };
        }
        return;
      }

      const t = Math.max(0, Math.min(1, 
        ((clickedLng - fromLng) * dx + (clickedLat - fromNode.lat) * dy) / lengthSquared
      ));

      const projLat = fromNode.lat + t * dy;
      const projLng = fromLng + t * dx;

      const dist = haversineDistance(clickedLat, clickedLng, projLat, projLng);

      if (dist < minDistance) {
        minDistance = dist;
        nearestEdge = edge;
        projectionPoint = { lat: projLat, lng: projLng, t };
      }
    });

    return nearestEdge ? { edge: nearestEdge, projection: projectionPoint, distance: minDistance } : null;
  };

  const findNearestNodeOnEdge = (edge, lat, lng) => {
    const fromNode = graph.nodes.find(n => n.id === edge.from);
    const toNode = graph.nodes.find(n => n.id === edge.to);
    
    const fromLng = fromNode.lng || fromNode.lon;
    const toLng = toNode.lng || toNode.lon;
    
    const distToFrom = haversineDistance(lat, lng, fromNode.lat, fromLng);
    const distToTo = haversineDistance(lat, lng, toNode.lat, toLng);
    
    return distToFrom < distToTo ? fromNode : toNode;
  };

  const handleMapClick = (latlng) => {
    if (isRunning) return;

    if (mode === 'block' && blockingMode === 'segment') {
      const result = findNearestEdgeAndProjection(latlng.lat, latlng.lng);
      if (!result) {
        alert('No road found near this location');
        return;
      }

      const clickedNode = findNearestNodeOnEdge(result.edge, latlng.lat, latlng.lng);
      
      if (!firstBlockNode) {
        setFirstBlockNode(clickedNode);
      } else {
        if (clickedNode.id === firstBlockNode.id) {
          alert('Please select a different node');
          return;
        }
        
        const edge = graph.edges.find(e => 
          (e.from === firstBlockNode.id && e.to === clickedNode.id) ||
          (e.to === firstBlockNode.id && e.from === clickedNode.id)
        );
        
        if (edge) {
          toggleEdgeBlock(edge.from, edge.to);
        } else {
          alert('No direct road between these two points');
        }
        
        setFirstBlockNode(null);
      }
      return;
    }

    if (mode === 'select') {
      const result = findNearestEdgeAndProjection(latlng.lat, latlng.lng);
      if (!result) {
        alert('No road found near this location');
        return;
      }

      const clickPoint = {
        lat: latlng.lat,
        lng: latlng.lng,
        nearestEdge: result.edge,
        projection: result.projection
      };

      if (!startPoint) {
        setStartPoint(clickPoint);
        setStartNode(null);
      } else if (!endPoint) {
        setEndPoint(clickPoint);
        setEndNode(null);
      } else {
        setStartPoint(clickPoint);
        setEndPoint(null);
        setStartNode(null);
        setEndNode(null);
        resetVisualization();
      }
    }
  };

  const getEdgeKey = (fromId, toId) => {
    return `${Math.min(fromId, toId)}-${Math.max(fromId, toId)}`;
  };

  const isEdgeBlocked = (fromId, toId) => {
    return blockedEdges.has(getEdgeKey(fromId, toId));
  };

  const hasTrafficJam = (fromId, toId) => {
    return trafficJamEdges.has(getEdgeKey(fromId, toId));
  };

  const toggleEdgeBlock = (fromId, toId) => {
    const key = getEdgeKey(fromId, toId);
    const newBlockedEdges = new Set(blockedEdges);
    const newTrafficJamEdges = new Set(trafficJamEdges);
    
    if (newBlockedEdges.has(key)) {
      newBlockedEdges.delete(key);
      newTrafficJamEdges.add(key);
    } else if (newTrafficJamEdges.has(key)) {
      newTrafficJamEdges.delete(key);
    } else {
      newBlockedEdges.add(key);
    }
    
    setBlockedEdges(newBlockedEdges);
    setTrafficJamEdges(newTrafficJamEdges);
    resetVisualization();
  };

  const reconstructPath = (cameFrom, current) => {
    const path = [current];
    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      path.unshift(current);
    }
    return path;
  };

  const runAStar = async () => {
    if (!startPoint || !endPoint) return;

    setIsRunning(true);
    setIsComplete(false);
    setIsPaused(false);

    const startVirtualId = 'virtual_start';
    const endVirtualId = 'virtual_end';

    const augmentedNodes = [...graph.nodes];
    const augmentedEdges = [...graph.edges];

    augmentedNodes.push({
      id: startVirtualId,
      lat: startPoint.lat,
      lng: startPoint.lng,
      name: 'Start Point'
    });

    const startEdge = startPoint.nearestEdge;
    const startFromNode = graph.nodes.find(n => n.id === startEdge.from);
    const startToNode = graph.nodes.find(n => n.id === startEdge.to);
    
    if (startFromNode && startToNode) {
      const startFromLng = startFromNode.lng || startFromNode.lon;
      const startToLng = startToNode.lng || startToNode.lon;
      
      const distToFrom = haversineDistance(startPoint.lat, startPoint.lng, startFromNode.lat, startFromLng);
      const distToTo = haversineDistance(startPoint.lat, startPoint.lng, startToNode.lat, startToLng);
      
      augmentedEdges.push({
        id: 'virtual_start_from',
        from: startVirtualId,
        to: startEdge.from,
        distance: distToFrom,
        bidirectional: true
      });
      
      augmentedEdges.push({
        id: 'virtual_start_to',
        from: startVirtualId,
        to: startEdge.to,
        distance: distToTo,
        bidirectional: true
      });
    }

    augmentedNodes.push({
      id: endVirtualId,
      lat: endPoint.lat,
      lng: endPoint.lng,
      name: 'End Point'
    });

    const endEdge = endPoint.nearestEdge;
    const endFromNode = graph.nodes.find(n => n.id === endEdge.from);
    const endToNode = graph.nodes.find(n => n.id === endEdge.to);
    
    if (endFromNode && endToNode) {
      const endFromLng = endFromNode.lng || endFromNode.lon;
      const endToLng = endToNode.lng || endToNode.lon;
      
      const distToFrom = haversineDistance(endPoint.lat, endPoint.lng, endFromNode.lat, endFromLng);
      const distToTo = haversineDistance(endPoint.lat, endPoint.lng, endToNode.lat, endToLng);
      
      augmentedEdges.push({
        id: 'virtual_end_from',
        from: endVirtualId,
        to: endEdge.from,
        distance: distToFrom,
        bidirectional: true
      });
      
      augmentedEdges.push({
        id: 'virtual_end_to',
        from: endVirtualId,
        to: endEdge.to,
        distance: distToTo,
        bidirectional: true
      });
    }

    const startTime = Date.now();
    const openSet = new Set([startVirtualId]);
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map([[startVirtualId, 0]]);
    
    const heuristicFunc = (nodeId) => {
      const node = augmentedNodes.find(n => n.id === nodeId);
      if (!node) return 0;
      const nodeLng = node.lng || node.lon;
      return haversineDistance(node.lat, nodeLng, endPoint.lat, endPoint.lng);
    };
    
    const fScore = new Map([[startVirtualId, heuristicFunc(startVirtualId)]]);

    let nodesExplored = 0;

    const getAugmentedNeighbors = (nodeId) => {
      const neighbors = [];
      augmentedEdges.forEach(edge => {
        if (isEdgeBlocked(edge.from, edge.to) && 
            edge.id !== 'virtual_start_from' && 
            edge.id !== 'virtual_start_to' &&
            edge.id !== 'virtual_end_from' && 
            edge.id !== 'virtual_end_to') {
          return;
        }
        
        let weight = edge.distance || 1;
        
        if (hasTrafficJam(edge.from, edge.to)) {
          weight *= 3;
        }
        
        if (edge.from === nodeId) {
          neighbors.push({ id: edge.to, cost: weight });
        } else if (edge.to === nodeId && edge.bidirectional !== false) {
          neighbors.push({ id: edge.from, cost: weight });
        }
      });
      return neighbors;
    };

    while (openSet.size > 0) {
      while (isPaused) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      let current = null;
      let lowestF = Infinity;
      for (const node of openSet) {
        const f = fScore.get(node) || Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = node;
        }
      }

      nodesExplored++;

      if (current === endVirtualId) {
        const path = reconstructPath(cameFrom, current);
        const distance = gScore.get(current);
        const executionTime = Date.now() - startTime;

        const pathCoords = path.map(nodeId => {
          const node = augmentedNodes.find(n => n.id === nodeId);
          const lng = node.lng || node.lon;
          return [node.lat, lng];
        });

        setPathData(pathCoords);
        setStats({
          distance: Math.round(distance),
          nodesExplored,
          pathLength: path.length,
          executionTime
        });

        setIsRunning(false);
        setIsComplete(true);
        return;
      }

      openSet.delete(current);
      closedSet.add(current);

      await new Promise(resolve => setTimeout(resolve, 101 - speed));

      const neighbors = getAugmentedNeighbors(current);
      for (const neighbor of neighbors) {
        if (closedSet.has(neighbor.id)) continue;

        const tentativeG = (gScore.get(current) || 0) + neighbor.cost;

        if (!openSet.has(neighbor.id)) {
          openSet.add(neighbor.id);
        } else if (tentativeG >= (gScore.get(neighbor.id) || Infinity)) {
          continue;
        }

        cameFrom.set(neighbor.id, current);
        gScore.set(neighbor.id, tentativeG);
        fScore.set(neighbor.id, tentativeG + heuristicFunc(neighbor.id));
      }
    }

    setStats({
      distance: 0,
      nodesExplored,
      pathLength: 0,
      executionTime: Date.now() - startTime
    });
    setIsRunning(false);
    alert('No path found! Try unblocking some roads.');
  };

  const resetVisualization = () => {
    setPathData([]);
    setStats({
      distance: 0,
      nodesExplored: 0,
      pathLength: 0,
      executionTime: 0
    });
    setIsRunning(false);
    setIsPaused(false);
    setIsComplete(false);
  };

  const handleReset = () => {
    resetVisualization();
    setStartPoint(null);
    setEndPoint(null);
    setStartNode(null);
    setEndNode(null);
  };

  const clearBlockedRoads = () => {
    setBlockedEdges(new Set());
    setTrafficJamEdges(new Set());
    resetVisualization();
  };

  const pathEdgeSet = new Set();
  if (pathData.length > 1) {
    for (let i = 0; i < pathData.length - 1; i++) {
      const from = pathData[i];
      const to = pathData[i + 1];
      graph.edges.forEach(edge => {
        const fromNode = graph.nodes.find(n => n.id === edge.from);
        const toNode = graph.nodes.find(n => n.id === edge.to);
        if (fromNode && toNode) {
          const fromLng = fromNode.lng || fromNode.lon;
          const toLng = toNode.lng || toNode.lon;
          if ((Math.abs(fromNode.lat - from[0]) < 0.00001 && Math.abs(fromLng - from[1]) < 0.00001 &&
               Math.abs(toNode.lat - to[0]) < 0.00001 && Math.abs(toLng - to[1]) < 0.00001) ||
              (Math.abs(toNode.lat - from[0]) < 0.00001 && Math.abs(toLng - from[1]) < 0.00001 &&
               Math.abs(fromNode.lat - to[0]) < 0.00001 && Math.abs(fromLng - to[1]) < 0.00001)) {
            pathEdgeSet.add(edge.id);
          }
        }
      });
    }
  }

  const edgeLines = graph.edges.map(edge => {
    const fromNode = graph.nodes.find(n => n.id === edge.from);
    const toNode = graph.nodes.find(n => n.id === edge.to);
    if (fromNode && toNode) {
      const fromLng = fromNode.lng || fromNode.lon;
      const toLng = toNode.lng || toNode.lon;
      
      const isBlocked = isEdgeBlocked(edge.from, edge.to);
      const isTrafficJam = hasTrafficJam(edge.from, edge.to);
      const isInPath = pathEdgeSet.has(edge.id);
      
      if (!isBlocked && !isTrafficJam && !isInPath) {
        return null;
      }
      
      return {
        ...edge,
        positions: [[fromNode.lat, fromLng], [toNode.lat, toLng]],
        isBlocked,
        isTrafficJam
      };
    }
    return null;
  }).filter(Boolean);

  const poiNodes = graph.nodes.filter(n => n.isPOI);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white shadow-md p-4 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-800">A* Pathfinding Visualizer</h1>
            <div className="flex gap-2">
              <button
                onClick={loadGraph}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Load from Backend
              </button>
              <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2">
                <Upload size={16} />
                Upload JSON
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".json" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          {uploadedFileName && (
            <div className="mb-2 text-sm text-green-600">
              Loaded: {uploadedFileName}
            </div>
          )}

          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex gap-2">
              <button
                onClick={() => { setMode('select'); setFirstBlockNode(null); }}
                disabled={isRunning}
                className={`px-4 py-2 rounded ${mode === 'select' ? 'bg-green-600 text-white' : 'bg-gray-200'} disabled:opacity-50`}
              >
                Select Mode
              </button>
              <button
                onClick={() => { setMode('block'); setFirstBlockNode(null); }}
                disabled={isRunning}
                className={`px-4 py-2 rounded flex items-center gap-2 ${mode === 'block' ? 'bg-red-600 text-white' : 'bg-gray-200'} disabled:opacity-50`}
              >
                <Ban size={16} />
                Road Status
              </button>
            </div>

            {mode === 'block' && (
              <div className="flex gap-2 items-center">
                <span className="text-sm text-gray-600">Block Mode:</span>
                <button
                  onClick={() => { setBlockingMode('full'); setFirstBlockNode(null); }}
                  className={`px-3 py-1 rounded text-sm ${blockingMode === 'full' ? 'bg-orange-600 text-white' : 'bg-gray-200'}`}
                >
                  Whole Road
                </button>
                <button
                  onClick={() => { setBlockingMode('segment'); setFirstBlockNode(null); }}
                  className={`px-3 py-1 rounded text-sm ${blockingMode === 'segment' ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
                >
                  Road Segment
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Speed:</label>
              <input
                type="range"
                min="1"
                max="100"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                disabled={isRunning}
                className="w-32 accent-green-600"
              />
              <span className="text-sm text-gray-600 w-12">{speed}%</span>
            </div>

            <div className="flex gap-2 ml-auto">
              <button
                onClick={runAStar}
                disabled={!startPoint || !endPoint || isRunning}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:bg-gray-400 flex items-center gap-2"
              >
                <Play size={16} />
                Start A*
              </button>
              <button
                onClick={() => setIsPaused(!isPaused)}
                disabled={!isRunning}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded disabled:bg-gray-400 flex items-center gap-2"
              >
                <Pause size={16} />
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-2"
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-6 text-sm text-gray-600">
            <span>Graph: {graph.nodes?.length || 0} nodes, {graph.edges?.length || 0} edges</span>
            <span>Start: {startPoint ? `(${startPoint.lat.toFixed(5)}, ${startPoint.lng.toFixed(5)})` : 'None'}</span>
            <span>End: {endPoint ? `(${endPoint.lat.toFixed(5)}, ${endPoint.lng.toFixed(5)})` : 'None'}</span>
            <span>Distance: {stats.distance}m</span>
            <span>Path Length: {stats.pathLength} nodes</span>
            <span>Explored: {stats.nodesExplored} nodes</span>
            <span>Time: {stats.executionTime}ms</span>
            {blockedEdges.size > 0 && (
              <span className="text-red-600">Blocked: {blockedEdges.size} roads</span>
            )}
            {trafficJamEdges.size > 0 && (
              <span className="text-yellow-600">Traffic Jam: {trafficJamEdges.size} roads</span>
            )}
          </div>

          {mode === 'select' && (
            <div className="mt-2 text-sm text-blue-600">
              Click anywhere on the map to select nearest node as start/end point
            </div>
          )}
          {mode === 'block' && blockingMode === 'full' && (
            <div className="mt-2 text-sm text-red-600">
              Click roads to cycle: Normal → Blocked (Red) → Traffic Jam (Yellow) → Normal
            </div>
          )}
          {mode === 'block' && blockingMode === 'segment' && (
            <div className="mt-2 text-sm text-purple-600">
              {firstBlockNode 
                ? `Selected: ${firstBlockNode.name}. Click another node to block/unblock the road segment between them.`
                : 'Click first node to start selecting road segment'}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1">
        {graph.nodes.length > 0 ? (
          <MapContainer
            center={HANOI_CENTER}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler onMapClick={handleMapClick} mode={mode} />

            {edgeLines.map(edge => (
              <Polyline
                key={edge.id}
                positions={edge.positions}
                color={edge.isBlocked ? '#dc2626' : edge.isTrafficJam ? '#eab308' : '#3b82f6'}
                weight={edge.isBlocked || edge.isTrafficJam ? 6 : 3}
                opacity={edge.isBlocked ? 0.9 : edge.isTrafficJam ? 0.8 : 0.5}
                dashArray={edge.isBlocked ? '10, 10' : null}
                eventHandlers={{
                  click: () => {
                    if (mode === 'block' && blockingMode === 'full') {
                      toggleEdgeBlock(edge.from, edge.to);
                    }
                  }
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-medium">
                      {edge.isBlocked && <span className="text-red-600">🚫 Blocked Road</span>}
                      {edge.isTrafficJam && <span className="text-yellow-600">🚗 Traffic Jam (3x slower)</span>}
                      {!edge.isBlocked && !edge.isTrafficJam && (
                        edge.bidirectional === false ? 'One-way road' : 'Two-way road'
                      )}
                    </div>
                    <div>Distance: {edge.distance}m</div>
                    <button
                      onClick={() => toggleEdgeBlock(edge.from, edge.to)}
                      className="mt-2 px-3 py-1 rounded text-xs w-full bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      {edge.isBlocked ? 'Change to Traffic Jam' : edge.isTrafficJam ? 'Clear' : 'Block Road'}
                    </button>
                  </div>
                </Popup>
              </Polyline>
            ))}

            {pathData.length > 0 && (
              <Polyline
                positions={pathData}
                color={isComplete ? '#00ff00' : '#ffff00'}
                weight={5}
                opacity={0.8}
              />
            )}

            {mode === 'block' && blockingMode === 'segment' && graph.nodes.map(node => {
              const lng = node.lng || node.lon;
              const isFirstNode = firstBlockNode && firstBlockNode.id === node.id;
              
              return (
                <CircleMarker
                  key={`node-${node.id}`}
                  center={[node.lat, lng]}
                  radius={isFirstNode ? 10 : 5}
                  pathOptions={{
                    color: isFirstNode ? '#a855f7' : '#3b82f6',
                    fillColor: isFirstNode ? '#a855f7' : '#3b82f6',
                    fillOpacity: isFirstNode ? 0.9 : 0.6,
                    weight: isFirstNode ? 3 : 1
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold">{node.name}</div>
                      {isFirstNode && <div className="text-purple-600">First node selected</div>}
                      {!isFirstNode && <div className="text-gray-600">Click to select as second node</div>}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {poiNodes.map(node => {
              const lng = node.lng || node.lon;
              return (
                <Marker
                  key={node.id}
                  position={[node.lat, lng]}
                  icon={poiIcon}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold">{node.name}</div>
                      <div className="text-gray-600">POI</div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {startPoint && (
              <Marker
                position={[startPoint.lat, startPoint.lng]}
                icon={startIcon}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold text-green-700">Start Point</div>
                    <div>({startPoint.lat.toFixed(5)}, {startPoint.lng.toFixed(5)})</div>
                  </div>
                </Popup>
              </Marker>
            )}

            {endPoint && (
              <Marker
                position={[endPoint.lat, endPoint.lng]}
                icon={endIcon}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold text-red-700">End Point</div>
                    <div>({endPoint.lat.toFixed(5)}, {endPoint.lng.toFixed(5)})</div>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-700 mb-4">No Graph Loaded</h2>
              <p className="text-gray-600 mb-4">
                Load a graph from backend or upload a JSON file to start
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={loadGraph}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  Load from Backend
                </button>
                <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded cursor-pointer">
                  Upload JSON
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PathfindingVisualizer;