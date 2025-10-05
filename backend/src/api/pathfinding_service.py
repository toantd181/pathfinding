"""
Pathfinding service with absolute paths
"""

import logging
from typing import Dict, Optional
from ..core.graph import Graph
from ..algorithms.astar import AStar
from ..cache.destination_cache import DestinationCache
from ..cache.route_optimizer import RouteOptimizer
from ..utils.path_utils import get_graph_file, get_cache_db_file

logger = logging.getLogger(__name__)


class PathfindingService:
    """Main pathfinding service with absolute paths"""
    
    def __init__(self, graph_name: str = "hanoi_manual_graph_v1"):
        """Initialize pathfinding service"""
        self.graph_name = graph_name
        self.graph = None
        self.cache = None
        self.optimizer = None
        self.pathfinder = None
        
        self._load_graph()
        self._init_cache()
        
        logger.info(f"PathfindingService initialized: {len(self.graph.nodes)} nodes")
    
    def _load_graph(self):
        """Load the road network graph"""
        graph_file = get_graph_file(self.graph_name)
        
        logger.info(f"Loading graph from: {graph_file}")
        
        if not graph_file.exists():
            raise FileNotFoundError(f"Graph file not found: {graph_file}")
        
        self.graph = Graph()
        self.graph.load_from_file(str(graph_file))
        self.pathfinder = AStar(self.graph)
        
        logger.info(f"Loaded: {len(self.graph.nodes)} nodes, {len(self.graph.edges)} edges")
    
    def _init_cache(self):
        """Initialize cache system"""
        cache_db = str(get_cache_db_file())
        logger.info(f"Initializing cache: {cache_db}")
        
        self.cache = DestinationCache(cache_db)
        self.optimizer = RouteOptimizer(self.graph, self.cache)
        logger.info("Cache system initialized")
    
    def find_route_by_coordinates(self, start_lat: float, start_lon: float,
                                  end_lat: float, end_lon: float,
                                  use_cache: bool = True) -> Optional[Dict]:
        """
        Find route between two GPS coordinates
        
        Args:
            start_lat: Starting latitude
            start_lon: Starting longitude
            end_lat: Ending latitude
            end_lon: Ending longitude
            use_cache: Whether to use cached routes
            
        Returns:
            Dictionary with route details or None
        """
        # Find nearest nodes
        start_node = self.graph.find_nearest_node(start_lat, start_lon, max_distance=1000)
        end_node = self.graph.find_nearest_node(end_lat, end_lon, max_distance=1000)
        
        if not start_node:
            logger.warning(f"No road found near start point ({start_lat}, {start_lon})")
            return None
        
        if not end_node:
            logger.warning(f"No road found near end point ({end_lat}, {end_lon})")
            return None
        
        # Calculate distance to snapped points
        from ..utils.geo_utils import haversine_distance
        start_snap_distance = haversine_distance(start_lat, start_lon, 
                                                start_node.latitude, start_node.longitude)
        end_snap_distance = haversine_distance(end_lat, end_lon,
                                              end_node.latitude, end_node.longitude)
        
        # Find route
        route = self.optimizer.find_route(start_node.id, end_node.id, use_cache=use_cache)
        
        if not route:
            return None
        
        # Build detailed response
        return self._build_route_response(route, start_node, end_node,
                                         start_snap_distance, end_snap_distance)
    
    def find_route_by_node_ids(self, start_id: int, end_id: int,
                               use_cache: bool = True) -> Optional[Dict]:
        """
        Find route between two node IDs
        
        Args:
            start_id: Starting node ID
            end_id: Ending node ID
            use_cache: Whether to use cached routes
            
        Returns:
            Dictionary with route details or None
        """
        route = self.optimizer.find_route(start_id, end_id, use_cache=use_cache)
        
        if not route:
            return None
        
        start_node = self.graph.get_node(start_id)
        end_node = self.graph.get_node(end_id)
        
        return self._build_route_response(route, start_node, end_node, 0, 0)
    
    def _build_route_response(self, route: Dict, start_node, end_node,
                             start_snap_dist: float, end_snap_dist: float) -> Dict:
        """Build formatted route response"""
        
        # Extract path coordinates
        path_coords = []
        for node_id in route['path']:
            node = self.graph.get_node(node_id)
            if node:
                path_coords.append({
                    'lat': node.latitude,
                    'lon': node.longitude
                })
        
        # Build segments with turn-by-turn directions
        segments = []
        if 'segments' in route:
            for seg in route['segments']:
                segments.append({
                    'from': seg['from'],
                    'to': seg['to'],
                    'distance': seg['distance'],
                    'time': seg['time'],
                    'road_name': seg.get('road_name', 'Unnamed road'),
                    'road_type': seg.get('road_type', 'unknown')
                })
        
        return {
            'success': True,
            'route': {
                'path': route['path'],
                'coordinates': path_coords,
                'segments': segments,
                'summary': {
                    'distance': route['distance'],
                    'distance_km': round(route['distance'] / 1000, 2),
                    'travel_time': route['travel_time'],
                    'travel_time_minutes': round(route['travel_time'] / 60, 1),
                    'nodes_count': route['nodes_count']
                },
                'start': {
                    'node_id': start_node.id,
                    'lat': start_node.latitude,
                    'lon': start_node.longitude,
                    'snap_distance': start_snap_dist
                },
                'end': {
                    'node_id': end_node.id,
                    'lat': end_node.latitude,
                    'lon': end_node.longitude,
                    'snap_distance': end_snap_dist
                },
                'cached': route.get('cached', False),
                'calculation_time': route.get('calculation_time', 0)
            }
        }
    
    def get_node_by_coordinates(self, lat: float, lon: float,
                               max_distance: float = 500) -> Optional[Dict]:
        """
        Find nearest road node to coordinates
        
        Args:
            lat: Latitude
            lon: Longitude
            max_distance: Maximum search distance in meters
            
        Returns:
            Dictionary with node info or None
        """
        node = self.graph.find_nearest_node(lat, lon, max_distance)
        
        if not node:
            return None
        
        from ..utils.geo_utils import haversine_distance
        distance = haversine_distance(lat, lon, node.latitude, node.longitude)
        
        return {
            'node_id': node.id,
            'lat': node.latitude,
            'lon': node.longitude,
            'distance': distance,
            'neighbors_count': len(node.neighbors)
        }
    
    def get_statistics(self) -> Dict:
        """Get service statistics"""
        cache_stats = self.cache.get_cache_statistics()
        optimizer_stats = self.optimizer.get_statistics()
        
        return {
            'graph': {
                'nodes': len(self.graph.nodes),
                'edges': len(self.graph.edges),
                'name': self.graph_name
            },
            'cache': cache_stats,
            'optimizer': optimizer_stats
        }
