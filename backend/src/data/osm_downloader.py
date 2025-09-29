"""
Download OpenStreetMap data using Overpass API
"""

import requests
import logging
from typing import Tuple, Optional
import time

logger = logging.getLogger(__name__)


class OSMDownloader:
    """
    Download OpenStreetMap data from Overpass API
    
    Overpass API allows querying OSM data by bounding box, tags, etc.
    """
    
    OVERPASS_URL = "https://overpass-api.de/api/interpreter"
    
    def __init__(self, timeout: int = 180):
        """
        Initialize OSM downloader
        
        Args:
            timeout: Request timeout in seconds
        """
        self.timeout = timeout
    
    def download_by_bbox(self, bbox: Tuple[float, float, float, float],
                        output_file: str) -> bool:
        """
        Download OSM data for a bounding box
        
        Args:
            bbox: (min_lat, min_lon, max_lat, max_lon)
            output_file: Path to save the OSM XML file
            
        Returns:
            True if successful, False otherwise
        """
        min_lat, min_lon, max_lat, max_lon = bbox
        
        # Validate bounding box
        if not self._validate_bbox(bbox):
            logger.error("Invalid bounding box")
            return False
        
        # Calculate area size (rough estimate)
        area_km2 = self._estimate_area(bbox)
        logger.info(f"Downloading area of approximately {area_km2:.2f} km²")
        
        if area_km2 > 100:
            logger.warning("Large area requested. This may take a while or fail.")
        
        # Build Overpass query
        query = f"""
        [out:xml][timeout:{self.timeout}];
        (
          way["highway"]({min_lat},{min_lon},{max_lat},{max_lon});
          node(w);
        );
        out body;
        >;
        out skel qt;
        """
        
        logger.info(f"Downloading OSM data for bbox: {bbox}")
        
        try:
            # Make request
            response = requests.post(
                self.OVERPASS_URL,
                data={'data': query},
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                # Save to file
                with open(output_file, 'wb') as f:
                    f.write(response.content)
                
                file_size_mb = len(response.content) / (1024 * 1024)
                logger.info(f"Downloaded {file_size_mb:.2f} MB to {output_file}")
                return True
            else:
                logger.error(f"Download failed with status {response.status_code}")
                return False
                
        except requests.Timeout:
            logger.error("Request timed out. Try a smaller area.")
            return False
        except Exception as e:
            logger.error(f"Download error: {e}")
            return False
    
    def download_by_place(self, place_name: str, output_file: str) -> bool:
        """
        Download OSM data for a named place (city, district, etc.)
        
        Args:
            place_name: Name of the place (e.g., "Hanoi, Vietnam")
            output_file: Path to save the OSM XML file
            
        Returns:
            True if successful, False otherwise
        """
        # First, we need to geocode the place name to get its boundaries
        # This is a simplified version - in production, use Nominatim API
        
        query = f"""
        [out:xml][timeout:{self.timeout}];
        area["name"="{place_name}"]->.searchArea;
        (
          way["highway"](area.searchArea);
          node(w);
        );
        out body;
        >;
        out skel qt;
        """
        
        logger.info(f"Downloading OSM data for place: {place_name}")
        
        try:
            response = requests.post(
                self.OVERPASS_URL,
                data={'data': query},
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                with open(output_file, 'wb') as f:
                    f.write(response.content)
                
                file_size_mb = len(response.content) / (1024 * 1024)
                logger.info(f"Downloaded {file_size_mb:.2f} MB to {output_file}")
                return True
            else:
                logger.error(f"Download failed with status {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Download error: {e}")
            return False
    
    def _validate_bbox(self, bbox: Tuple[float, float, float, float]) -> bool:
        """Validate bounding box coordinates"""
        min_lat, min_lon, max_lat, max_lon = bbox
        
        if not (-90 <= min_lat <= 90 and -90 <= max_lat <= 90):
            return False
        if not (-180 <= min_lon <= 180 and -180 <= max_lon <= 180):
            return False
        if min_lat >= max_lat or min_lon >= max_lon:
            return False
        
        return True
    
    def _estimate_area(self, bbox: Tuple[float, float, float, float]) -> float:
        """Estimate area of bounding box in km²"""
        min_lat, min_lon, max_lat, max_lon = bbox
        
        # Rough calculation
        lat_km = abs(max_lat - min_lat) * 111
        lon_km = abs(max_lon - min_lon) * 111 * abs(min_lat + max_lat) / 2
        
        return lat_km * lon_km