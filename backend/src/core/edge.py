"""
Edge class representing connections between nodes in the road network
"""

from typing import Dict, Optional
from dataclasses import dataclass, field
from enum import Enum


class RoadType(Enum):
    """Common road types from OpenStreetMap"""
    MOTORWAY = "motorway"
    TRUNK = "trunk"
    PRIMARY = "primary"
    SECONDARY = "secondary"
    TERTIARY = "tertiary"
    RESIDENTIAL = "residential"
    SERVICE = "service"
    FOOTWAY = "footway"
    CYCLEWAY = "cycleway"
    PATH = "path"
    UNKNOWN = "unknown"


@dataclass
class Edge:
    """
    Represents an edge (road segment) between two nodes
    
    Attributes:
        from_node_id: Starting node ID
        to_node_id: Ending node ID
        weight: Edge weight (distance in meters)
        road_type: Type of road (highway classification)
        max_speed: Maximum speed limit (km/h)
        tags: Additional properties from OSM
        bidirectional: Whether traffic can flow both ways
        name: Street/road name
    """
    
    from_node_id: int
    to_node_id: int
    weight: float
    road_type: RoadType = RoadType.UNKNOWN
    max_speed: Optional[int] = None
    tags: Dict[str, str] = field(default_factory=dict)
    bidirectional: bool = True
    name: Optional[str] = None
    
    def __post_init__(self):
        """Initialize default values and validate"""
        if self.weight < 0:
            raise ValueError("Edge weight cannot be negative")
        
        if self.from_node_id == self.to_node_id:
            raise ValueError("Edge cannot connect a node to itself")
    
    def travel_time(self, speed_kmh: Optional[float] = None) -> float:
        """
        Calculate travel time for this edge
        
        Args:
            speed_kmh: Speed in km/h. If None, uses max_speed or default
            
        Returns:
            Travel time in seconds
        """
        if speed_kmh is None:
            speed_kmh = self.max_speed or self.get_default_speed()
        
        # Convert weight (meters) to km and calculate time
        distance_km = self.weight / 1000.0
        time_hours = distance_km / speed_kmh
        return time_hours * 3600  # Convert to seconds
    
    def get_default_speed(self) -> float:
        """Get default speed based on road type (km/h)"""
        speed_map = {
            RoadType.MOTORWAY: 120,
            RoadType.TRUNK: 100,
            RoadType.PRIMARY: 80,
            RoadType.SECONDARY: 60,
            RoadType.TERTIARY: 50,
            RoadType.RESIDENTIAL: 30,
            RoadType.SERVICE: 20,
            RoadType.FOOTWAY: 5,
            RoadType.CYCLEWAY: 15,
            RoadType.PATH: 5,
            RoadType.UNKNOWN: 50
        }
        return speed_map.get(self.road_type, 50)
    
    def is_highway(self) -> bool:
        """Check if this is a major highway"""
        return self.road_type in [RoadType.MOTORWAY, RoadType.TRUNK, RoadType.PRIMARY]
    
    def allows_cars(self) -> bool:
        """Check if cars are allowed on this road"""
        car_allowed = [
            RoadType.MOTORWAY, RoadType.TRUNK, RoadType.PRIMARY,
            RoadType.SECONDARY, RoadType.TERTIARY, RoadType.RESIDENTIAL,
            RoadType.SERVICE
        ]
        return self.road_type in car_allowed
    
    def __str__(self) -> str:
        direction = "⟷" if self.bidirectional else "→"
        name_str = f" ({self.name})" if self.name else ""
        return f"Edge({self.from_node_id} {direction} {self.to_node_id}: {self.weight:.1f}m{name_str})"
