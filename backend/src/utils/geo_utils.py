"""
Geographic utility functions for distance calculations and coordinate operations
"""

import math
from typing import Tuple


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth using the Haversine formula
    
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


def bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the bearing (compass direction) from point 1 to point 2
    
    Returns:
        Bearing in degrees (0-360, where 0 is North)
    """
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlon_rad = math.radians(lon2 - lon1)
    
    y = math.sin(dlon_rad) * math.cos(lat2_rad)
    x = (math.cos(lat1_rad) * math.sin(lat2_rad) - 
         math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon_rad))
    
    bearing_rad = math.atan2(y, x)
    bearing_deg = math.degrees(bearing_rad)
    
    # Normalize to 0-360 degrees
    return (bearing_deg + 360) % 360


def bounding_box(lat: float, lon: float, distance: float) -> Tuple[float, float, float, float]:
    """
    Calculate bounding box around a point
    
    Args:
        lat, lon: Center coordinates
        distance: Distance from center in meters
        
    Returns:
        (min_lat, min_lon, max_lat, max_lon) tuple
    """
    # Rough conversion: 1 degree latitude ≈ 111,111 meters
    lat_offset = distance / 111111.0
    
    # Longitude offset depends on latitude
    lon_offset = lat_offset / math.cos(math.radians(lat))
    
    return (
        lat - lat_offset,  # min_lat
        lon - lon_offset,  # min_lon
        lat + lat_offset,  # max_lat
        lon + lon_offset   # max_lon
    )


def point_in_bbox(lat: float, lon: float, bbox: Tuple[float, float, float, float]) -> bool:
    """
    Check if a point is within a bounding box
    
    Args:
        lat, lon: Point coordinates
        bbox: (min_lat, min_lon, max_lat, max_lon)
        
    Returns:
        True if point is within bounding box
    """
    min_lat, min_lon, max_lat, max_lon = bbox
    return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon