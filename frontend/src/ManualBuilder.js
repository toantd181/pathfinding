import React, { useState, useEffect, useRef, Fragment } from 'react';
import { MapContainer, TileLayer, useMapEvents, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Save, Trash2, Download, Upload, Undo } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const nodeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [15, 25],
  iconAnchor: [7, 25],
  popupAnchor: [1, -20],
  shadowSize: [25, 25]
});

const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -28],
  shadowSize: [33, 33]
});

function MapClickHandler({ mode, onAddNode, onSelectNode }) {
  useMapEvents({
    click: (e) => {
      if (mode === 'add-node') {
        onAddNode(e.latlng);
      }
    },
  });
  return null;
}

function ManualGraphBuilder() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [mode, setMode] = useState('view'); // view, add-node, add-edge
  const [selectedNode, setSelectedNode] = useState(null);
  const [firstNode, setFirstNode] = useState(null);
  const [nodeName, setNodeName] = useState('');
  const [history, setHistory] = useState([]);
  const [isBidirectional, setIsBidirectional] = useState(true); // New state for road type
  const [editingNode, setEditingNode] = useState(null); // For editing node details
  const [editName, setEditName] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');

  const HANOI_CENTER = [21.0285, 105.8542];

  // Auto-load saved graph from backend on component mount
  useEffect(() => {
    fetch('http://localhost:5000/api/graph/load')
      .then(r => r.json())
      .then(data => {
        if (data.nodes && data.nodes.length > 0) {
          setNodes(data.nodes);
          setEdges(data.edges || []);
          console.log(`Loaded ${data.nodes.length} nodes and ${data.edges?.length || 0} edges from backend`);
        }
      })
      .catch(err => console.log('No saved graph found, starting fresh'));
  }, []);

  // Import POIs as nodes
  const importPOIs = async () => {
    try {
      const response = await fetch('/pois.json');
      const data = await response.json();
      
      if (data.pois) {
        saveState();
        const poiNodes = data.pois.map(poi => ({
          id: poi.id,
          lat: poi.lat,
          lng: poi.lon,
          name: poi.name,
          created: new Date().toISOString(),
          isPOI: true
        }));
        setNodes([...nodes, ...poiNodes]);
        alert(`Imported ${poiNodes.length} POI nodes`);
      }
    } catch (err) {
      alert('Failed to load POIs');
    }
  };

  // Calculate distance between two points
  const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dphi = (lat2 - lat1) * Math.PI / 180;
    const dlambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dphi/2) * Math.sin(dphi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(dlambda/2) * Math.sin(dlambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const saveState = () => {
    setHistory([...history, { nodes: [...nodes], edges: [...edges] }]);
  };

  const undo = () => {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      setNodes(previous.nodes);
      setEdges(previous.edges);
      setHistory(history.slice(0, -1));
    }
  };

  const addNode = (latlng) => {
    saveState();
    const newNode = {
      id: Date.now(),
      lat: latlng.lat,
      lng: latlng.lng,
      name: nodeName || `Node ${nodes.length + 1}`,
      created: new Date().toISOString()
    };
    setNodes([...nodes, newNode]);
    setNodeName('');
    // Don't change mode - stay in add-node mode
  };

  const deleteNode = (nodeId) => {
    saveState();
    setNodes(nodes.filter(n => n.id !== nodeId));
    setEdges(edges.filter(e => e.from !== nodeId && e.to !== nodeId));
    setSelectedNode(null);
    setEditingNode(null);
  };

  const startEditNode = (node) => {
    setEditingNode(node);
    setEditName(node.name);
    setEditLat(node.lat.toString());
    setEditLng(node.lng.toString());
  };

  const saveNodeEdit = () => {
    if (!editingNode) return;
    
    saveState();
    setNodes(nodes.map(n => 
      n.id === editingNode.id 
        ? { ...n, name: editName, lat: parseFloat(editLat), lng: parseFloat(editLng) }
        : n
    ));
    setEditingNode(null);
    setSelectedNode(null);
  };

  const cancelEdit = () => {
    setEditingNode(null);
  };

  const handleNodeClick = (node) => {
    if (mode === 'add-edge') {
      if (!firstNode) {
        setFirstNode(node);
      } else if (firstNode.id !== node.id) {
        saveState();
        const distance = haversine(firstNode.lat, firstNode.lng, node.lat, node.lng);
        
        if (isBidirectional) {
          // Two-way road: A <-> B
          const newEdge = {
            id: Date.now(),
            from: firstNode.id,
            to: node.id,
            distance: Math.round(distance),
            bidirectional: true
          };
          setEdges([...edges, newEdge]);
        } else {
          // One-way road: A -> B only
          const newEdge = {
            id: Date.now(),
            from: firstNode.id,
            to: node.id,
            distance: Math.round(distance),
            bidirectional: false
          };
          setEdges([...edges, newEdge]);
        }
        
        setFirstNode(null);
        // Stay in add-edge mode for continuous edge creation
      }
    } else {
      setSelectedNode(selectedNode?.id === node.id ? null : node);
    }
  };

  const deleteEdge = (edgeId) => {
    saveState();
    setEdges(edges.filter(e => e.id !== edgeId));
  };

  const exportGraph = () => {
    const data = {
      nodes,
      edges,
      metadata: {
        created: new Date().toISOString(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hanoi_manual_graph_v1.json';
    a.click();
  };

  const importGraph = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          saveState();
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
        } catch (err) {
          alert('Invalid file format');
        }
      };
      reader.readAsText(file);
    }
  };

  const saveToBackend = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/graph/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      if (response.ok) {
        alert('Graph saved to backend!');
      } else {
        alert('Failed to save');
      }
    } catch (err) {
      alert('Backend not available. Use Export instead.');
    }
  };

  // Get edge lines for display
  const edgeLines = edges.map(edge => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    if (fromNode && toNode) {
      return {
        ...edge,
        positions: [
          [fromNode.lat, fromNode.lng],
          [toNode.lat, toNode.lng]
        ]
      };
    }
    return null;
  }).filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-md p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Manual Graph Builder - Hanoi Roads</h1>
          
          <div className="flex gap-4 items-center flex-wrap">
            {/* Mode Selection */}
            <div className="flex gap-2">
              <button
                onClick={() => { setMode('view'); setFirstNode(null); }}
                className={`px-4 py-2 rounded ${mode === 'view' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                View Mode
              </button>
              <button
                onClick={() => { setMode('add-node'); setFirstNode(null); }}
                className={`px-4 py-2 rounded ${mode === 'add-node' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
              >
                Add Node
              </button>
              <button
                onClick={() => { setMode('add-edge'); setFirstNode(null); }}
                className={`px-4 py-2 rounded ${mode === 'add-edge' ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
              >
                Add Edge
              </button>
            </div>

            {/* Node Name Input */}
            {mode === 'add-node' && (
              <input
                type="text"
                placeholder="Node name (optional)"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                className="px-3 py-2 border rounded"
              />
            )}

            {/* Road Type Selection */}
            {mode === 'add-edge' && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={isBidirectional}
                    onChange={() => setIsBidirectional(true)}
                    className="cursor-pointer"
                  />
                  <span className="text-sm">Two-way (A ↔ B)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!isBidirectional}
                    onChange={() => setIsBidirectional(false)}
                    className="cursor-pointer"
                  />
                  <span className="text-sm">One-way (A → B)</span>
                </label>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={importPOIs}
                className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                title="Import POIs as nodes"
              >
                Import POIs
              </button>
              <button
                onClick={undo}
                disabled={history.length === 0}
                className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                title="Undo"
              >
                <Undo size={20} />
              </button>
              <button
                onClick={saveToBackend}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                title="Save to Backend"
              >
                <Save size={20} />
              </button>
              <button
                onClick={exportGraph}
                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                title="Export JSON"
              >
                <Download size={20} />
              </button>
              <label className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 cursor-pointer">
                <Upload size={20} className="inline" />
                <input type="file" accept=".json" onChange={importGraph} className="hidden" />
              </label>
            </div>
          </div>

          {/* Status */}
          <div className="mt-3 text-sm text-gray-600 flex gap-6">
            <span>Nodes: {nodes.length}</span>
            <span>Edges: {edges.length}</span>
            {mode === 'add-edge' && firstNode && (
              <span className="text-purple-600 font-medium">
                Selected: {firstNode.name} - Click another node to connect
              </span>
            )}
            {mode === 'add-node' && (
              <span className="text-green-600 font-medium">
                Click on map to add node
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Map and Sidebar */}
      <div className="flex" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Sidebar */}
        <div className="w-80 bg-white border-r overflow-y-auto p-4">
          <h3 className="font-bold mb-3">Nodes ({nodes.length})</h3>
          <div className="space-y-2">
            {nodes.map(node => (
              <div
                key={node.id}
                className={`p-3 border rounded ${
                  selectedNode?.id === node.id ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'
                }`}
              >
                {editingNode?.id === node.id ? (
                  // Edit mode
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="Node name"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.00001"
                        value={editLat}
                        onChange={(e) => setEditLat(e.target.value)}
                        className="w-1/2 px-2 py-1 border rounded text-xs"
                        placeholder="Latitude"
                      />
                      <input
                        type="number"
                        step="0.00001"
                        value={editLng}
                        onChange={(e) => setEditLng(e.target.value)}
                        className="w-1/2 px-2 py-1 border rounded text-xs"
                        placeholder="Longitude"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveNodeEdit}
                        className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 px-2 py-1 bg-gray-300 rounded text-xs hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div onClick={() => setSelectedNode(node)} className="cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{node.name}</div>
                        <div className="text-xs text-gray-500">
                          {node.lat.toFixed(5)}, {node.lng.toFixed(5)}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Connections: {edges.filter(e => e.from === node.id || e.to === node.id).length}
                          {node.isPOI && <span className="ml-2 text-indigo-600">📍 POI</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            saveState();
                            setNodes(nodes.map(n => n.id === node.id ? {...n, isPOI: !n.isPOI} : n));
                          }}
                          className={`text-xs px-2 py-1 rounded ${node.isPOI ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}
                          title={node.isPOI ? 'Remove POI status' : 'Mark as POI'}
                        >
                          {node.isPOI ? '★ POI' : '☆ POI'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditNode(node); }}
                          className="text-blue-500 hover:text-blue-700 text-xs px-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (window.confirm(`Delete node "${node.name}"?\nThis will also delete all connected edges.`)) {
                              deleteNode(node.id);
                            }
                          }}
                          className="text-red-500 hover:text-red-700 text-xs px-2"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedNode && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-bold mb-2">Connected Edges</h3>
              {edges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).map(edge => {
                const isOutgoing = edge.from === selectedNode.id;
                const other = nodes.find(n => 
                  n.id === (isOutgoing ? edge.to : edge.from)
                );
                return (
                  <div key={edge.id} className="p-2 bg-gray-50 rounded mb-2 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={edge.bidirectional ? 'text-blue-600' : 'text-red-600'}>
                          {edge.bidirectional ? '↔' : (isOutgoing ? '→' : '←')} {other?.name}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {edge.distance}m {!edge.bidirectional && '(one-way)'}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteEdge(edge.id)}
                        className="text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1">
          <MapContainer
            center={HANOI_CENTER}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler
              mode={mode}
              onAddNode={addNode}
              onSelectNode={handleNodeClick}
            />

            {/* Draw edges */}
            {edgeLines.map(edge => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              
              return (
                <React.Fragment key={edge.id}>
                  <Polyline
                    positions={edge.positions}
                    color={edge.bidirectional ? "#3B82F6" : "#EF4444"}
                    weight={3}
                    opacity={0.7}
                    eventHandlers={{
                      click: () => {
                        if (window.confirm(`Delete this ${edge.bidirectional ? 'two-way' : 'one-way'} edge?\n${fromNode?.name} → ${toNode?.name}\nDistance: ${edge.distance}m`)) {
                          deleteEdge(edge.id);
                        }
                      }
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-medium">
                          {edge.bidirectional ? 'Two-way road' : 'One-way road'}
                        </div>
                        <div className="text-gray-600">
                          Distance: {edge.distance}m
                        </div>
                        {!edge.bidirectional && (
                          <div className="text-red-600 text-xs mt-1">
                            Direction: {fromNode?.name} → {toNode?.name}
                          </div>
                        )}
                        <button
                          onClick={() => deleteEdge(edge.id)}
                          className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 w-full"
                        >
                          Delete Edge
                        </button>
                      </div>
                    </Popup>
                  </Polyline>
                  
                  {/* Arrow for one-way roads */}
                  {!edge.bidirectional && edge.positions.length === 2 && (
                    (() => {
                      // Calculate midpoint and direction
                      const lat1 = edge.positions[0][0];
                      const lng1 = edge.positions[0][1];
                      const lat2 = edge.positions[1][0];
                      const lng2 = edge.positions[1][1];
                      
                      // Midpoint
                      const midLat = (lat1 + lat2) / 2;
                      const midLng = (lng1 + lng2) / 2;
                      
                      // Direction vector
                      const dLat = lat2 - lat1;
                      const dLng = lng2 - lng1;
                      const distance = Math.sqrt(dLat * dLat + dLng * dLng);
                      
                      // Normalized direction
                      const normLat = dLat / distance;
                      const normLng = dLng / distance;
                      
                      // Perpendicular vector (for arrow wings)
                      const perpLat = -normLng;
                      const perpLng = normLat;
                      
                      // Arrow size (adjust based on zoom level)
                      const arrowSize = 0.0003;
                      const arrowWidth = 0.0002;
                      
                      // Arrow tip
                      const tipLat = midLat + normLat * arrowSize;
                      const tipLng = midLng + normLng * arrowSize;
                      
                      // Arrow wings
                      const wing1Lat = midLat - normLat * arrowSize * 0.5 + perpLat * arrowWidth;
                      const wing1Lng = midLng - normLng * arrowSize * 0.5 + perpLng * arrowWidth;
                      const wing2Lat = midLat - normLat * arrowSize * 0.5 - perpLat * arrowWidth;
                      const wing2Lng = midLng - normLng * arrowSize * 0.5 - perpLng * arrowWidth;
                      
                      return (
                        <>
                          {/* Arrow line 1 */}
                          <Polyline
                            positions={[
                              [wing1Lat, wing1Lng],
                              [tipLat, tipLng]
                            ]}
                            color="#EF4444"
                            weight={3}
                            opacity={1}
                          />
                          {/* Arrow line 2 */}
                          <Polyline
                            positions={[
                              [wing2Lat, wing2Lng],
                              [tipLat, tipLng]
                            ]}
                            color="#EF4444"
                            weight={3}
                            opacity={1}
                          />
                        </>
                      );
                    })()
                  )}
                </React.Fragment>
              );
            })}

            {/* Draw nodes */}
            {nodes.map(node => (
              <Marker
                key={node.id}
                position={[node.lat, node.lng]}
                icon={selectedNode?.id === node.id ? selectedIcon : nodeIcon}
                eventHandlers={{
                  click: () => handleNodeClick(node)
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold">{node.name}</div>
                    <div className="text-gray-600">
                      ({node.lat.toFixed(5)}, {node.lng.toFixed(5)})
                    </div>
                    <div className="text-gray-500 mt-1">
                      Connections: {edges.filter(e => e.from === node.id || e.to === node.id).length}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default ManualGraphBuilder;