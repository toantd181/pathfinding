"""
Heuristic functions for pathfinding algorithms
Used to estimate distance/cost between nodes
"""

import math
from typing import Tuple


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth
    This is our primary heuristic for A* algorithm
    
    Args:
        lat1, lon1: Coordinates of first point
        lat2, lon2: Coordinates of second point
        
    Returns:
        Distance in meters
    """
    # Convert decimal degrees to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Haversine formula
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = (math.sin(dlat/2)**2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2)
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of Earth in meters
    r = 6371000
    
    return c * r


def euclidean_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate Euclidean distance (straight line)
    Less accurate than Haversine but faster
    
    Args:
        lat1, lon1: Coordinates of first point
        lat2, lon2: Coordinates of second point
        
    Returns:
        Approximate distance in meters
    """
    # Convert to approximate meters (1 degree ≈ 111km)
    lat_diff = (lat2 - lat1) * 111000
    lon_diff = (lon2 - lon1) * 111000 * math.cos(math.radians((lat1 + lat2) / 2))
    
    return math.sqrt(lat_diff**2 + lon_diff**2)


def manhattan_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate Manhattan distance (grid-based)
    Useful for grid-like road networks
    
    Args:
        lat1, lon1: Coordinates of first point
        lat2, lon2: Coordinates of second point
        
    Returns:
        Manhattan distance in meters
    """
    lat_diff = abs(lat2 - lat1) * 111000
    lon_diff = abs(lon2 - lon1) * 111000 * math.cos(math.radians((lat1 + lat2) / 2))
    
    return lat_diff + lon_diff


def time_heuristic(distance_meters: float, avg_speed_kmh: float = 50) -> float:
    """
    Estimate travel time based on distance and average speed
    
    Args:
        distance_meters: Distance in meters
        avg_speed_kmh: Average speed in km/h
        
    Returns:
        Estimated time in seconds
    """
    distance_km = distance_meters / 1000.0
    time_hours = distance_km / avg_speed_kmh
    return time_hours * 3600  # Convert to seconds
