"""
Node class representing a point in the road network
Each node has coordinates and can store additional properties
"""

import math
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field


@dataclass
class Node:
    """
    Represents a node (intersection/point) in the road network
    
    Attributes:
        id: Unique identifier (can be OSM node ID or auto-generated)
        latitude: Latitude coordinate (WGS84)
        longitude: Longitude coordinate (WGS84)
        tags: Additional properties from OSM or custom data
        neighbors: List of connected nodes with edge weights
    """
    
    id: int
    latitude: float
    longitude: float
    tags: Dict[str, str] = field(default_factory=dict)
    neighbors: List[Tuple['Node', float]] = field(default_factory=list, repr=False)
    
    def __post_init__(self):
        """Validate coordinates after initialization"""
        if not (-90 <= self.latitude <= 90):
            raise ValueError(f"Invalid latitude: {self.latitude}. Must be between -90 and 90")
        if not (-180 <= self.longitude <= 180):
            raise ValueError(f"Invalid longitude: {self.longitude}. Must be between -180 and 180")
    
    def add_neighbor(self, neighbor: 'Node', weight: float) -> None:
        """
        Add a neighboring node with edge weight
        
        Args:
            neighbor: Connected node
            weight: Edge weight (typically distance in meters)
        """
        if weight < 0:
            raise ValueError("Edge weight cannot be negative")
        
        # Avoid duplicate neighbors
        for existing_neighbor, _ in self.neighbors:
            if existing_neighbor.id == neighbor.id:
                return
        
        self.neighbors.append((neighbor, weight))
    
    def remove_neighbor(self, neighbor_id: int) -> bool:
        """
        Remove a neighbor by ID
        
        Args:
            neighbor_id: ID of neighbor to remove
            
        Returns:
            True if neighbor was found and removed, False otherwise
        """
        original_length = len(self.neighbors)
        self.neighbors = [(n, w) for n, w in self.neighbors if n.id != neighbor_id]
        return len(self.neighbors) < original_length
    
    def get_neighbor_weight(self, neighbor_id: int) -> Optional[float]:
        """
        Get the weight of edge to a specific neighbor
        
        Args:
            neighbor_id: ID of neighbor node
            
        Returns:
            Edge weight or None if neighbor not found
        """
        for neighbor, weight in self.neighbors:
            if neighbor.id == neighbor_id:
                return weight
        return None
    
    def distance_to(self, other: 'Node') -> float:
        """
        Calculate Haversine distance to another node
        
        Args:
            other: Another node
            
        Returns:
            Distance in meters
        """
        from ..utils.geo_utils import haversine_distance
        return haversine_distance(
            self.latitude, self.longitude,
            other.latitude, other.longitude
        )
    
    def coordinates(self) -> Tuple[float, float]:
        """Return (latitude, longitude) tuple"""
        return (self.latitude, self.longitude)
    
    def is_intersection(self) -> bool:
        """Check if this node is an intersection (has multiple neighbors)"""
        return len(self.neighbors) > 2
    
    def is_dead_end(self) -> bool:
        """Check if this node is a dead end (has only one neighbor)"""
        return len(self.neighbors) == 1
    
    def __str__(self) -> str:
        return f"Node({self.id}, {self.latitude:.6f}, {self.longitude:.6f})"
    
    def __hash__(self) -> int:
        return hash(self.id)
    
    def __eq__(self, other) -> bool:
        if not isinstance(other, Node):
            return False
        return self.id == other.id

