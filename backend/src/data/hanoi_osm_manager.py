
"""
Hanoi-specific OSM data management
Handles downloading and managing map data for Hanoi districts
"""

import os
import yaml
import logging
from typing import Dict, List, Tuple, Optional
from datetime import datetime

from .osm_downloader import OSMDownloader
from .osm_parser import OSMParser
from ..core.graph import Graph

logger = logging.getLogger(__name__)


class HanoiOSMManager:
    """
    Manage OpenStreetMap data specifically for Hanoi, Vietnam
    
    Features:
    - Download by district
    - Combine multiple district maps
    - Pre-configured POI locations
    - Hanoi-specific routing preferences
    """
    
    def __init__(self, config_path: str = "backend/config/hanoi_config.yaml"):
        """Initialize Hanoi OSM manager"""
        self.config_path = config_path
        self.config = self._load_config()
        self.downloader = OSMDownloader()
        self.data_dir = "backend/data/maps/hanoi/"
        self.processed_dir = "backend/data/processed/"
        
        # Create directories
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.processed_dir, exist_ok=True)
    
    def _load_config(self) -> Dict:
        """Load Hanoi configuration"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            logger.warning(f"Config file not found: {self.config_path}")
            logger.info("Using default configuration")
            return self._get_default_config()
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict:
        """Get default Hanoi configuration if file not found"""
        return {
            'city': {
                'name': 'Hanoi',
                'center': {'latitude': 21.0285, 'longitude': 105.8542}
            },
            'districts': {
                'hoan_kiem': {
                    'name': 'Hoàn Kiếm',
                    'bbox': [21.0180, 105.8420, 21.0380, 105.8620],
                    'priority': 1
                }
            },
            'landmarks': [],
            'universities': [],
            'hospitals': []
        }
    
    def download_district(self, district_key: str) -> Optional[str]:
        """
        Download OSM data for a specific Hanoi district
        
        Args:
            district_key: District key from config (e.g., 'hoan_kiem')
            
        Returns:
            Path to downloaded file or None if failed
        """
        districts = self.config.get('districts', {})
        
        if district_key not in districts:
            logger.error(f"District '{district_key}' not found in config")
            logger.info(f"Available districts: {', '.join(districts.keys())}")
            return None
        
        district = districts[district_key]
        district_name = district['name']
        bbox = tuple(district['bbox'])
        
        output_file = os.path.join(self.data_dir, f"{district_key}.osm")
        
        logger.info(f"📥 Downloading {district_name} district...")
        success = self.downloader.download_by_bbox(bbox, output_file)
        
        if success:
            logger.info(f"✅ Downloaded {district_name} to {output_file}")
            return output_file
        else:
            logger.error(f"❌ Failed to download {district_name}")
            return None
    
    def download_all_districts(self, priority: Optional[int] = None) -> List[str]:
        """
        Download OSM data for all Hanoi districts
        
        Args:
            priority: If specified, only download districts with this priority level
            
        Returns:
            List of downloaded file paths
        """
        districts = self.config.get('districts', {})
        downloaded_files = []
        
        for district_key, district_data in districts.items():
            # Filter by priority if specified
            if priority is not None and district_data.get('priority') != priority:
                continue
            
            file_path = self.download_district(district_key)
            if file_path:
                downloaded_files.append(file_path)
        
        logger.info(f"✅ Downloaded {len(downloaded_files)} district(s)")
        return downloaded_files
    
    def download_city_center(self) -> Optional[str]:
        """Download a focused area around Hanoi city center (Hoan Kiem area)"""
        
        # City center area (approximately 3x3 km around Hoan Kiem Lake)
        center_bbox = (21.0150, 105.8400, 21.0400, 105.8650)
        output_file = os.path.join(self.data_dir, "hanoi_center.osm")
        
        logger.info("📥 Downloading Hanoi city center...")
        logger.info("   Area: ~9 km² around Hoan Kiem Lake")
        logger.info("   Includes: Old Quarter, French Quarter, Opera House area")
        
        success = self.downloader.download_by_bbox(center_bbox, output_file)
        
        if success:
            logger.info(f"✅ Downloaded city center to {output_file}")
            return output_file
        else:
            logger.error("❌ Failed to download city center")
            return None
    
    def parse_and_build_graph(self, osm_file: str, save_name: str = "hanoi_graph") -> Graph:
        """
        Parse OSM file and build graph with Hanoi-specific settings
        
        Args:
            osm_file: Path to OSM file
            save_name: Name for saved graph file
            
        Returns:
            Parsed Graph object
        """
        parser = OSMParser(filter_highways=True)
        
        logger.info(f"🔧 Parsing {osm_file}...")
        graph = parser.parse_osm_file(osm_file)
        
        # Apply Hanoi-specific speed adjustments
        self._apply_hanoi_speeds(graph)
        
        # Save graph
        graph_file = os.path.join(self.processed_dir, f"{save_name}.pkl")
        graph.save_to_file(graph_file)
        logger.info(f"💾 Saved graph to {graph_file}")
        
        # Print statistics
        stats = parser.get_statistics()
        self._print_stats(stats, graph)
        
        return graph
    
    def _apply_hanoi_speeds(self, graph: Graph) -> None:
        """Apply Hanoi-specific speed adjustments to graph"""
        routing_config = self.config.get('routing', {})
        speed_adjustments = routing_config.get('speed_adjustments', {})
        
        if not speed_adjustments:
            return
        
        logger.info("⚙️  Applying Hanoi traffic speed adjustments...")
        adjusted_count = 0
        
        for edge in graph.edges.values():
            road_type_str = edge.road_type.value
            adjustment = speed_adjustments.get(road_type_str, 1.0)
            
            if adjustment != 1.0:
                original_speed = edge.max_speed
                edge.max_speed = int(edge.max_speed * adjustment)
                adjusted_count += 1
        
        logger.info(f"   Adjusted {adjusted_count} edges for Hanoi traffic conditions")
    
    def _print_stats(self, stats: Dict, graph: Graph) -> None:
        """Print detailed statistics"""
        print("\n" + "="*60)
        print("📊 HANOI MAP STATISTICS")
        print("="*60)
        print(f"🗺️  Area: {self.config['city']['name']}, Vietnam")
        print(f"📍 Center: {self.config['city']['center']['latitude']:.4f}, "
              f"{self.config['city']['center']['longitude']:.4f}")
        print(f"\n📈 Data Statistics:")
        print(f"   Total OSM nodes: {stats['total_nodes']:,}")
        print(f"   Total OSM ways: {stats['total_ways']:,}")
        print(f"   Included ways: {stats['included_ways']:,}")
        print(f"   Excluded ways: {stats['excluded_ways']:,}")
        print(f"   Graph nodes: {stats['graph_nodes']:,}")
        print(f"   Graph edges: {stats['graph_edges']:,}")
        print(f"   Intersections: {graph.stats.get('intersection_count', 0):,}")
        print(f"   Dead ends: {graph.stats.get('dead_end_count', 0):,}")
        print("="*60 + "\n")
    
    def get_landmarks(self) -> List[Dict]:
        """Get list of Hanoi landmarks from config"""
        return self.config.get('landmarks', [])
    
    def get_universities(self) -> List[Dict]:
        """Get list of Hanoi universities from config"""
        return self.config.get('universities', [])
    
    def get_hospitals(self) -> List[Dict]:
        """Get list of Hanoi hospitals from config"""
        return self.config.get('hospitals', [])
    
    def get_all_pois(self) -> List[Dict]:
        """Get all POIs (landmarks, universities, hospitals)"""
        pois = []
        
        # Add landmarks
        for landmark in self.get_landmarks():
            pois.append({**landmark, 'type': 'landmark'})
        
        # Add universities
        for university in self.get_universities():
            pois.append({**university, 'type': 'university'})
        
        # Add hospitals
        for hospital in self.get_hospitals():
            pois.append({**hospital, 'type': 'hospital'})
        
        return pois
    
    def find_nearest_poi_node(self, graph: Graph, poi: Dict) -> Optional[int]:
        """
        Find the nearest graph node to a POI
        
        Args:
            graph: Road network graph
            poi: POI dictionary with 'lat' and 'lon'
            
        Returns:
            Node ID of nearest graph node, or None
        """
        nearest_node = graph.find_nearest_node(
            poi['lat'], 
            poi['lon'], 
            max_distance=500  # 500 meters max
        )
        
        if nearest_node:
            return nearest_node.id
        return None
    
    def attach_pois_to_graph(self, graph: Graph) -> Dict[str, int]:
        """
        Attach all POIs to nearest graph nodes
        
        Args:
            graph: Road network graph
            
        Returns:
            Dictionary mapping POI names to node IDs
        """
        poi_node_map = {}
        pois = self.get_all_pois()
        
        logger.info(f"🔗 Attaching {len(pois)} POIs to graph nodes...")
        
        for poi in pois:
            node_id = self.find_nearest_poi_node(graph, poi)
            if node_id:
                poi_name = poi.get('name_en', poi.get('name'))
                poi_node_map[poi_name] = node_id
                logger.debug(f"   {poi_name} → Node {node_id}")
            else:
                logger.warning(f"   Could not attach POI: {poi.get('name')}")
        
        logger.info(f"✅ Attached {len(poi_node_map)}/{len(pois)} POIs")
        return poi_node_map