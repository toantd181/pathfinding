import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMapEvents,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Play, Pause, RotateCcw, Ban, Trash2, Upload } from "lucide-react";
import "leaflet/dist/leaflet.css";

/* -------------------- Defensive Leaflet icon handling -------------------- */
if (
  typeof L !== "undefined" &&
  L.Icon &&
  L.Icon.Default &&
  L.Icon.Default.prototype &&
  L.Icon.Default.prototype._getIconUrl
) {
  delete L.Icon.Default.prototype._getIconUrl;
}
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const startIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const endIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const poiIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [20, 33],
  iconAnchor: [10, 33],
});

/* ------------------------- Utilities ------------------------- */
const EPS = 1e-9;
const getEdgeKey = (a, b) => {
  const as = String(a);
  const bs = String(b);
  return [as, bs].sort().join("--");
};

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

/* ------------------------- Map panes component (create panes for z-order) ------------------------- */
function MapPanes() {
  const map = useMap();
  useEffectOnce(() => {
    if (!map) return;
    if (!map.getPane("pathPane")) {
      map.createPane("pathPane");
      map.getPane("pathPane").style.zIndex = 400; // path lower
    }
    if (!map.getPane("edgePane")) {
      map.createPane("edgePane");
      map.getPane("edgePane").style.zIndex = 500; // edges above path
    }
  }, [map]);
  return null;
}

/* small hook to run effect once even if lint complains */
function useEffectOnce(effect, deps) {
  // wrapper to mimic useEffect but avoid eslint disable above
  useEffect(effect, deps);
  // no return cleanup special handling here
}

/* ------------------------- MapClick handler ------------------------- */
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng),
  });
  return null;
}

