import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- LEAFLET ICON SETUP ---
if (typeof L !== 'undefined') {
  delete L.Icon.Default.prototype._getIconUrl;
}
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});
const startIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });
const endIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });
const poiIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png', iconSize: [20, 33], iconAnchor: [10, 33] });
const firstClickIcon = (mode) => new L.Icon({
    iconUrl: mode === 'block' ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png' :
             mode === 'traffic' ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png' :
             'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41],
});


// --- MAP HELPER COMPONENTS ---

function MapPanes() {
  const map = useMap();
  useEffect(() => {
    if (map) {
      if (!map.getPane('pathPane')) {
        map.createPane('pathPane');
        map.getPane('pathPane').style.zIndex = 400;
      }
      if (!map.getPane('edgePane')) {
        map.createPane('edgePane');
        map.getPane('edgePane').style.zIndex = 500;
      }
    }
  }, [map]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// --- MAIN DISPLAY COMPONENT ---

const MapView = ({ graph, pathData, startPoint, endPoint, blockedEdges, trafficJamEdges, firstBlockPoint, roadStatusMode, isComplete, onMapClick }) => {
  const HANOI_CENTER = [21.0285, 105.8542];

  const edgeLines = React.useMemo(() => {
    if (!graph.edges) return [];
    return graph.edges.map(edge => {
      const fromNode = graph.nodes.find(n => n.id === edge.from);
      const toNode = graph.nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) return null;
      return {
        ...edge,
        positions: [[fromNode.lat, fromNode.lng], [toNode.lat, toNode.lng]],
      };
    }).filter(Boolean);
  }, [graph.nodes, graph.edges]);

  const pathEdgeIds = React.useMemo(() => {
      const ids = new Set();
      if (pathData.length < 2) return ids;
      // This is a simplified check. A robust version would need to check node IDs.
      // For visualization, checking coordinates is often sufficient.
      for (const edge of edgeLines) {
          for(let i = 0; i < pathData.length - 1; i++) {
              const p1 = pathData[i];
              const p2 = pathData[i+1];
              const e1 = edge.positions[0];
              const e2 = edge.positions[1];
              if ((p1[0] === e1[0] && p1[1] === e1[1] && p2[0] === e2[0] && p2[1] === e2[1]) ||
                  (p1[0] === e2[0] && p1[1] === e2[1] && p2[0] === e1[0] && p2[1] === e1[1])) {
                  ids.add(edge.id);
              }
          }
      }
      return ids;
  }, [pathData, edgeLines]);


  return (
    <>
      {graph.nodes.length > 0 ? (
        <MapContainer center={HANOI_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapPanes />
          <MapClickHandler onMapClick={onMapClick} />
          
          {pathData.length > 0 && (
            <Polyline
              positions={pathData}
              color={isComplete ? '#16a34a' : '#eab308'}
              weight={5}
              opacity={0.7}
              pane="pathPane"
            />
          )}

          {edgeLines.map((edge) => {
            const isBlocked = blockedEdges.has(edge.id);
            const isTraffic = trafficJamEdges.has(edge.id);
            const isInPath = pathEdgeIds.has(edge.id);
            const color = isBlocked ? '#dc2626' : isTraffic ? '#f97316' : isInPath ? '#22c55e' : '#94a3b8';
            const weight = isBlocked ? 6 : isTraffic ? 5 : isInPath ? 5 : 3;
            const opacity = isBlocked || isTraffic || isInPath ? 0.9 : 0.6;
            
            return (
              <Polyline
                key={edge.id}
                positions={edge.positions}
                pathOptions={{ color, weight, opacity, dashArray: isTraffic ? '8, 8' : undefined }}
                pane="edgePane"
              />
            );
          })}
          
          {graph.nodes.filter(n => n.isPOI).map(node => (
            <Marker key={`poi-${node.id}`} position={[node.lat, node.lng]} icon={poiIcon}>
              <Popup>{node.name}</Popup>
            </Marker>
          ))}
          
          {startPoint && <Marker position={[startPoint.lat, startPoint.lng]} icon={startIcon}><Popup>Start Point</Popup></Marker>}
          {endPoint && <Marker position={[endPoint.lat, endPoint.lng]} icon={endIcon}><Popup>End Point</Popup></Marker>}
          {firstBlockPoint && <Marker position={[firstBlockPoint.lat, firstBlockPoint.lng]} icon={firstClickIcon(roadStatusMode)}><Popup>First point selected</Popup></Marker>}
        </MapContainer>
      ) : (
        <div className="flex items-center justify-center h-full bg-gray-100 text-gray-600">
          Loading graph or no graph data available...
        </div>
      )}
    </>
  );
};

export default MapView;