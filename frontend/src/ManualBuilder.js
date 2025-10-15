import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMapEvents, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Save, Trash2, Download, Upload, Undo } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// --- ICON SETUP (UNCHANGED) ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png', iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png' });
const nodeIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png', iconSize: [15, 25], iconAnchor: [7, 25], popupAnchor: [1, -20] });
const selectedIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png', iconSize: [20, 33], iconAnchor: [10, 33], popupAnchor: [1, -28] });

function MapClickHandler({ mode, onAddNode }) {
  useMapEvents({ click: (e) => { if (mode === 'add-node') onAddNode(e.latlng); } });
  return null;
}

// --- MAIN COMPONENT ---
function ManualGraphBuilder() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [mode, setMode] = useState('view');
  const [selectedNode, setSelectedNode] = useState(null);
  const [firstNode, setFirstNode] = useState(null);
  const [history, setHistory] = useState([]);
  const [isBidirectional, setIsBidirectional] = useState(true);

  const HANOI_CENTER = [21.0285, 105.8542];

  useEffect(() => {
    fetch('http://localhost:5000/api/graph/load')
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load'))
      .then(data => {
        if (data.nodes) setNodes(data.nodes);
        if (data.edges) setEdges(data.edges);
      })
      .catch(() => console.log('No saved graph found.'));
  }, []);

  const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; const phi1 = lat1 * Math.PI / 180; const phi2 = lat2 * Math.PI / 180; const dphi = (lat2 - lat1) * Math.PI / 180; const dlambda = (lon2 - lon1) * Math.PI / 180; const a = Math.sin(dphi/2)**2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda/2)**2; const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); return R * c;
  };

  const saveState = () => setHistory([...history, { nodes, edges }]);
  const undo = () => { if (history.length > 0) { const prev = history[history.length - 1]; setNodes(prev.nodes); setEdges(prev.edges); setHistory(history.slice(0, -1)); } };

  const addNode = (latlng) => {
    saveState();
    const newNode = { id: Date.now(), lat: latlng.lat, lng: latlng.lng, name: `Node ${nodes.length + 1}` };
    setNodes([...nodes, newNode]);
  };

  const deleteNode = (nodeId) => {
    saveState();
    setNodes(nodes.filter(n => n.id !== nodeId));
    setEdges(edges.filter(e => e.from !== nodeId && e.to !== nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
  };

  const handleNodeClick = (node) => {
    if (mode === 'add-edge') {
      if (!firstNode) {
        setFirstNode(node);
      } else if (firstNode.id !== node.id) {
        const existingEdge = edges.find(e => (e.from === firstNode.id && e.to === node.id) || (e.from === node.id && e.to === firstNode.id));
        if (existingEdge) {
          alert('An edge already exists between these two nodes.');
          setFirstNode(null);
          return;
        }

        saveState();
        const distance = haversine(firstNode.lat, firstNode.lng, node.lat, node.lng);
        const newEdge = { id: Date.now(), from: firstNode.id, to: node.id, distance: Math.round(distance), bidirectional: isBidirectional };
        setEdges([...edges, newEdge]);
        setFirstNode(node);
      }
    } else {
      setSelectedNode(selectedNode?.id === node.id ? null : node);
    }
  };

  const deleteEdge = (edgeId) => { saveState(); setEdges(edges.filter(e => e.id !== edgeId)); };

  const exportGraph = () => {
    const dataStr = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manual_graph.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- START: Added Function for Importing Graph ---
  const importGraph = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.nodes || !data.edges) {
          throw new Error("Invalid graph format. File must contain 'nodes' and 'edges' arrays.");
        }
        saveState();
        setNodes(data.nodes);
        setEdges(data.edges);
        alert(`Successfully imported graph with ${data.nodes.length} nodes and ${data.edges.length} edges.`);
      } catch (err) {
        alert("Error reading file: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };
  // --- END: Added Function for Importing Graph ---

  const saveToBackend = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/graph/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes, edges }) });
      if (res.ok) alert('Graph saved!'); else alert('Save failed.');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="bg-white shadow-md p-4">
        {/* Header and Controls */}
        <h1 className="text-2xl font-bold mb-4">Manual Graph Builder</h1>
        <div className="flex gap-4 items-center flex-wrap">
          <button onClick={() => { setMode('view'); setFirstNode(null); }} className={`px-4 py-2 rounded ${mode === 'view' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>View</button>
          <button onClick={() => { setMode('add-node'); setFirstNode(null); }} className={`px-4 py-2 rounded ${mode === 'add-node' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>Add Node</button>
          <button onClick={() => { setMode('add-edge'); setFirstNode(null); }} className={`px-4 py-2 rounded ${mode === 'add-edge' ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}>Add Edge</button>
          {mode === 'add-edge' && (
            <div className="flex items-center gap-4 px-3 py-2 bg-gray-100 rounded">
              <label><input type="radio" checked={isBidirectional} onChange={() => setIsBidirectional(true)} /> Two-way</label>
              <label><input type="radio" checked={!isBidirectional} onChange={() => setIsBidirectional(false)} /> One-way</label>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={undo} disabled={history.length === 0} title="Undo"><Undo size={20} /></button>
            <button onClick={saveToBackend} title="Save to Backend"><Save size={20} /></button>
            <button onClick={exportGraph} title="Export JSON"><Download size={20} /></button>
            
            {/* --- START: Added UI for Uploading Graph --- */}
            <label className="p-2 rounded bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer" title="Import JSON">
              <Upload size={20} />
              <input 
                type="file" 
                accept=".json" 
                onChange={importGraph} 
                className="hidden"
              />
            </label>
            {/* --- END: Added UI for Uploading Graph --- */}
            
          </div>
        </div>
        <div className="mt-3 text-sm text-gray-600">Nodes: {nodes.length} | Edges: {edges.length}{mode === 'add-edge' && firstNode && ` | Selected: ${firstNode.name}`}</div>
      </div>
      <div className="flex" style={{ height: 'calc(100vh - 150px)' }}>
        <div className="w-80 bg-white border-r overflow-y-auto p-4">
          <h3 className="font-bold mb-3">Nodes</h3>
          {nodes.map(node => (
            <div key={node.id} onClick={() => handleNodeClick(node)} className={`p-2 border rounded mb-2 ${selectedNode?.id === node.id ? 'bg-blue-100' : 'hover:bg-gray-50'}`}>
              <div className="font-medium">{node.name}</div>
              <button onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }} className="text-red-500 text-xs">Delete</button>
            </div>
          ))}
        </div>
        <div className="flex-1">
          <MapContainer center={HANOI_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapClickHandler mode={mode} onAddNode={addNode} />
            {edges.map(edge => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              const positions = [[fromNode.lat, fromNode.lng], [toNode.lat, toNode.lng]];

              return (
                <React.Fragment key={edge.id}>
                  <Polyline
                    positions={positions}
                    pathOptions={{ color: edge.bidirectional ? "#3B82F6" : "#EF4444", weight: 3 }}
                  >
                    <Popup>
                      Distance: {edge.distance}m ({edge.bidirectional ? 'Two-way' : 'One-way'})
                      <button onClick={() => deleteEdge(edge.id)} className="ml-4 text-red-500 font-bold">Delete</button>
                    </Popup>
                  </Polyline>
                  
                  {!edge.bidirectional && (
                    (() => {
                      const lat1 = positions[0][0], lng1 = positions[0][1];
                      const lat2 = positions[1][0], lng2 = positions[1][1];
                      const midLat = (lat1 + lat2) / 2;
                      const midLng = (lng1 + lng2) / 2;
                      const angle = Math.atan2(lat2 - lat1, lng2 - lng1);
                      const arrowLength = 0.0001;
                      const wingAngle = Math.PI / 6;
                      const wing1Lat = midLat - arrowLength * Math.sin(angle - wingAngle);
                      const wing1Lng = midLng - arrowLength * Math.cos(angle - wingAngle);
                      const wing2Lat = midLat - arrowLength * Math.sin(angle + wingAngle);
                      const wing2Lng = midLng - arrowLength * Math.cos(angle + wingAngle);
                      return (
                        <>
                          <Polyline positions={[[wing1Lat, wing1Lng], [midLat, midLng]]} pathOptions={{ color: "#EF4444", weight: 3 }} />
                          <Polyline positions={[[wing2Lat, wing2Lng], [midLat, midLng]]} pathOptions={{ color: "#EF4444", weight: 3 }} />
                        </>
                      );
                    })()
                  )}
                </React.Fragment>
              );
            })}
            {nodes.map(node => (
              <Marker key={node.id} position={[node.lat, node.lng]} icon={(selectedNode?.id === node.id || firstNode?.id === node.id) ? selectedIcon : nodeIcon} eventHandlers={{ click: () => handleNodeClick(node) }}>
                <Popup>{node.name}</Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
export default ManualGraphBuilder;