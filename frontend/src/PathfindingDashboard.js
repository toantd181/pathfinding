import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, Ban, Trash2, Upload } from 'lucide-react';
import MapView from './MapView'; // We will create this component next

// --- UTILITY FUNCTIONS ---
// (Haversine, splitting edges, etc. All the logic lives here)
const EPS = 1e-9;

const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const findNearestEdgeAndProjection = (clickedLat, clickedLng, graphArg) => {
    if (!graphArg.edges || graphArg.edges.length === 0) return null;
    let nearestEdge = null;
    let minDistance = Infinity;
    let projectionPoint = null;

    for (const edge of graphArg.edges) {
      const fromNode = graphArg.nodes.find((n) => n.id === edge.from);
      const toNode = graphArg.nodes.find((n) => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      const fromLng = fromNode.lng ?? fromNode.lon;
      const toLng = toNode.lng ?? toNode.lon;
      const dx = toLng - fromLng;
      const dy = toNode.lat - fromNode.lat;
      const lengthSquared = dx * dx + dy * dy;

      if (lengthSquared === 0) {
        const dist = haversineDistance(clickedLat, clickedLng, fromNode.lat, fromLng);
        if (dist < minDistance) {
          minDistance = dist;
          nearestEdge = edge;
          projectionPoint = { lat: fromNode.lat, lng: fromLng, t: 0 };
        }
        continue;
      }

      const t = Math.max(0, Math.min(1, ((clickedLng - fromLng) * dx + (clickedLat - fromNode.lat) * dy) / lengthSquared));
      const projLat = fromNode.lat + t * dy;
      const projLng = fromLng + t * dx;
      const dist = haversineDistance(clickedLat, clickedLng, projLat, projLng);

      if (dist < minDistance) {
        minDistance = dist;
        nearestEdge = edge;
        projectionPoint = { lat: projLat, lng: projLng, t };
      }
    }
    return nearestEdge ? { edge: nearestEdge, projection: projectionPoint, distance: minDistance } : null;
};

const findPathBetweenNodesUndirected = (graphArg, startNodeId, endNodeId) => {
    if (!graphArg.edges || graphArg.edges.length === 0) return null;
    const queue = [[startNodeId]];
    const visited = new Set([startNodeId]);
    while (queue.length) {
      const path = queue.shift();
      const current = path[path.length - 1];
      if (current === endNodeId) return path;
      for (const edge of graphArg.edges) {
        let neighbor = null;
        if (edge.from === current) neighbor = edge.to;
        else if (edge.to === current) neighbor = edge.from;
        if (neighbor && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
    return null;
};

// --- MAIN COMPONENT ---

const PathfindingDashboard = () => {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [blockedEdges, setBlockedEdges] = useState(new Set());
  const [trafficJamEdges, setTrafficJamEdges] = useState(new Set());
  const [mode, setMode] = useState('select');
  const [roadStatusMode, setRoadStatusMode] = useState('block');
  const [firstBlockNode, setFirstBlockNode] = useState(null);
  const [firstBlockPoint, setFirstBlockPoint] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pathData, setPathData] = useState([]);
  const [stats, setStats] = useState({ distance: 0, nodesExplored: 0, pathLength: 0, executionTime: 0 });
  const [speed, setSpeed] = useState(50);
  const [isComplete, setIsComplete] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');

  useEffect(() => {
    loadGraph();
  }, []);

  const loadGraph = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/graph/load');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.nodes && data.nodes.length > 0) {
        setGraph(data);
        setUploadedFileName('');
        resetVisualization();
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
        if (!data.nodes || !data.edges) {
          alert('Invalid graph file. Must contain "nodes" and "edges" arrays.');
          return;
        }
        setGraph(data);
        setUploadedFileName(file.name);
        resetVisualization();
      } catch (err) {
        alert('Failed to parse JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetVisualization = () => {
    setPathData([]);
    setStats({ distance: 0, nodesExplored: 0, pathLength: 0, executionTime: 0 });
    setIsRunning(false);
    setIsPaused(false);
    setIsComplete(false);
  };

  const handleReset = () => {
    resetVisualization();
    setStartPoint(null);
    setEndPoint(null);
  };

  const clearAlteredRoads = () => {
    setBlockedEdges(new Set());
    setTrafficJamEdges(new Set());
    resetVisualization();
  };

  const handleMapClick = (latlng) => {
    if (isRunning) return;

    if (mode === 'road-status') {
      const result = findNearestEdgeAndProjection(latlng.lat, latlng.lng, graph);
      if (!result) {
        alert("No road found near this location.");
        return;
      }
      const clickedEdge = result.edge;

      if (!firstBlockNode) {
        setFirstBlockNode({ edgeId: clickedEdge.id, from: clickedEdge.from, to: clickedEdge.to });
        setFirstBlockPoint({ lat: latlng.lat, lng: latlng.lng });
        return;
      }

      const startEdgeInfo = firstBlockNode;
      const endEdgeInfo = { edgeId: clickedEdge.id, from: clickedEdge.from, to: clickedEdge.to };
      const edgesToModify = new Set();

      if (startEdgeInfo.edgeId === endEdgeInfo.edgeId) {
        edgesToModify.add(startEdgeInfo.edgeId);
      } else {
        const pathNodes = findPathBetweenNodesUndirected(graph, startEdgeInfo.to, endEdgeInfo.from) ||
                          findPathBetweenNodesUndirected(graph, startEdgeInfo.from, endEdgeInfo.to) ||
                          findPathBetweenNodesUndirected(graph, startEdgeInfo.to, endEdgeInfo.to) ||
                          findPathBetweenNodesUndirected(graph, startEdgeInfo.from, endEdgeInfo.from);

        if (pathNodes && pathNodes.length > 0) {
          edgesToModify.add(startEdgeInfo.edgeId);
          edgesToModify.add(endEdgeInfo.edgeId);
          for (let i = 0; i < pathNodes.length - 1; i++) {
            const a = pathNodes[i];
            const b = pathNodes[i+1];
            const edgesBetween = graph.edges.filter(e => (e.from === a && e.to === b) || (e.from === b && e.to === a));
            edgesBetween.forEach(e => edgesToModify.add(e.id));
          }
        } else {
          alert("No path found between the two selected roads.");
          setFirstBlockNode(null);
          setFirstBlockPoint(null);
          return;
        }
      }

      const statusToApply = roadStatusMode === 'clear' ? null : roadStatusMode;
      setBlockedEdges(current => {
        const newSet = new Set(current);
        edgesToModify.forEach(id => statusToApply === 'block' ? newSet.add(id) : newSet.delete(id));
        return newSet;
      });
      setTrafficJamEdges(current => {
        const newSet = new Set(current);
        edgesToModify.forEach(id => statusToApply === 'traffic' ? newSet.add(id) : newSet.delete(id));
        return newSet;
      });
      
      resetVisualization();
      alert(`✓ Applied ${roadStatusMode} to ${edgesToModify.size} road segment(s).`);
      setFirstBlockNode(null);
      setFirstBlockPoint(null);
      return;
    }

    if (mode === 'select') {
      const result = findNearestEdgeAndProjection(latlng.lat, latlng.lng, graph);
      if (!result) {
        alert("No road found near this location.");
        return;
      }
      const clickPoint = { lat: latlng.lat, lng: latlng.lng, projection: result.projection };
      if (!startPoint) setStartPoint(clickPoint);
      else if (!endPoint) setEndPoint(clickPoint);
      else {
        setStartPoint(clickPoint);
        setEndPoint(null);
        resetVisualization();
      }
    }
  };

  const runAStar = async () => {
    if (!startPoint || !endPoint) return;
    setIsRunning(true);
    setIsComplete(false);
    setIsPaused(false);

    // A* algorithm logic (as it was before)
    const augmentedNodes = [...graph.nodes];
    const augmentedEdges = [...graph.edges];
    const startVirtualId = 'virtual_start';
    const endVirtualId = 'virtual_end';

    // Add virtual start node and edges
    const startEdgeInfo = findNearestEdgeAndProjection(startPoint.lat, startPoint.lng, graph);
    augmentedNodes.push({ id: startVirtualId, lat: startPoint.lat, lng: startPoint.lng });
    if (startEdgeInfo) {
        augmentedEdges.push({id: "v_s_1", from: startVirtualId, to: startEdgeInfo.edge.from, distance: haversineDistance(startPoint.lat, startPoint.lng, graph.nodes.find(n=>n.id===startEdgeInfo.edge.from).lat, graph.nodes.find(n=>n.id===startEdgeInfo.edge.from).lng), bidirectional: true});
        augmentedEdges.push({id: "v_s_2", from: startVirtualId, to: startEdgeInfo.edge.to, distance: haversineDistance(startPoint.lat, startPoint.lng, graph.nodes.find(n=>n.id===startEdgeInfo.edge.to).lat, graph.nodes.find(n=>n.id===startEdgeInfo.edge.to).lng), bidirectional: true});
    }

    // Add virtual end node and edges
    const endEdgeInfo = findNearestEdgeAndProjection(endPoint.lat, endPoint.lng, graph);
    augmentedNodes.push({ id: endVirtualId, lat: endPoint.lat, lng: endPoint.lng });
    if (endEdgeInfo) {
        augmentedEdges.push({id: "v_e_1", from: endVirtualId, to: endEdgeInfo.edge.from, distance: haversineDistance(endPoint.lat, endPoint.lng, graph.nodes.find(n=>n.id===endEdgeInfo.edge.from).lat, graph.nodes.find(n=>n.id===endEdgeInfo.edge.from).lng), bidirectional: true});
        augmentedEdges.push({id: "v_e_2", from: endVirtualId, to: endEdgeInfo.edge.to, distance: haversineDistance(endPoint.lat, endPoint.lng, graph.nodes.find(n=>n.id===endEdgeInfo.edge.to).lat, graph.nodes.find(n=>n.id===endEdgeInfo.edge.to).lng), bidirectional: true});
    }

    const startTime = Date.now();
    const openSet = new Set([startVirtualId]);
    const cameFrom = new Map();
    const gScore = new Map([[startVirtualId, 0]]);
    const heuristic = (nodeId) => {
        const node = augmentedNodes.find(n => n.id === nodeId);
        return node ? haversineDistance(node.lat, node.lng, endPoint.lat, endPoint.lng) : 0;
    };
    const fScore = new Map([[startVirtualId, heuristic(startVirtualId)]]);
    let nodesExplored = 0;

    while (openSet.size > 0) {
        if (isPaused) { await new Promise(r => setTimeout(r, 100)); continue; }

        let current = null;
        let lowestF = Infinity;
        openSet.forEach(nodeId => {
            const score = fScore.get(nodeId) || Infinity;
            if (score < lowestF) {
                lowestF = score;
                current = nodeId;
            }
        });

        if (current === endVirtualId) {
            const path = [];
            let temp = current;
            while (temp) { path.unshift(temp); temp = cameFrom.get(temp); }
            const pathCoords = path.map(id => {
                const node = augmentedNodes.find(n => n.id === id);
                return node ? [node.lat, node.lng] : null;
            }).filter(Boolean);

            setPathData(pathCoords);
            setStats({
                distance: Math.round(gScore.get(current) || 0),
                nodesExplored,
                pathLength: path.length,
                executionTime: Date.now() - startTime
            });
            setIsRunning(false);
            setIsComplete(true);
            return;
        }

        openSet.delete(current);
        nodesExplored++;

         const neighbors = [];
        augmentedEdges.forEach(edge => {
            if (blockedEdges.has(edge.id)) return;

            let weight = edge.distance;
            if (trafficJamEdges.has(edge.id)) weight *= 3;

            // This is the corrected logic.
            // It explicitly checks the direction and the 'bidirectional' flag.
            if (edge.from === current) {
                // Always allow travel from 'from' to 'to'
                neighbors.push({ id: edge.to, cost: weight });
            } else if (edge.to === current && edge.bidirectional === true) {
                // Only allow reverse travel if the edge is explicitly bidirectional
                neighbors.push({ id: edge.from, cost: weight });
            }
        });
        
        for (const neighbor of neighbors) {
            const tentativeGScore = (gScore.get(current) || 0) + neighbor.cost;
            if (tentativeGScore < (gScore.get(neighbor.id) || Infinity)) {
                cameFrom.set(neighbor.id, current);
                gScore.set(neighbor.id, tentativeGScore);
                fScore.set(neighbor.id, tentativeGScore + heuristic(neighbor.id));
                openSet.add(neighbor.id);
            }
        }
        await new Promise(r => setTimeout(r, 101 - speed));
    }
    alert('No path found!');
    setIsRunning(false);
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white shadow-md p-4 z-10">
        {/* All UI Controls (buttons, stats, etc.) go here */}
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-800">A* Pathfinding</h1>
            <div className="flex gap-2">
              <button onClick={loadGraph} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">Load from Backend</button>
              <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-2"><Upload size={16} /> Upload JSON
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
          {uploadedFileName && <div className="mb-2 text-sm text-green-600">Loaded: {uploadedFileName}</div>}
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex gap-2">
              <button onClick={() => { setMode('select'); setFirstBlockNode(null); }} disabled={isRunning} className={`px-4 py-2 rounded font-semibold ${mode === 'select' ? 'bg-green-600 text-white' : 'bg-gray-200'} disabled:opacity-50`}>Select Start/End</button>
              <button onClick={() => { setMode('road-status'); setFirstBlockNode(null); }} disabled={isRunning} className={`px-4 py-2 rounded flex items-center gap-2 font-semibold ${mode === 'road-status' ? 'bg-red-600 text-white' : 'bg-gray-200'} disabled:opacity-50`}><Ban size={16} />Road Status</button>
            </div>
            {mode === 'road-status' && (
              <div className="flex gap-2 items-center bg-gray-100 px-3 py-2 rounded">
                <span className="text-sm font-medium">Apply:</span>
                <button onClick={() => { setRoadStatusMode("block"); setFirstBlockNode(null); }} className={`px-3 py-1.5 rounded text-sm font-semibold ${roadStatusMode === 'block' ? 'bg-red-600 text-white' : 'bg-white border'}`}>🚫 Block</button>
                <button onClick={() => { setRoadStatusMode("traffic"); setFirstBlockNode(null); }} className={`px-3 py-1.5 rounded text-sm font-semibold ${roadStatusMode === 'traffic' ? 'bg-orange-500 text-white' : 'bg-white border'}`}>🚗 Traffic Jam</button>
                <button onClick={() => { setRoadStatusMode("clear"); setFirstBlockNode(null); }} className={`px-3 py-1.5 rounded text-sm font-semibold ${roadStatusMode === 'clear' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>✓ Clear</button>
              </div>
            )}
            {(blockedEdges.size > 0 || trafficJamEdges.size > 0) && <button onClick={clearAlteredRoads} disabled={isRunning} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold flex items-center gap-1"><Trash2 size={14} />Clear All ({blockedEdges.size + trafficJamEdges.size})</button>}
            <div className="flex items-center gap-2">
              <label className="text-sm">Speed:</label>
              <input type="range" min="1" max="100" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} disabled={isRunning} className="w-32" />
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={runAStar} disabled={!startPoint || !endPoint || isRunning} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:bg-gray-400 flex items-center gap-2"><Play size={16} /> Start A*</button>
              <button onClick={() => setIsPaused(!isPaused)} disabled={!isRunning} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded disabled:bg-gray-400 flex items-center gap-2"><Pause size={16} /> {isPaused ? 'Resume' : 'Pause'}</button>
              <button onClick={handleReset} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-2"><RotateCcw size={16} /> Reset</button>
            </div>
          </div>
          <div className="mt-3 flex gap-6 text-sm text-gray-600 flex-wrap">
            <span>Graph: {graph.nodes.length} nodes, {graph.edges.length} edges</span>
            <span>Start: {startPoint ? `(${startPoint.lat.toFixed(5)}, ${startPoint.lng.toFixed(5)})` : "None"}</span>
            <span>End: {endPoint ? `(${endPoint.lat.toFixed(5)}, ${endPoint.lng.toFixed(5)})` : "None"}</span>
            <span>Distance: {stats.distance}m</span>
            <span>Path Length: {stats.pathLength} nodes</span>
            <span>Explored: {stats.nodesExplored} nodes</span>
            <span>Time: {stats.executionTime}ms</span>
            {blockedEdges.size > 0 && <span className="text-red-600">Blocked: {blockedEdges.size}</span>}
            {trafficJamEdges.size > 0 && <span className="text-orange-600">Traffic: {trafficJamEdges.size}</span>}
          </div>
          {/* Instructions */}
          {mode === 'select' && <div className="mt-2 text-sm text-blue-600 font-medium">{!startPoint ? '📍 Click map to set START' : !endPoint ? '📍 Click map to set END' : '✓ Ready to run A*'}</div>}
          {mode === 'road-status' && <div className="mt-2 text-sm text-red-600 font-medium">{!firstBlockNode ? 'Step 1: Click the START of the road segment' : 'Step 2: Click the END of the road segment'}</div>}
        </div>
      </div>
      <div className="flex-1">
        {/* The MapView component is rendered here, passing down all necessary data */}
        <MapView
          graph={graph}
          pathData={pathData}
          startPoint={startPoint}
          endPoint={endPoint}
          blockedEdges={blockedEdges}
          trafficJamEdges={trafficJamEdges}
          firstBlockPoint={firstBlockPoint}
          roadStatusMode={roadStatusMode}
          isComplete={isComplete}
          onMapClick={handleMapClick}
        />
      </div>
    </div>
  );
};

export default PathfindingDashboard;