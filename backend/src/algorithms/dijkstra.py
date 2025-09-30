"""
Dijkstra's Algorithm Implementation
Alternative pathfinding algorithm (no heuristic)
"""

import heapq
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass, field

from ..core.graph import Graph

logger = logging.getLogger(__name__)


@dataclass(order=True)
class PriorityNode:
    """Node wrapper for priority queue"""
    priority: float
    node_id: int = field(compare=False)


class Dijkstra:
    """
    Dijkstra's shortest path algorithm
    Guaranteed to find optimal path but slower than A*
    """
    
    def __init__(self, graph: Graph):
        """Initialize Dijkstra algorithm"""
        self.graph = graph
        self.stats = {
            'nodes_explored': 0,
            'nodes_in_path': 0,
            'total_distance': 0
        }
    
    def find_path(self, start_id: int, goal_id: int) -> Optional[List[int]]:
        """
        Find shortest path using Dijkstra's algorithm
        
        Args:
            start_id: Starting node ID
            goal_id: Goal node ID
            
        Returns:
            List of node IDs forming the path, or None
        """
        if start_id == goal_id:
            return [start_id]
        
        # Initialize
        open_set = []
        heapq.heappush(open_set, PriorityNode(0, start_id))
        
        came_from: Dict[int, int] = {}
        distance: Dict[int, float] = {start_id: 0}
        closed_set = set()
        
        self.stats['nodes_explored'] = 0
        
        while open_set:
            current_wrapper = heapq.heappop(open_set)
            current_id = current_wrapper.node_id
            
            if current_id in closed_set:
                continue
            
            if current_id == goal_id:
                path = self._reconstruct_path(came_from, current_id)
                self.stats['nodes_in_path'] = len(path)
                self.stats['total_distance'] = distance[goal_id]
                return path
            
            closed_set.add(current_id)
            self.stats['nodes_explored'] += 1
            
            # Explore neighbors
            for neighbor, edge_weight in self.graph.get_neighbors(current_id):
                neighbor_id = neighbor.id
                
                if neighbor_id in closed_set:
                    continue
                
                tentative_distance = distance[current_id] + edge_weight
                
                if neighbor_id not in distance or tentative_distance < distance[neighbor_id]:
                    came_from[neighbor_id] = current_id
                    distance[neighbor_id] = tentative_distance
                    heapq.heappush(open_set, PriorityNode(tentative_distance, neighbor_id))
        
        return None
    
    def _reconstruct_path(self, came_from: Dict[int, int], current_id: int) -> List[int]:
        """Reconstruct path from came_from dictionary"""
        path = [current_id]
        while current_id in came_from:
            current_id = came_from[current_id]
            path.append(current_id)
        path.reverse()
        return path