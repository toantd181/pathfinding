"""
A* Pathfinding Algorithm Implementation
Optimized for geographic road networks
"""

import heapq
import logging
from typing import List, Dict, Optional, Tuple, Callable
from dataclasses import dataclass, field

from ..core.graph import Graph
from ..core.node import Node
from .heuristics import haversine_distance

logger = logging.getLogger(__name__)


@dataclass(order=True)
class PriorityNode:
    """Node wrapper for priority queue with f-score"""
    priority: float
    node_id: int = field(compare=False)


class AStar:
    """
    A* pathfinding algorithm implementation
    
    Features:
    - Geographic heuristic (Haversine distance)
    - Optimized for road networks
    - Alternative route support
    - Statistics tracking
    """
    
    def __init__(self, graph: Graph, heuristic: Callable = None):
        """
        Initialize A* algorithm
        
        Args:
            graph: Road network graph
            heuristic: Heuristic function (default: Haversine distance)
        """
        self.graph = graph
        self.heuristic_func = heuristic or haversine_distance
        
        # Statistics
        self.stats = {
            'nodes_explored': 0,
            'nodes_in_path': 0,
            'total_distance': 0,
            'search_time': 0
        }
    
    def find_path(self, start_id: int, goal_id: int) -> Optional[List[int]]:
        """
        Find shortest path from start to goal using A* algorithm
        
        Args:
            start_id: Starting node ID
            goal_id: Goal node ID
            
        Returns:
            List of node IDs forming the path, or None if no path exists
        """
        import time
        start_time = time.time()
        
        # Validate nodes exist
        if start_id not in self.graph.nodes:
            logger.error(f"Start node {start_id} not found in graph")
            return None
        if goal_id not in self.graph.nodes:
            logger.error(f"Goal node {goal_id} not found in graph")
            return None
        
        # Special case: start and goal are the same
        if start_id == goal_id:
            return [start_id]
        
        # Initialize data structures
        open_set = []  # Priority queue
        heapq.heappush(open_set, PriorityNode(0, start_id))
        
        came_from: Dict[int, int] = {}  # Track path
        g_score: Dict[int, float] = {start_id: 0}  # Cost from start
        f_score: Dict[int, float] = {start_id: self._heuristic(start_id, goal_id)}
        
        closed_set = set()  # Already explored nodes
        self.stats['nodes_explored'] = 0
        
        while open_set:
            # Get node with lowest f-score
            current_wrapper = heapq.heappop(open_set)
            current_id = current_wrapper.node_id
            
            # Skip if already explored
            if current_id in closed_set:
                continue
            
            # Check if we reached the goal
            if current_id == goal_id:
                path = self._reconstruct_path(came_from, current_id)
                self.stats['nodes_in_path'] = len(path)
                self.stats['total_distance'] = g_score[goal_id]
                self.stats['search_time'] = time.time() - start_time
                logger.info(f"Path found: {len(path)} nodes, "
                          f"{g_score[goal_id]:.0f}m, "
                          f"{self.stats['nodes_explored']} nodes explored")
                return path
            
            closed_set.add(current_id)
            self.stats['nodes_explored'] += 1
            
            # Explore neighbors
            for neighbor, edge_weight in self.graph.get_neighbors(current_id):
                neighbor_id = neighbor.id
                
                # Skip if already explored
                if neighbor_id in closed_set:
                    continue
                
                # Calculate tentative g-score
                tentative_g = g_score[current_id] + edge_weight
                
                # Check if this path is better
                if neighbor_id not in g_score or tentative_g < g_score[neighbor_id]:
                    # Update path
                    came_from[neighbor_id] = current_id
                    g_score[neighbor_id] = tentative_g
                    f_score[neighbor_id] = tentative_g + self._heuristic(neighbor_id, goal_id)
                    
                    # Add to open set
                    heapq.heappush(open_set, PriorityNode(f_score[neighbor_id], neighbor_id))
        
        # No path found
        self.stats['search_time'] = time.time() - start_time
        logger.warning(f"No path found from {start_id} to {goal_id}")
        logger.info(f"Explored {self.stats['nodes_explored']} nodes in {self.stats['search_time']:.2f}s")
        return None
    
    def find_path_with_details(self, start_id: int, goal_id: int) -> Optional[Dict]:
        """
        Find path and return detailed information
        
        Args:
            start_id: Starting node ID
            goal_id: Goal node ID
            
        Returns:
            Dictionary with path details or None
        """
        path = self.find_path(start_id, goal_id)
        
        if not path:
            return None
        
        # Calculate additional details
        total_distance = 0
        total_time = 0
        segments = []
        
        for i in range(len(path) - 1):
            from_id = path[i]
            to_id = path[i + 1]
            
            edge = self.graph.get_edge(from_id, to_id)
            if edge:
                total_distance += edge.weight
                segment_time = edge.travel_time()
                total_time += segment_time
                
                from_node = self.graph.get_node(from_id)
                to_node = self.graph.get_node(to_id)
                
                segments.append({
                    'from': {
                        'id': from_id,
                        'lat': from_node.latitude,
                        'lon': from_node.longitude
                    },
                    'to': {
                        'id': to_id,
                        'lat': to_node.latitude,
                        'lon': to_node.longitude
                    },
                    'distance': edge.weight,
                    'time': segment_time,
                    'road_name': edge.name,
                    'road_type': edge.road_type.value
                })
        
        return {
            'path': path,
            'segments': segments,
            'total_distance': total_distance,
            'total_time': total_time,
            'nodes_explored': self.stats['nodes_explored'],
            'search_time': self.stats['search_time']
        }
    
    def _heuristic(self, node_id: int, goal_id: int) -> float:
        """
        Calculate heuristic cost from node to goal
        
        Args:
            node_id: Current node ID
            goal_id: Goal node ID
            
        Returns:
            Estimated cost (distance in meters)
        """
        node = self.graph.get_node(node_id)
        goal = self.graph.get_node(goal_id)
        
        if not node or not goal:
            return float('inf')
        
        return self.heuristic_func(
            node.latitude, node.longitude,
            goal.latitude, goal.longitude
        )
    
    def _reconstruct_path(self, came_from: Dict[int, int], current_id: int) -> List[int]:
        """
        Reconstruct path from came_from dictionary
        
        Args:
            came_from: Dictionary mapping node to predecessor
            current_id: Goal node ID
            
        Returns:
            List of node IDs from start to goal
        """
        path = [current_id]
        
        while current_id in came_from:
            current_id = came_from[current_id]
            path.append(current_id)
        
        path.reverse()
        return path
    
    def get_statistics(self) -> Dict:
        """Get statistics from last path search"""
        return self.stats.copy()