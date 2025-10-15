// MapView.js
import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Defensive default icon handling
if (typeof L !== "undefined" && L.Icon && L.Icon.Default && L.Icon.Default.prototype && L.Icon.Default.prototype._getIconUrl) {
  delete L.Icon.Default.prototype._getIconUrl;
}
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// This component gets the map instance and passes it up to the parent.
function MapInstance({ onMapReady }) {
    const map = useMap();
    useEffect(() => {
        if (map) {
            onMapReady(map);
        }
    }, [map, onMapReady]);
    return null;
}

function MapPanes() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane("pathPane")) {
      map.createPane("pathPane");
      map.getPane("pathPane").style.zIndex = 400;
    }
    if (!map.getPane("edgePane")) {
      map.createPane("edgePane");
      map.getPane("edgePane").style.zIndex = 500;
    }
  }, [map]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng),
  });
  return null;
}

export default function MapView({
  HANOI_CENTER,
  edgeLines,
  pathData,
  isComplete,
  poiNodes,
  startPoint,
  endPoint,
  firstBlockPoint,
  mode,
  roadStatusMode,
  onMapClick,
  startIcon,
  endIcon,
  poiIcon,
  onMapReady, // Receive the callback prop
}) {
  return (
    <MapContainer center={HANOI_CENTER} zoom={13} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapPanes />
      <MapClickHandler onMapClick={onMapClick} />
      <MapInstance onMapReady={onMapReady} /> {/* Add this component */}

      {pathData.length > 0 && (
        <Polyline
          positions={pathData}
          color={isComplete ? "#16a34a" : "#eab308"}
          weight={4}
          opacity={0.6}
          pane="pathPane"
        />
      )}

      {edgeLines.map((edge) => {
        const idStr = String(edge.id);
        const color = edge.isBlocked ? "#dc2626" : edge.isTrafficJam ? "#f97316" : edge.isInPath ? "#22c55e" : "#94a3b8";
        const weight = edge.isBlocked ? 8 : edge.isTrafficJam ? 6 : edge.isInPath ? 6 : 3;
        const opacity = edge.isBlocked || edge.isTrafficJam || edge.isInPath ? 0.95 : 0.7;
        const dash = edge.isTrafficJam ? "8,4" : undefined;
        return (
          <Polyline
            key={idStr}
            positions={edge.positions}
            color={color}
            weight={weight}
            opacity={opacity}
            dashArray={dash}
            pane="edgePane"
          >
            <Popup>
              <div className="text-sm">
                <div className="font-medium mb-2">
                  {edge.isBlocked && <span className="text-red-600">🚫 Blocked</span>}
                  {edge.isTrafficJam && <span className="text-orange-600">🚗 Traffic</span>}
                  {!edge.isBlocked && !edge.isTrafficJam && (edge.bidirectional ? "Two-way" : "One-way")}
                </div>
                <div>Dist: {edge.distance}m</div>
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {poiNodes.map((node) => (
        <Marker key={String(node.id)} position={[node.lat, node.lng]} icon={poiIcon}>
          <Popup>{node.name}</Popup>
        </Marker>
      ))}

      {mode === "road-status" && firstBlockPoint && (
        <Marker
          position={[firstBlockPoint.lat, firstBlockPoint.lng]}
          icon={
            new L.Icon({
              iconUrl: roadStatusMode === "block" ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" : "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
              shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
              iconSize: [25, 41],
              iconAnchor: [12, 41],
            })
          }
        />
      )}

      {startPoint && (
        <Marker position={[startPoint.lat, startPoint.lng]} icon={startIcon}>
          <Popup>Start Point</Popup>
        </Marker>
      )}
      {endPoint && (
        <Marker position={[endPoint.lat, endPoint.lng]} icon={endIcon}>
          <Popup>End Point</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}