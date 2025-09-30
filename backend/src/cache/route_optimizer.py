"""
Route optimizer that uses cached routes intelligently
"""

import logging
from typing import List, Optional, Dict
from ..core.graph import Graph
from ..algorithms.astar import AStar
from .destination_cache import DestinationCache

logger = logging.getLogger(__name__)


class RouteOptimizer:
    """
    Intelligent route finder that uses cache and pathfinding
    
    Features:
    - Cache-first strategy
    - Automatic caching of new routes
    - Bidirectional route reuse
    - Statistics tracking
    """
    
    def __init__(self, graph: Graph, cache: DestinationCache):
        """
        Initialize route optimizer
        
        Args:
            graph: Road network graph
            cache: Route cache instance
        """
        self.graph = graph
        self.cache = cache
        self.pathfinder = AStar(graph)
        
        self.stats = {
            'total_requests': 0,
            'cache_hits': 0,
            'new_calculations': 0,
            'total_time_saved': 0
        }
    
    def find_route(self, start_id: int, end_id: int, 
                   use_cache: bool = True) -> Optional[Dict]:
        """
        Find route with intelligent caching
        
        Args:
            start_id: Starting node ID
            end_id: Goal node ID
            use_cache: Whether to use cached routes
            
        Returns:
            Dictionary with route details or None
        """
        self.stats['total_requests'] += 1
        
        # Special case: same node
        if start_id == end_id:
            return {
                'path': [start_id],
                'distance': 0,
                'travel_time': 0,
                'nodes_count': 1,
                'cached': False,
                'calculation_time': 0
            }
        
        # Try cache first (if enabled)
        if use_cache:
            cached_route = self.cache.get_bidirectional_route(start_id, end_id)
            if cached_route:
                self.stats['cache_hits'] += 1
                return cached_route
        
        # Calculate new route
        logger.info(f"Calculating new route: {start_id} -> {end_id}")
        route_details = self.pathfinder.find_path_with_details(start_id, end_id)
        
        if route_details:
            self.stats['new_calculations'] += 1
            
            # Cache the result
            if use_cache:
                self.cache.cache_route(
                    start_id, end_id,
                    route_details['path'],
                    route_details['total_distance'],
                    route_details['total_time']
                )
            
            return {
                'path': route_details['path'],
                'segments': route_details['segments'],
                'distance': route_details['total_distance'],
                'travel_time': route_details['total_time'],
                'nodes_count': len(route_details['path']),
                'cached': False,
                'calculation_time': route_details['search_time'],
                'nodes_explored': route_details['nodes_explored']
            }
        
        return None
    
    def precompute_routes(self, poi_pairs: List[tuple[int, int]], 
                         progress_callback=None) -> int:
        """
        Pre-calculate routes between important locations
        
        Args:
            poi_pairs: List of (start_id, end_id) tuples
            progress_callback: Optional function to report progress
            
        Returns:
            Number of routes successfully cached
        """
        logger.info(f"Pre-computing {len(poi_pairs)} routes...")
        cached_count = 0
        
        for i, (start_id, end_id) in enumerate(poi_pairs):
            # Check if already cached
            if self.cache.get_cached_route(start_id, end_id):
                logger.debug(f"Route {start_id}->{end_id} already cached")
                continue
            
            # Calculate and cache
            route = self.find_route(start_id, end_id, use_cache=False)
            if route:
                self.cache.cache_route(
                    start_id, end_id,
                    route['path'],
                    route['distance'],
                    route['travel_time']
                )
                cached_count += 1
                logger.debug(f"Pre-computed route {i+1}/{len(poi_pairs)}")
            
            # Report progress
            if progress_callback:
                progress_callback(i + 1, len(poi_pairs))
        
        logger.info(f"Pre-computed {cached_count} new routes")
        return cached_count
    
    def get_statistics(self) -> Dict:
        """Get optimizer statistics"""
        cache_stats = self.cache.get_cache_statistics()
        
        hit_rate = 0
        if self.stats['total_requests'] > 0:
            hit_rate = (self.stats['cache_hits'] / self.stats['total_requests']) * 100
        
        return {
            'optimizer': self.stats,
            'cache': cache_stats,
            'hit_rate': hit_rate
        }
