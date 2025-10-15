// PathfindingDashboard.js
import React, { useState, useEffect, useMemo, useCallback,useRef } from "react";
import { Play, Pause, RotateCcw, Ban, Trash2, Upload } from "lucide-react";
import MapView from "./MapView";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// --- IMPORT THE NEW LIBRARIES ---
import Graph from "graphology";
import { astar } from "graphology-shortest-path";

/* Icons for start/end/poi (unchanged) */
const startIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
const endIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
const poiIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [20, 33],
  iconAnchor: [10, 33],
});

const HANOI_CENTER = [21.0285, 105.8542];

const PathfindingDashboard = () => {
  // --- STATE MANAGEMENT: Use a single Graphology instance ---
  const [graph, setGraph] = useState(new Graph({ allowSelfLoops: false }));
  
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [blockedEdges, setBlockedEdges] = useState(new Set());
  const [trafficJamEdges, setTrafficJamEdges] = useState(new Set());
  const [mode, setMode] = useState("select");
  const [roadStatusMode, setRoadStatusMode] = useState(null);
  const [firstBlockPoint, setFirstBlockPoint] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pathData, setPathData] = useState([]);
  const [stats, setStats] = useState({ distance: 0, nodesExplored: 0, pathLength: 0, executionTime: 0 });
  const [speed, setSpeed] = useState(50);
  const [isComplete, setIsComplete] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [mapInstance, setMapInstance] = useState(null);
  const fileInputRef = useRef(null);

  const loadAndSetGraph = useCallback((data) => {
    if (!data.nodes || !data.edges) {
      alert('Invalid graph file format.');
      return;
    }
    const newGraph = new Graph({ allowSelfLoops: false });
    data.nodes.forEach(node => {
      newGraph.addNode(String(node.id), {
        lat: node.lat,
        lng: node.lng ?? node.lon,
        name: node.name,
        isPOI: node.isPOI,
      });
    });
    data.edges.forEach((edge, index) => {
      const from = String(edge.from);
      const to = String(edge.to);
      const edgeId = String(edge.id ?? `edge-${index}`);
      if (!newGraph.hasNode(from) || !newGraph.hasNode(to)) return;

      // Graphology handles one-way streets correctly with `addDirectedEdge`
      if (edge.bidirectional === false) {
        newGraph.addDirectedEdge(from, to, { id: edgeId, distance: edge.distance });
      } else {
        newGraph.addUndirectedEdge(from, to, { id: edgeId, distance: edge.distance });
      }
    });
    setGraph(newGraph);
    resetVisualization();
  }, []);

  useEffect(() => {
    const loadInitialGraph = async () => {
      try {
        const resp = await fetch("http://localhost:5000/api/graph/load");
        if (!resp.ok) throw new Error(resp.statusText);
        const data = await resp.json();
        loadAndSetGraph(data);
        setUploadedFileName("");
      } catch (e) {
        console.warn("loadGraph error", e);
      }
    };
    loadInitialGraph();
  }, [loadAndSetGraph]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        loadAndSetGraph(data);
        setUploadedFileName(file.name);
      } catch (err) {
        alert("JSON parse error: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
  
  const haversineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const findNearestNode = (lat, lng) => {
    let nearestNode = null;
    let minDistance = Infinity;
    graph.forEachNode((node, attributes) => {
        const dist = haversineDistance(lat, lng, attributes.lat, attributes.lng);
        if (dist < minDistance) {
            minDistance = dist;
            nearestNode = node;
        }
    });
    return { node: nearestNode, distance: minDistance };
  };

  const findEdgesAlongPath = (latlng1, latlng2) => {
    if (!mapInstance) {
      alert("Map is not fully initialized. Please wait a moment and try again.");
      return [];
    }
    const path = L.polyline([latlng1, latlng2]);
    const pathBounds = path.getBounds();
    const selectedEdges = new Set();
    const SELECTION_THRESHOLD_METERS = 15;

    graph.forEachEdge((edge, attributes, source, target) => {
        const sourcePos = graph.getNodeAttributes(source);
        const targetPos = graph.getNodeAttributes(target);
        const edgeLine = L.polyline([[sourcePos.lat, sourcePos.lng], [targetPos.lat, targetPos.lng]]);
        if (!pathBounds.intersects(edgeLine.getBounds())) return;

        for (let i = 0; i <= 5; i++) {
            const t = i / 5;
            const sampleLat = sourcePos.lat + t * (targetPos.lat - sourcePos.lat);
            const sampleLng = sourcePos.lng + t * (targetPos.lng - sourcePos.lng);
            if (L.GeometryUtil.distance(mapInstance, path, L.latLng(sampleLat, sampleLng)) < SELECTION_THRESHOLD_METERS) {
                selectedEdges.add(attributes.id);
                return;
            }
        }
    });
    return Array.from(selectedEdges);
  };
  
  const handleMapClick = (latlng) => {
    if (isRunning) return;
    if (mode === "road-status" && roadStatusMode) {
      if (!firstBlockPoint) {
        setFirstBlockPoint(latlng);
        return;
      }
      const edgeIdsToModify = findEdgesAlongPath(firstBlockPoint, latlng);
      if (edgeIdsToModify.length > 0) {
        const statusToApply = roadStatusMode === 'clear' ? null : roadStatusMode;
        const newBlocked = new Set(blockedEdges);
        const newTraffic = new Set(trafficJamEdges);
        edgeIdsToModify.forEach(idStr => {
          newBlocked.delete(idStr);
          newTraffic.delete(idStr);
          if (statusToApply === "block") newBlocked.add(idStr);
          else if (statusToApply === "traffic") newTraffic.add(idStr);
        });
        setBlockedEdges(newBlocked);
        setTrafficJamEdges(newTraffic);
        alert(`✓ Applied '${roadStatusMode}' to ${edgeIdsToModify.length} road segment(s).`);
      } else {
        alert("No road segments found between the selected points.");
      }
      setFirstBlockPoint(null);
      resetVisualization();
      return;
    }
    if (mode === "select") {
      const clickPoint = { lat: latlng.lat, lng: latlng.lng };
      if (!startPoint) setStartPoint(clickPoint);
      else if (!endPoint) setEndPoint(clickPoint);
      else {
        setStartPoint(clickPoint);
        setEndPoint(null);
        resetVisualization();
      }
    }
  };

  // --- RENDERING DATA: Generate arrays from the graph object for MapView ---
  const { edgeLines, poiNodes, nodeCount, edgeCount } = useMemo(() => {
    const edges = [];
    const pois = [];
    graph.forEachNode((node, attributes) => {
        if (attributes.isPOI) pois.push({ id: node, ...attributes });
    });
    graph.forEachEdge((edge, attributes, source, target, sourceAttributes, targetAttributes) => {
        const idStr = attributes.id;
        edges.push({
            id: idStr,
            positions: [[sourceAttributes.lat, sourceAttributes.lng], [targetAttributes.lat, targetAttributes.lng]],
            isBlocked: blockedEdges.has(idStr),
            isTrafficJam: trafficJamEdges.has(idStr),
            isInPath: false, // Will be updated later
            distance: attributes.distance,
            bidirectional: !graph.isDirected(edge),
        });
    });
    return { edgeLines: edges, poiNodes: pois, nodeCount: graph.order, edgeCount: graph.size };
  }, [graph, blockedEdges, trafficJamEdges]);

  const pathEdgeLines = useMemo(() => {
    if (!pathData.length) return edgeLines;
    const pathNodePairs = new Set();
    for(let i=0; i < pathData.length -1; i++){
        pathNodePairs.add([pathData[i], pathData[i+1]].sort().join('-'));
    }
    return edgeLines.map(edge => {
        const edgeNodePair = [graph.getNodeAttributes(graph.source(edge.id)).name, graph.getNodeAttributes(graph.target(edge.id)).name].sort().join('-');
        return { ...edge, isInPath: pathNodePairs.has(edgeNodePair) };
    });
  }, [pathData, edgeLines, graph]);


  // --- PATHFINDING: Replaced with a simple call to the Graphology library ---
  const runAStar = () => {
    if (!startPoint || !endPoint) return;
    
    const startNodeInfo = findNearestNode(startPoint.lat, startPoint.lng);
    const endNodeInfo = findNearestNode(endPoint.lat, endPoint.lng);

    if (!startNodeInfo.node || !endNodeInfo.node) {
        alert("Could not find a start or end node on the graph.");
        return;
    }

    const startTime = Date.now();
    let path = null;
    try {
        path = astar(
            graph,
            startNodeInfo.node,
            endNodeInfo.node,
            (edge, attributes) => { // Weight function
                if (blockedEdges.has(attributes.id)) return Infinity;
                const penalty = trafficJamEdges.has(attributes.id) ? 3 : 1;
                return attributes.distance * penalty;
            },
            (node) => { // Heuristic function
                const attrs = graph.getNodeAttributes(node);
                return haversineDistance(attrs.lat, attrs.lng, endPoint.lat, endPoint.lng);
            }
        );
    } catch (e) {
        console.error("A* error:", e);
    }
    
    const executionTime = Date.now() - startTime;

    if (!path || path.length === 0) {
      alert("No path found! The road may be blocked or disconnected.");
      setStats({ distance: 0, nodesExplored: 0, pathLength: 0, executionTime });
      return;
    }
    
    const pathCoords = path.map(nodeId => {
        const attrs = graph.getNodeAttributes(nodeId);
        return [attrs.lat, attrs.lng];
    });
    
    let totalDistance = 0;
    for(let i=0; i < path.length-1; i++){
        const edge = graph.edge(path[i], path[i+1]);
        if(edge) totalDistance += graph.getEdgeAttribute(edge, 'distance');
    }

    setPathData(pathCoords);
    setStats({ distance: Math.round(totalDistance), nodesExplored: 0, pathLength: path.length, executionTime });
    setIsComplete(true);
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

  const clearBlockedRoads = () => {
    setBlockedEdges(new Set());
    setTrafficJamEdges(new Set());
    resetVisualization();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white shadow-md p-4 z-10">
        {/* All UI Controls here are now simpler as they don't contain complex logic */}
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-800">A* Pathfinding Dashboard</h1>
            <div className="flex gap-2">
              <button onClick={() => loadAndSetGraph(graph.export())} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">Load from Backend</button>
              <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2">
                <Upload size={16} /> Upload JSON
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
          {uploadedFileName && <div className="mb-2 text-sm text-green-600">Loaded: {uploadedFileName}</div>}
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex gap-2">
              <button onClick={() => { setMode("select"); setFirstBlockPoint(null); }} className={`px-4 py-2 rounded font-semibold ${mode === "select" ? "bg-green-600 text-white" : "bg-gray-200"}`}>Select Start/End</button>
              <button onClick={() => { setMode("road-status"); setFirstBlockPoint(null); setRoadStatusMode("block"); }} className={`px-4 py-2 rounded flex items-center gap-2 font-semibold ${mode === "road-status" ? "bg-red-600 text-white" : "bg-gray-200"}`}><Ban size={16} /> Road Status</button>
            </div>
            {mode === "road-status" && (
              <div className="flex gap-2 items-center bg-gray-100 px-3 py-2 rounded">
                <span className="text-sm text-gray-700 font-medium">Apply:</span>
                <button onClick={() => setRoadStatusMode("block")} className={`px-3 py-1.5 rounded text-sm font-semibold ${roadStatusMode === "block" ? "bg-red-600 text-white" : "bg-white"}`}>🚫 Block</button>
                <button onClick={() => setRoadStatusMode("traffic")} className={`px-3 py-1.5 rounded text-sm font-semibold ${roadStatusMode === "traffic" ? "bg-orange-500 text-white" : "bg-white"}`}>🚗 Traffic</button>
                <button onClick={() => setRoadStatusMode("clear")} className={`px-3 py-1.5 rounded text-sm font-semibold ${roadStatusMode === "clear" ? "bg-blue-600 text-white" : "bg-white"}`}>✓ Clear</button>
              </div>
            )}
            {(blockedEdges.size > 0 || trafficJamEdges.size > 0) && <button onClick={clearBlockedRoads} className="px-3 py-1.5 bg-orange-500 text-white rounded text-sm font-semibold flex items-center gap-1"><Trash2 size={14} /> Clear All</button>}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Speed:</label>
              <input type="range" min="1" max="100" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-32" />
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={runAStar} disabled={!startPoint || !endPoint} className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400 flex items-center gap-2"><Play size={16} /> Start A*</button>
              <button onClick={handleReset} className="px-4 py-2 bg-red-600 text-white rounded flex items-center gap-2"><RotateCcw size={16} /> Reset</button>
            </div>
          </div>
          <div className="mt-3 flex gap-6 text-sm text-gray-600">
            <span>Graph: {nodeCount} nodes, {edgeCount} edges</span>
            <span>Start: {startPoint ? `(${startPoint.lat.toFixed(5)}, ${startPoint.lng.toFixed(5)})` : "None"}</span>
            <span>End: {endPoint ? `(${endPoint.lat.toFixed(5)}, ${endPoint.lng.toFixed(5)})` : "None"}</span>
            <span>Distance: {stats.distance}m</span>
            <span>Path Length: {stats.pathLength} nodes</span>
            <span>Explored: {stats.nodesExplored} nodes</span>
            <span>Time: {stats.executionTime}ms</span>
          </div>
        </div>
      </div>
      <div className="flex-1">
        {graph.order > 0 ? (
          <MapView
            HANOI_CENTER={HANOI_CENTER}
            edgeLines={pathEdgeLines}
            pathData={pathData}
            isComplete={isComplete}
            poiNodes={poiNodes}
            startPoint={startPoint}
            endPoint={endPoint}
            firstBlockPoint={firstBlockPoint}
            mode={mode}
            roadStatusMode={roadStatusMode}
            onMapClick={handleMapClick}
            startIcon={startIcon}
            endIcon={endIcon}
            poiIcon={poiIcon}
            onMapReady={setMapInstance}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100">
            <p>Loading graph...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PathfindingDashboard;