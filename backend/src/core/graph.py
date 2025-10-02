# =====================================
# File: backend/src/core/graph.py (FIXED VERSION)
# =====================================

"""
Graph class representing the complete road network
Optimized for pathfinding operations with spatial indexing
FIXED: Handles large graphs without recursion errors
"""

from typing import Dict, List, Set, Tuple, Optional
import math
import pickle
import logging
import sys
from collections import defaultdict
from .node import Node
from .edge import Edge, RoadType


logger = logging.getLogger(__name__)


class Graph:
    """
    Road network graph optimized for pathfinding
    
    Features:
    - Fast node lookup by ID
    - Spatial indexing for nearest neighbor queries
    - Edge management with bidirectional support
    - Graph statistics and validation
    - Handles large graphs (50k+ nodes)
    """
    
    def __init__(self):
        self.nodes: Dict[int, Node] = {}
        self.edges: Dict[Tuple[int, int], Edge] = {}
        self._spatial_index: Dict[Tuple[int, int], Set[int]] = defaultdict(set)
        self._grid_size = 0.001  # ~100m grid cells for spatial indexing
        
        # Statistics
        self.stats = {
            'node_count': 0,
            'edge_count': 0,
            'intersection_count': 0,
            'dead_end_count': 0
        }
    
    def add_node(self, node: Node) -> None:
        """
        Add a node to the graph
        
        Args:
            node: Node to add
        """
        if node.id in self.nodes:
            logger.warning(f"Node {node.id} already exists, skipping")
            return
        
        self.nodes[node.id] = node
        self._add_to_spatial_index(node)
        self._update_stats()
    
    def add_edge(self, edge: Edge) -> None:
        """
        Add an edge to the graph
        
        Args:
            edge: Edge to add
        """
        # Validate that both nodes exist
        if edge.from_node_id not in self.nodes:
            raise ValueError(f"From node {edge.from_node_id} not found in graph")
        if edge.to_node_id not in self.nodes:
            raise ValueError(f"To node {edge.to_node_id} not found in graph")
        
        # Add edge to edge dictionary
        edge_key = (edge.from_node_id, edge.to_node_id)
        self.edges[edge_key] = edge
        
        # Add neighbor relationship to nodes
        from_node = self.nodes[edge.from_node_id]
        to_node = self.nodes[edge.to_node_id]
        from_node.add_neighbor(to_node, edge.weight)
        
        # If bidirectional, add reverse edge
        if edge.bidirectional:
            reverse_key = (edge.to_node_id, edge.from_node_id)
            if reverse_key not in self.edges:
                reverse_edge = Edge(
                    from_node_id=edge.to_node_id,
                    to_node_id=edge.from_node_id,
                    weight=edge.weight,
                    road_type=edge.road_type,
                    max_speed=edge.max_speed,
                    tags=edge.tags.copy(),
                    bidirectional=False,  # Avoid infinite recursion
                    name=edge.name
                )
                self.edges[reverse_key] = reverse_edge
                to_node.add_neighbor(from_node, edge.weight)
        
        self._update_stats()
    
    def get_node(self, node_id: int) -> Optional[Node]:
        """Get node by ID"""
        return self.nodes.get(node_id)
    
    def get_edge(self, from_id: int, to_id: int) -> Optional[Edge]:
        """Get edge between two nodes"""
        return self.edges.get((from_id, to_id))
    
    def get_neighbors(self, node_id: int) -> List[Tuple[Node, float]]:
        """
        Get all neighbors of a node
        
        Args:
            node_id: ID of the node
            
        Returns:
            List of (neighbor_node, edge_weight) tuples
        """
        node = self.get_node(node_id)
        return node.neighbors if node else []
    
    def find_nearest_node(self, lat: float, lon: float, max_distance: float = 1000) -> Optional[Node]:
        """
        Find the nearest node to given coordinates using spatial indexing
        
        Args:
            lat: Target latitude
            lon: Target longitude
            max_distance: Maximum search distance in meters
            
        Returns:
            Nearest node or None if none found within max_distance
        """
        from ..utils.geo_utils import haversine_distance
        
        best_node = None
        best_distance = float('inf')
        
        # Calculate search grid bounds
        lat_offset = (max_distance / 111111.0)  # Rough: 1 degree lat = 111km
        lon_offset = lat_offset / math.cos(math.radians(lat))
        
        # Search nearby grid cells
        for search_lat in [lat - lat_offset, lat, lat + lat_offset]:
            for search_lon in [lon - lon_offset, lon, lon + lon_offset]:
                grid_key = self._get_grid_key(search_lat, search_lon)
                
                for node_id in self._spatial_index.get(grid_key, set()):
                    node = self.nodes[node_id]
                    distance = haversine_distance(lat, lon, node.latitude, node.longitude)
                    
                    if distance < best_distance and distance <= max_distance:
                        best_distance = distance
                        best_node = node
        
        return best_node
    
    def find_nodes_in_radius(self, lat: float, lon: float, radius: float) -> List[Tuple[Node, float]]:
        """
        Find all nodes within a given radius
        
        Args:
            lat: Center latitude
            lon: Center longitude
            radius: Search radius in meters
            
        Returns:
            List of (node, distance) tuples sorted by distance
        """
        from ..utils.geo_utils import haversine_distance
        
        nodes_in_radius = []
        
        # Calculate search bounds
        lat_offset = (radius / 111111.0)
        lon_offset = lat_offset / math.cos(math.radians(lat))
        
        # Search grid cells
        min_lat, max_lat = lat - lat_offset, lat + lat_offset
        min_lon, max_lon = lon - lon_offset, lon + lon_offset
        
        for search_lat in [min_lat + i * self._grid_size for i in range(int((max_lat - min_lat) / self._grid_size) + 1)]:
            for search_lon in [min_lon + i * self._grid_size for i in range(int((max_lon - min_lon) / self._grid_size) + 1)]:
                grid_key = self._get_grid_key(search_lat, search_lon)
                
                for node_id in self._spatial_index.get(grid_key, set()):
                    node = self.nodes[node_id]
                    distance = haversine_distance(lat, lon, node.latitude, node.longitude)
                    
                    if distance <= radius:
                        nodes_in_radius.append((node, distance))
        
        # Sort by distance
        nodes_in_radius.sort(key=lambda x: x[1])
        return nodes_in_radius
    
    def validate_graph(self) -> Dict[str, any]:
        """
        Validate graph integrity and return statistics
        
        Returns:
            Dictionary with validation results
        """
        issues = []
        isolated_nodes = []
        
        for node_id, node in self.nodes.items():
            # Check for isolated nodes
            if len(node.neighbors) == 0:
                isolated_nodes.append(node_id)
            
            # Validate neighbor consistency
            for neighbor, weight in node.neighbors:
                if neighbor.id not in self.nodes:
                    issues.append(f"Node {node_id} has neighbor {neighbor.id} not in graph")
        
        return {
            'valid': len(issues) == 0,
            'issues': issues,
            'isolated_nodes': isolated_nodes,
            'total_nodes': len(self.nodes),
            'total_edges': len(self.edges),
            'connected_components': self._count_connected_components()
        }
    
    def save_to_file(self, filename: str) -> None:
        """
        Save graph to pickle file
        FIXED: Handles large graphs by breaking circular references
        """
        # Save original recursion limit
        old_limit = sys.getrecursionlimit()
        
        try:
            # Increase recursion limit for large graphs
            sys.setrecursionlimit(50000)
            
            # Prepare data with reduced circular references
            # Store neighbors as ID lists instead of Node references
            nodes_data = {}
            for node_id, node in self.nodes.items():
                # Create a lightweight copy without neighbor references
                nodes_data[node_id] = {
                    'id': node.id,
                    'latitude': node.latitude,
                    'longitude': node.longitude,
                    'tags': node.tags,
                    'neighbor_ids': [(n.id, w) for n, w in node.neighbors]
                }
            
            with open(filename, 'wb') as f:
                pickle.dump({
                    'nodes_data': nodes_data,
                    'edges': self.edges,
                    'stats': self.stats,
                    'version': '2.0'  # Mark as new format
                }, f, protocol=pickle.HIGHEST_PROTOCOL)
            
            logger.info(f"Graph saved to {filename}")
            
        finally:
            # Restore original limit
            sys.setrecursionlimit(old_limit)
    
    def load_from_file(self, filename: str) -> None:
        """
        Load graph from pickle file
        FIXED: Handles both old and new format
        """
        # Save original recursion limit
        old_limit = sys.getrecursionlimit()
        
        try:
            # Increase recursion limit
            sys.setrecursionlimit(50000)
            
            with open(filename, 'rb') as f:
                data = pickle.load(f)
            
            # Check if it's the new format
            if 'version' in data and data['version'] == '2.0':
                # New format: reconstruct nodes with neighbor references
                nodes_data = data['nodes_data']
                
                # First pass: create all nodes without neighbors
                self.nodes = {}
                for node_id, node_data in nodes_data.items():
                    node = Node(
                        id=node_data['id'],
                        latitude=node_data['latitude'],
                        longitude=node_data['longitude'],
                        tags=node_data['tags']
                    )
                    self.nodes[node_id] = node
                
                # Second pass: restore neighbor relationships
                for node_id, node_data in nodes_data.items():
                    node = self.nodes[node_id]
                    for neighbor_id, weight in node_data['neighbor_ids']:
                        if neighbor_id in self.nodes:
                            neighbor = self.nodes[neighbor_id]
                            node.neighbors.append((neighbor, weight))
                
                self.edges = data['edges']
                self.stats = data.get('stats', {})
                
            else:
                # Old format: direct load
                self.nodes = data['nodes']
                self.edges = data['edges']
                self.stats = data.get('stats', {})
            
            # Rebuild spatial index
            self._rebuild_spatial_index()
            logger.info(f"Graph loaded from {filename}")
            
        finally:
            # Restore original limit
            sys.setrecursionlimit(old_limit)
    
    def _add_to_spatial_index(self, node: Node) -> None:
        """Add node to spatial index"""
        grid_key = self._get_grid_key(node.latitude, node.longitude)
        self._spatial_index[grid_key].add(node.id)
    
    def _get_grid_key(self, lat: float, lon: float) -> Tuple[int, int]:
        """Get grid cell key for coordinates"""
        grid_lat = int(lat / self._grid_size)
        grid_lon = int(lon / self._grid_size)
        return (grid_lat, grid_lon)
    
    def _rebuild_spatial_index(self) -> None:
        """Rebuild spatial index from scratch"""
        self._spatial_index.clear()
        for node in self.nodes.values():
            self._add_to_spatial_index(node)
    
    def _update_stats(self) -> None:
        """Update graph statistics"""
        self.stats['node_count'] = len(self.nodes)
        self.stats['edge_count'] = len(self.edges)
        self.stats['intersection_count'] = sum(1 for node in self.nodes.values() if node.is_intersection())
        self.stats['dead_end_count'] = sum(1 for node in self.nodes.values() if node.is_dead_end())
    
    def _count_connected_components(self) -> int:
        """Count number of connected components in graph"""
        visited = set()
        components = 0
        
        for node_id in self.nodes:
            if node_id not in visited:
                # DFS to mark all connected nodes
                stack = [node_id]
                while stack:
                    current = stack.pop()
                    if current not in visited:
                        visited.add(current)
                        neighbors = [n.id for n, _ in self.get_neighbors(current)]
                        stack.extend(neighbors)
                components += 1
        
        return components
    
    def __len__(self) -> int:
        return len(self.nodes)
    
    def __str__(self) -> str:
        return f"Graph(nodes={len(self.nodes)}, edges={len(self.edges)})"