/* ------------------------- Main component ------------------------- */
const PathfindingVisualizer = () => {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [blockedEdges, setBlockedEdges] = useState(new Set());
  const [trafficJamEdges, setTrafficJamEdges] = useState(new Set());
  const [mode, setMode] = useState("select");
  const [roadStatusMode, setRoadStatusMode] = useState(null);
  const [firstBlockNode, setFirstBlockNode] = useState(null); // { nodeId, lat, lng, edgeId, projection }
  const [firstBlockPoint, setFirstBlockPoint] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pathData, setPathData] = useState([]);
  const [stats, setStats] = useState({
    distance: 0,
    nodesExplored: 0,
    pathLength: 0,
    executionTime: 0,
  });
  const [speed, setSpeed] = useState(50);
  const [isComplete, setIsComplete] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");

  const tempGraphRef = useRef(null);
  const fileInputRef = useRef(null);
  const HANOI_CENTER = [21.0285, 105.8542];

  useEffect(() => {
    loadGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------- Load / Upload graph ------------------------- */
  const loadGraph = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/graph/load");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.nodes && data.nodes.length > 0) {
        setGraph(data);
        setUploadedFileName("");
        resetVisualization();
      }
    } catch (error) {
      console.error("Error loading graph from backend:", error);
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
        alert("Failed to parse JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  /* ------------------------- Helpers for geometry & graph mutations ------------------------- */
  const findNearestEdgeAndProjection = (clickedLat, clickedLng, graphArg = graph) => {
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

      const t = Math.max(
        0,
        Math.min(
          1,
          ((clickedLng - fromLng) * dx + (clickedLat - fromNode.lat) * dy) / lengthSquared
        )
      );

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

  const findNearestNodeOnEdge = (edge, lat, lng, graphArg = graph) => {
    const fromNode = graphArg.nodes.find((n) => n.id === edge.from);
    const toNode = graphArg.nodes.find((n) => n.id === edge.to);
    if (!fromNode || !toNode) return null;
    const fromLng = fromNode.lng ?? fromNode.lon;
    const toLng = toNode.lng ?? toNode.lon;
    const distToFrom = haversineDistance(lat, lng, fromNode.lat, fromLng);
    const distToTo = haversineDistance(lat, lng, toNode.lat, toLng);
    // if within 2 meters treat as endpoint
    if (distToFrom < 2) return fromNode;
    if (distToTo < 2) return toNode;
    return null;
  };

  const splitEdgeAtSync = (prevGraph, edgeId, projection, prevBlockedSet, prevTrafficSet) => {
  const edge = prevGraph.edges.find((e) => e.id === edgeId);
  if (!edge) return { newNodeId: null, newGraph: prevGraph, newBlockedSet: new Set(prevBlockedSet), newTrafficSet: new Set(prevTrafficSet) };

  const t = projection.t ?? 0;
  if (t <= EPS) return { newNodeId: edge.from, newGraph: prevGraph, newBlockedSet: new Set(prevBlockedSet), newTrafficSet: new Set(prevTrafficSet) };
  if (t >= 1 - EPS) return { newNodeId: edge.to, newGraph: prevGraph, newBlockedSet: new Set(prevBlockedSet), newTrafficSet: new Set(prevTrafficSet) };

  const newNodeId = `${edge.id}_p_${Math.round(t * 1e6).toString(36)}`;

  if (prevGraph.nodes.some((n) => n.id === newNodeId)) {
    return { newNodeId, newGraph: prevGraph, newBlockedSet: new Set(prevBlockedSet), newTrafficSet: new Set(prevTrafficSet) };
  }

  const fromNode = prevGraph.nodes.find((n) => n.id === edge.from);
  const toNode = prevGraph.nodes.find((n) => n.id === edge.to);
  if (!fromNode || !toNode) return { newNodeId: null, newGraph: prevGraph, newBlockedSet: new Set(prevBlockedSet), newTrafficSet: new Set(prevTrafficSet) };

  const newNode = {
    id: newNodeId,
    lat: projection.lat,
    lng: projection.lng,
    name: `${fromNode.name || edge.from}↔${toNode.name || edge.to} (split)`,
    isPOI: false,
  };

  const fromLng = fromNode.lng ?? fromNode.lon;
  const toLng = toNode.lng ?? toNode.lon;
  const distA = haversineDistance(fromNode.lat, fromLng, newNode.lat, newNode.lng);
  const distB = haversineDistance(newNode.lat, newNode.lng, toNode.lat, toLng);

  const e1 = {
    id: `${edge.id}_a`,
    from: edge.from,
    to: newNodeId,
    distance: Math.max(1, Math.round(distA)),
    bidirectional: edge.bidirectional !== false,
  };
  const e2 = {
    id: `${edge.id}_b`,
    from: newNodeId,
    to: edge.to,
    distance: Math.max(1, Math.round(distB)),
    bidirectional: edge.bidirectional !== false,
  };

  const newNodes = [...prevGraph.nodes, newNode];
  const newEdges = prevGraph.edges.filter((e) => e.id !== edge.id).concat([e1, e2]);
  const newGraph = { nodes: newNodes, edges: newEdges };

  // propagate status by EDGE ID (not by pair key)
  const newBlocked = new Set(prevBlockedSet);
  const newTraffic = new Set(prevTrafficSet);
  if (newBlocked.has(edge.id)) {
    newBlocked.delete(edge.id);
    newBlocked.add(e1.id);
    newBlocked.add(e2.id);
  }
  if (newTraffic.has(edge.id)) {
    newTraffic.delete(edge.id);
    newTraffic.add(e1.id);
    newTraffic.add(e2.id);
  }

  return {
    newNodeId,
    newGraph,
    newBlockedSet: newBlocked,
    newTrafficSet: newTraffic,
  };
};

  // BFS ignoring direction (treat graph as undirected) — used for blocking path between two points
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

  // Apply status on provided graph (mark ALL edges between each node pair)
  const applyStatusToPathOnGraph = (graphArg, nodePath, status, prevBlockedSet, prevTrafficSet) => {
  if (!nodePath || nodePath.length < 2) return { affected: 0, newBlocked: new Set(prevBlockedSet), newTraffic: new Set(prevTrafficSet) };
  const newBlocked = new Set(prevBlockedSet);
  const newTraffic = new Set(prevTrafficSet);
  let affected = 0;

  for (let i = 0; i < nodePath.length - 1; i++) {
    const a = nodePath[i];
    const b = nodePath[i + 1];

    // take ALL edges connecting a and b
    const edgesBetween = graphArg.edges.filter(
      (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a)
    );

    for (const edge of edgesBetween) {
      // clear previous
      newBlocked.delete(edge.id);
      newTraffic.delete(edge.id);
      // apply
      if (status === "block") newBlocked.add(edge.id);
      else if (status === "traffic") newTraffic.add(edge.id);
      affected++;
    }
  }

  return { affected, newBlocked, newTraffic };
};

const toggleEdgeStatusByEdgeId = (edgeId, status) => {
    // Use functional updates for robustness
    setBlockedEdges(currentBlocked => {
      const newBlocked = new Set(currentBlocked);
      if (status === "block") {
        newBlocked.add(edgeId);
      } else {
        newBlocked.delete(edgeId);
      }
      return newBlocked;
    });

    setTrafficJamEdges(currentTraffic => {
      const newTraffic = new Set(currentTraffic);
      if (status === "traffic") {
        newTraffic.add(edgeId);
      } else {
        newTraffic.delete(edgeId);
      }
      return newTraffic;
    });

    resetVisualization();
  };


  const handleMapClick = (latlng) => {
    if (isRunning) return;

    if (mode === "road-status" && roadStatusMode) {
      const result = findNearestEdgeAndProjection(latlng.lat, latlng.lng, graph);
      if (!result) {
        alert("No road found near this location. Click closer to a road.");
        return;
      }
      const clickedEdge = result.edge;

      if (!firstBlockNode) {
        setFirstBlockNode({
          edgeId: clickedEdge.id,
          from: clickedEdge.from,
          to: clickedEdge.to,
        });
        setFirstBlockPoint({ lat: latlng.lat, lng: latlng.lng });
        return;
      }

      // On the second click, gather all edges to be modified
      const startEdgeInfo = firstBlockNode;
      const endEdgeInfo = {
        edgeId: clickedEdge.id,
        from: clickedEdge.from,
        to: clickedEdge.to,
      };

      const edgesToModify = new Set();

      if (startEdgeInfo.edgeId === endEdgeInfo.edgeId) {
        edgesToModify.add(startEdgeInfo.edgeId);
      } else {
        const pathNodes = findPathBetweenNodesUndirected(graph, startEdgeInfo.to, endEdgeInfo.from) 
                       || findPathBetweenNodesUndirected(graph, startEdgeInfo.from, endEdgeInfo.to)
                       || findPathBetweenNodesUndirected(graph, startEdgeInfo.to, endEdgeInfo.to)
                       || findPathBetweenNodesUndirected(graph, startEdgeInfo.from, endEdgeInfo.from);

        if (pathNodes && pathNodes.length > 0) {
          edgesToModify.add(startEdgeInfo.edgeId);
          edgesToModify.add(endEdgeInfo.edgeId);
          
          for (let i = 0; i < pathNodes.length - 1; i++) {
            const a = pathNodes[i];
            const b = pathNodes[i+1];
            const edgesBetween = graph.edges.filter(
              (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a)
            );
            edgesBetween.forEach(e => edgesToModify.add(e.id));
          }
        } else {
          alert("No path found between the two selected roads. Operation aborted.");
          setFirstBlockNode(null);
          setFirstBlockPoint(null);
          return;
        }
      }

      // Apply the status change using the robust functional update pattern
      const statusToApply = roadStatusMode === 'clear' ? null : roadStatusMode;

      setBlockedEdges(currentBlocked => {
        const newBlocked = new Set(currentBlocked);
        edgesToModify.forEach(edgeId => {
            if (statusToApply === "block") newBlocked.add(edgeId);
            else newBlocked.delete(edgeId);
        });
        return newBlocked;
      });

      setTrafficJamEdges(currentTraffic => {
        const newTraffic = new Set(currentTraffic);
        edgesToModify.forEach(edgeId => {
            if (statusToApply === "traffic") newTraffic.add(edgeId);
            else newTraffic.delete(edgeId);
        });
        return newTraffic;
      });
      
      resetVisualization();
      alert(`✓ Applied ${roadStatusMode} to ${edgesToModify.size} road segment(s).`);

      setFirstBlockNode(null);
      setFirstBlockPoint(null);
      return;
    }

    // --- SELECTING START/END (UNCHANGED) ---
    if (mode === "select") {
      const result = findNearestEdgeAndProjection(latlng.lat, latlng.lng);
      if (!result) {
        alert("No road found near this location. Click closer to a road.");
        return;
      }

      const clickPoint = {
        lat: latlng.lat,
        lng: latlng.lng,
        projection: result.projection,
      };

      if (!startPoint) setStartPoint(clickPoint);
      else if (!endPoint) setEndPoint(clickPoint);
      else {
        setStartPoint(clickPoint);
        setEndPoint(null);
        resetVisualization();
      }
    }
  };

  /* ------------------------- A* algorithm (recompute nearest edges from current graph) ------------------------- */
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

    const startVirtualId = "virtual_start";
    const endVirtualId = "virtual_end";

    // build augmented nodes/edges based on CURRENT graph state (important!)
    const augmentedNodes = [...graph.nodes];
    const augmentedEdges = [...graph.edges];

    // recompute nearest edges/projections for start and end on current graph
    const startEdgeInfo = findNearestEdgeAndProjection(startPoint.lat, startPoint.lng, graph);
    const endEdgeInfo = findNearestEdgeAndProjection(endPoint.lat, endPoint.lng, graph);

    augmentedNodes.push({
      id: startVirtualId,
      lat: startPoint.lat,
      lng: startPoint.lng,
      name: "Start Point",
    });

    if (startEdgeInfo && startEdgeInfo.edge) {
      const startEdge = startEdgeInfo.edge;
      const startFrom = graph.nodes.find((n) => n.id === startEdge.from);
      const startTo = graph.nodes.find((n) => n.id === startEdge.to);
      if (startFrom && startTo) {
        const startFromLng = startFrom.lng ?? startFrom.lon;
        const startToLng = startTo.lng ?? startTo.lon;
        const distToFrom = haversineDistance(startPoint.lat, startPoint.lng, startFrom.lat, startFromLng);
        const distToTo = haversineDistance(startPoint.lat, startPoint.lng, startTo.lat, startToLng);
        augmentedEdges.push({
          id: "virtual_start_from",
          from: startVirtualId,
          to: startEdge.from,
          distance: distToFrom,
          bidirectional: true,
        });
        augmentedEdges.push({
          id: "virtual_start_to",
          from: startVirtualId,
          to: startEdge.to,
          distance: distToTo,
          bidirectional: true,
        });
      }
    }

    augmentedNodes.push({
      id: endVirtualId,
      lat: endPoint.lat,
      lng: endPoint.lng,
      name: "End Point",
    });

    if (endEdgeInfo && endEdgeInfo.edge) {
      const endEdge = endEdgeInfo.edge;
      const endFrom = graph.nodes.find((n) => n.id === endEdge.from);
      const endTo = graph.nodes.find((n) => n.id === endEdge.to);
      if (endFrom && endTo) {
        const endFromLng = endFrom.lng ?? endFrom.lon;
        const endToLng = endTo.lng ?? endTo.lon;
        const distToFrom = haversineDistance(endPoint.lat, endPoint.lng, endFrom.lat, endFromLng);
        const distToTo = haversineDistance(endPoint.lat, endPoint.lng, endTo.lat, endToLng);
        augmentedEdges.push({
          id: "virtual_end_from",
          from: endVirtualId,
          to: endEdge.from,
          distance: distToFrom,
          bidirectional: true,
        });
        augmentedEdges.push({
          id: "virtual_end_to",
          from: endVirtualId,
          to: endEdge.to,
          distance: distToTo,
          bidirectional: true,
        });
      }
    }

    const startTime = Date.now();
    const openSet = new Set([startVirtualId]);
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map([[startVirtualId, 0]]);

    const heuristicFunc = (nodeId) => {
      const node = augmentedNodes.find((n) => n.id === nodeId);
      if (!node) return 0;
      const nodeLng = node.lng ?? node.lon;
      return haversineDistance(node.lat, nodeLng, endPoint.lat, endPoint.lng);
    };

    const fScore = new Map([[startVirtualId, heuristicFunc(startVirtualId)]]);
    let nodesExplored = 0;

    const getAugmentedNeighbors = (nodeId) => {
  const neighbors = [];
  for (const edge of augmentedEdges) {
    const edgeIdStr = String(edge.id ?? "");
    // check blocked by edge.id
    if (blockedEdges.has(edge.id) && !edgeIdStr.startsWith("virtual_")) continue;

    let weight = edge.distance ?? 1;
    if (trafficJamEdges.has(edge.id)) weight *= 3;

    if (edge.from === nodeId) neighbors.push({ id: edge.to, cost: weight });
    else if (edge.to === nodeId && edge.bidirectional !== false) neighbors.push({ id: edge.from, cost: weight });
  }
  return neighbors;
};


    while (openSet.size > 0) {
      while (isPaused) await new Promise((r) => setTimeout(r, 100));

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
        const distance = gScore.get(current) || 0;
        const executionTime = Date.now() - startTime;

        const pathCoords = path
          .map((nodeId) => {
            const node = augmentedNodes.find((n) => n.id === nodeId);
            if (!node) return null;
            const lng = node.lng ?? node.lon;
            return [node.lat, lng];
          })
          .filter(Boolean);

        setPathData(pathCoords);
        setStats({
          distance: Math.round(distance),
          nodesExplored,
          pathLength: path.length,
          executionTime,
        });

        setIsRunning(false);
        setIsComplete(true);
        return;
      }

      openSet.delete(current);
      closedSet.add(current);

      await new Promise((r) => setTimeout(r, Math.max(1, 101 - speed)));

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
      executionTime: Date.now() - startTime,
    });
    setIsRunning(false);
    alert("No path found! Try unblocking some roads.");
  };

  /* ------------------------- Reset / UI helpers ------------------------- */
  const resetVisualization = () => {
    setPathData([]);
    setStats({
      distance: 0,
      nodesExplored: 0,
      pathLength: 0,
      executionTime: 0,
    });
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

  /* ------------------------- Rendering helpers ------------------------- */
  const pathEdgeSet = useMemo(() => {
    const set = new Set();
    if (pathData.length > 1) {
      for (let i = 0; i < pathData.length - 1; i++) {
        const from = pathData[i];
        const to = pathData[i + 1];
        for (const edge of graph.edges) {
          const fromNode = graph.nodes.find((n) => n.id === edge.from);
          const toNode = graph.nodes.find((n) => n.id === edge.to);
          if (!fromNode || !toNode) continue;
          const fromLng = fromNode.lng ?? fromNode.lon;
          const toLng = toNode.lng ?? toNode.lon;
          if (
            (Math.abs(fromNode.lat - from[0]) < 1e-6 &&
              Math.abs(fromLng - from[1]) < 1e-6 &&
              Math.abs(toNode.lat - to[0]) < 1e-6 &&
              Math.abs(toLng - to[1]) < 1e-6) ||
            (Math.abs(toNode.lat - from[0]) < 1e-6 &&
              Math.abs(toLng - from[1]) < 1e-6 &&
              Math.abs(fromNode.lat - to[0]) < 1e-6 &&
              Math.abs(fromLng - to[1]) < 1e-6)
          ) {
            set.add(edge.id);
          }
        }
      }
    }
    return set;
  }, [pathData, graph.edges, graph.nodes]);

  const edgeLines = graph.edges
    .map((edge) => {
      const fromNode = graph.nodes.find((n) => n.id === edge.from);
      const toNode = graph.nodes.find((n) => n.id === edge.to);
      if (!fromNode || !toNode) return null;
      const fromLng = fromNode.lng ?? fromNode.lon;
      const toLng = toNode.lng ?? toNode.lon;
      const isBlocked = blockedEdges.has(edge.id);
      const isTrafficJam = trafficJamEdges.has(edge.id);
      const isInPath = pathEdgeSet.has(edge.id);
      return {
        ...edge,
        positions: [
          [fromNode.lat, fromLng],
          [toNode.lat, toLng],
        ],
        isBlocked,
        isTrafficJam,
        isInPath,
      };
    })
    .filter(Boolean);

  const poiNodes = graph.nodes.filter((n) => n.isPOI);

  /* ------------------------- JSX ------------------------- */
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white shadow-md p-4 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-800">
              A* Pathfinding Visualizer (fixed)
            </h1>
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
            <div className="mb-2 text-sm text-green-600">Loaded: {uploadedFileName}</div>
          )}

          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMode("select");
                  setFirstBlockNode(null);
                  setRoadStatusMode(null);
                }}
                disabled={isRunning}
                className={`px-4 py-2 rounded font-semibold ${
                  mode === "select" ? "bg-green-600 text-white" : "bg-gray-200"
                } disabled:opacity-50`}
              >
                Select Start/End
              </button>
              <button
                onClick={() => {
                  setMode("road-status");
                  setFirstBlockNode(null);
                  if (!roadStatusMode) setRoadStatusMode("block");
                }}
                disabled={isRunning}
                className={`px-4 py-2 rounded flex items-center gap-2 font-semibold ${
                  mode === "road-status" ? "bg-red-600 text-white" : "bg-gray-200"
                } disabled:opacity-50`}
              >
                <Ban size={16} />
                Road Status
              </button>
            </div>

            {mode === "road-status" && (
              <div className="flex gap-2 items-center bg-gray-100 px-3 py-2 rounded">
                <span className="text-sm text-gray-700 font-medium">Apply:</span>
                <button
                  onClick={() => {
                    setRoadStatusMode("block");
                    setFirstBlockNode(null);
                    setFirstBlockPoint(null);
                  }}
                  className={`px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1 ${
                    roadStatusMode === "block"
                      ? "bg-red-600 text-white"
                      : "bg-white border border-gray-300"
                  }`}
                >
                  🚫 Block Road
                </button>
                <button
                  onClick={() => {
                    setRoadStatusMode("traffic");
                    setFirstBlockNode(null);
                    setFirstBlockPoint(null);
                  }}
                  className={`px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1 ${
                    roadStatusMode === "traffic"
                      ? "bg-orange-500 text-white"
                      : "bg-white border border-gray-300"
                  }`}
                >
                  🚗 Traffic Jam
                </button>
                <button
                  onClick={() => {
                    setRoadStatusMode("clear");
                    setFirstBlockNode(null);
                    setFirstBlockPoint(null);
                  }}
                  className={`px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1 ${
                    roadStatusMode === "clear"
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-300"
                  }`}
                >
                  ✓ Clear Status
                </button>
              </div>
            )}

            {(blockedEdges.size > 0 || trafficJamEdges.size > 0) && (
              <button
                onClick={clearBlockedRoads}
                disabled={isRunning}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold flex items-center gap-1"
              >
                <Trash2 size={14} />
                Clear All ({blockedEdges.size + trafficJamEdges.size})
              </button>
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
                <Play size={16} /> Start A*
              </button>
              <button
                onClick={() => setIsPaused(!isPaused)}
                disabled={!isRunning}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded disabled:bg-gray-400 flex items-center gap-2"
              >
                <Pause size={16} /> {isPaused ? "Resume" : "Pause"}
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-2"
              >
                <RotateCcw size={16} /> Reset
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-6 text-sm text-gray-600">
            <span>
              Graph: {graph.nodes?.length || 0} nodes, {graph.edges?.length || 0} edges
            </span>
            <span>
              Start:{" "}
              {startPoint ? `(${startPoint.lat.toFixed(5)}, ${startPoint.lng.toFixed(5)})` : "None"}
            </span>
            <span>
              End:{" "}
              {endPoint ? `(${endPoint.lat.toFixed(5)}, ${endPoint.lng.toFixed(5)})` : "None"}
            </span>
            <span>Distance: {stats.distance}m</span>
            <span>Path Length: {stats.pathLength} nodes</span>
            <span>Explored: {stats.nodesExplored} nodes</span>
            <span>Time: {stats.executionTime}ms</span>
            {blockedEdges.size > 0 && <span className="text-red-600">Blocked: {blockedEdges.size} roads</span>}
            {trafficJamEdges.size > 0 && <span className="text-yellow-600">Traffic Jam: {trafficJamEdges.size} roads</span>}
          </div>

          {mode === "select" && (
            <div className="mt-2 text-sm">
              <span className="text-blue-600 font-medium">
                {!startPoint && "📍 Click on the map to set START point"}
                {startPoint && !endPoint && "📍 Click on the map to set END point"}
                {startPoint && endPoint && '✓ Ready! Click "Start A*" to find path'}
              </span>
            </div>
          )}
          {mode === "road-status" && (
            <div className="mt-2 text-sm">
              <span className={`font-medium ${roadStatusMode === "block" ? "text-red-600" : roadStatusMode === "traffic" ? "text-orange-600" : "text-blue-600"}`}>
                {!firstBlockNode && `Step 1: Click near the FIRST point on the road`}
                {firstBlockNode && `Step 2: Click near the SECOND point to apply ${roadStatusMode === "block" ? "🚫 Block" : roadStatusMode === "traffic" ? "🚗 Traffic Jam" : "✓ Clear"} (Selected: ${firstBlockNode?.nodeId || ""})`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1">
        {graph.nodes.length > 0 ? (
          <MapContainer center={HANOI_CENTER} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapPanes />

            <MapClickHandler onMapClick={handleMapClick} />

            {/* DRAW PATH FIRST (thin & semi-transparent) so blocked edges drawn after will appear fully red */}
            {pathData.length > 0 && (
              <Polyline
                positions={pathData}
                color={isComplete ? "#16a34a" : "#eab308"}
                weight={4}
                opacity={0.6}
                dashArray={isComplete ? undefined : "6,4"}
                pane="pathPane"
              />
            )}

            {edgeLines.map((edge) => (
              <Polyline
                key={edge.id}
                positions={edge.positions}
                color={edge.isBlocked ? "#dc2626" : edge.isTrafficJam ? "#f97316" : edge.isInPath ? "#22c55e" : "#94a3b8"}
                weight={edge.isBlocked ? 8 : edge.isTrafficJam ? 6 : edge.isInPath ? 6 : 3}
                opacity={edge.isBlocked || edge.isTrafficJam || edge.isInPath ? 0.95 : 0.7}
                dashArray={edge.isTrafficJam ? "8,4" : undefined}
                pane="edgePane"
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-medium mb-2">
                      {edge.isBlocked && <span className="text-red-600">🚫 Blocked Road</span>}
                      {edge.isTrafficJam && <span className="text-orange-600">🚗 Traffic Jam (3x slower)</span>}
                      {!edge.isBlocked && !edge.isTrafficJam && (edge.bidirectional === false ? "One-way road" : "Two-way road")}
                    </div>
                    <div className="text-gray-600 mb-2">Distance: {edge.distance}m</div>
                    <div className="flex flex-col gap-1">
                      {edge.isBlocked && <button onClick={() => toggleEdgeStatusByEdgeId(edge.id, null)} className="px-3 py-1 rounded text-xs bg-green-500 hover:bg-green-600 text-white">Clear Block</button>}
                      {edge.isTrafficJam && <button onClick={() => toggleEdgeStatusByEdgeId(edge.id, null)} className="px-3 py-1 rounded text-xs bg-green-500 hover:bg-green-600 text-white">Clear Traffic Jam</button>}
                    </div>
                  </div>
                </Popup>
              </Polyline>
            ))}

            {poiNodes.map((node) => (
              <Marker key={node.id} position={[node.lat, node.lng ?? node.lon]} icon={poiIcon}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold">{node.name}</div>
                    <div className="text-gray-600">POI</div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {mode === "road-status" && firstBlockPoint && firstBlockNode && (
              <Marker
                position={[firstBlockPoint.lat, firstBlockPoint.lng]}
                icon={
                  new L.Icon({
                    iconUrl:
                      roadStatusMode === "block"
                        ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png"
                        : roadStatusMode === "traffic"
                        ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png"
                        : "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
                    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                  })
                }
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold">First Point Selected</div>
                    <div className="text-gray-600">{firstBlockNode.nodeId}</div>
                    <div className="text-xs text-gray-500 mt-1">Click second point to apply</div>
                  </div>
                </Popup>
              </Marker>
            )}

            {startPoint && (
              <Marker position={[startPoint.lat, startPoint.lng]} icon={startIcon}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold text-green-700">Start Point</div>
                    <div>({startPoint.lat.toFixed(5)}, {startPoint.lng.toFixed(5)})</div>
                  </div>
                </Popup>
              </Marker>
            )}
            {endPoint && (
              <Marker position={[endPoint.lat, endPoint.lng]} icon={endIcon}>
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
              <p className="text-gray-600 mb-4">Load a graph from backend or upload a JSON file to start</p>
              <div className="flex gap-2 justify-center">
                <button onClick={loadGraph} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Load from Backend</button>
                <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded cursor-pointer">
                  Upload JSON
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
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
