# =====================================
# COMPLETE: backend/src/data/hanoi_osm_manager.py
# =====================================

"""
Hanoi-specific OSM data management with absolute paths
COMPLETE VERSION with all methods
"""

import os
import yaml
import logging
from typing import Dict, List, Tuple, Optional
from datetime import datetime

from .osm_downloader import OSMDownloader
from .osm_parser import OSMParser
from ..core.graph import Graph
from ..utils.path_utils import (
    get_config_file, get_hanoi_maps_dir, 
    get_processed_dir, get_osm_file, get_graph_file
)

logger = logging.getLogger(__name__)


class HanoiOSMManager:
    """
    Manage OpenStreetMap data for Hanoi with absolute paths
    COMPLETE with all download methods
    """
    
    def __init__(self):
        """Initialize Hanoi OSM manager"""
        self.config_path = str(get_config_file("hanoi_config.yaml"))
        self.config = self._load_config()
        self.downloader = OSMDownloader()
        self.data_dir = str(get_hanoi_maps_dir())
        self.processed_dir = str(get_processed_dir())
        
        logger.info(f"HanoiOSMManager initialized")
        logger.info(f"  Config: {self.config_path}")
        logger.info(f"  Maps dir: {self.data_dir}")
        logger.info(f"  Processed dir: {self.processed_dir}")
    
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
        """Get default Hanoi configuration"""
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
                },
                'ba_dinh': {
                    'name': 'Ba Đình',
                    'bbox': [21.0250, 105.8150, 21.0450, 105.8400],
                    'priority': 1
                }
            },
            'landmarks': [],
            'universities': [],
            'hospitals': [],
            'routing': {
                'speed_adjustments': {}
            }
        }
    
    def download_district(self, district_key: str) -> Optional[str]:
        """
        Download OSM data for a specific district
        
        Args:
            district_key: District key from config (e.g., 'hoan_kiem')
            
        Returns:
            Path to downloaded file or None
        """
        districts = self.config.get('districts', {})
        
        if district_key not in districts:
            logger.error(f"District '{district_key}' not found")
            logger.info(f"Available districts: {', '.join(districts.keys())}")
            return None
        
        district = districts[district_key]
        bbox = tuple(district['bbox'])
        
        output_file = str(get_osm_file(district_key))
        
        logger.info(f"📥 Downloading {district['name']} district...")
        logger.info(f"   Output: {output_file}")
        
        success = self.downloader.download_by_bbox(bbox, output_file)
        
        if success:
            logger.info(f"✅ Downloaded to {output_file}")
            return output_file
        else:
            logger.error(f"❌ Failed to download {district['name']}")
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
        
        logger.info(f"📥 Downloading districts (priority: {priority if priority else 'all'})")
        
        for district_key, district_data in districts.items():
            # Filter by priority if specified
            if priority is not None and district_data.get('priority') != priority:
                continue
            
            logger.info(f"\n{'='*50}")
            logger.info(f"District: {district_data['name']}")
            
            file_path = self.download_district(district_key)
            if file_path:
                downloaded_files.append(file_path)
                logger.info(f"✅ Success")
            else:
                logger.error(f"❌ Failed")
        
        logger.info(f"\n{'='*50}")
        logger.info(f"✅ Downloaded {len(downloaded_files)} district(s)")
        return downloaded_files
    
    def download_city_center(self) -> Optional[str]:
        """Download focused area around Hanoi city center"""
        center_bbox = (21.0150, 105.8400, 21.0400, 105.8650)
        output_file = str(get_osm_file("hanoi_center"))
        
        logger.info("📥 Downloading Hanoi city center...")
        logger.info(f"   Area: ~9 km² around Hoan Kiem Lake")
        logger.info(f"   Output: {output_file}")
        
        success = self.downloader.download_by_bbox(center_bbox, output_file)
        
        if success:
            logger.info(f"✅ Downloaded to {output_file}")
            return output_file
        else:
            logger.error("❌ Failed to download")
            return None
    
    def parse_and_build_graph(self, osm_file: str, save_name: str = "hanoi_graph") -> Graph:
        """
        Parse OSM file and build graph
        
        Args:
            osm_file: Path to OSM file
            save_name: Name for saved graph file
            
        Returns:
            Parsed Graph object
        """
        parser = OSMParser(filter_highways=True)
        
        logger.info(f"🔧 Parsing {osm_file}...")
        graph = parser.parse_osm_file(osm_file)
        
        # Apply speed adjustments
        self._apply_hanoi_speeds(graph)
        
        # Save graph with absolute path
        graph_file = str(get_graph_file(save_name))
        
        logger.info(f"💾 Saving to {graph_file}...")
        graph.save_to_file(graph_file)
        
        stats = parser.get_statistics()
        self._print_stats(stats, graph)
        
        return graph
    
    def parse_multiple_and_build_graph(self, osm_files: List[str], 
                                      save_name: str = "hanoi_merged") -> Graph:
        """
        Parse multiple OSM files and build a single merged graph
        
        Args:
            osm_files: List of OSM file paths
            save_name: Name for saved graph file
            
        Returns:
            Merged Graph object
        """
        logger.info(f"🔧 Parsing {len(osm_files)} OSM files...")
        
        merged_graph = Graph()
        total_stats = {
            'total_nodes': 0,
            'total_ways': 0,
            'included_ways': 0,
            'graph_nodes': 0,
            'graph_edges': 0
        }
        
        for i, osm_file in enumerate(osm_files, 1):
            logger.info(f"\n📦 Processing file {i}/{len(osm_files)}: {osm_file}")
            
            parser = OSMParser(filter_highways=True)
            temp_graph = parser.parse_osm_file(osm_file)
            
            # Merge into main graph
            logger.info(f"   Merging {len(temp_graph.nodes)} nodes, {len(temp_graph.edges)} edges...")
            
            # Add nodes
            nodes_added = 0
            for node_id, node in temp_graph.nodes.items():
                if node_id not in merged_graph.nodes:
                    from ..core.node import Node
                    new_node = Node(
                        id=node.id,
                        latitude=node.latitude,
                        longitude=node.longitude,
                        tags=node.tags.copy()
                    )
                    merged_graph.add_node(new_node)
                    nodes_added += 1
            
            # Add edges
            edges_added = 0
            for edge_key, edge in temp_graph.edges.items():
                if edge_key not in merged_graph.edges:
                    if edge.from_node_id in merged_graph.nodes and edge.to_node_id in merged_graph.nodes:
                        merged_graph.add_edge(edge)
                        edges_added += 1
            
            logger.info(f"   ✅ Added {nodes_added} nodes, {edges_added} edges")
            
            stats = parser.get_statistics()
            for key in total_stats:
                if key in stats:
                    total_stats[key] += stats[key]
        
        # Apply speed adjustments
        self._apply_hanoi_speeds(merged_graph)
        
        # Update stats
        total_stats['graph_nodes'] = len(merged_graph.nodes)
        total_stats['graph_edges'] = len(merged_graph.edges)
        
        # Save graph
        graph_file = str(get_graph_file(save_name))
        logger.info(f"\n💾 Saving merged graph to {graph_file}...")
        merged_graph.save_to_file(graph_file)
        
        self._print_stats(total_stats, merged_graph)
        
        return merged_graph
    
    def _apply_hanoi_speeds(self, graph: Graph) -> None:
        """Apply Hanoi-specific speed adjustments"""
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
                edge.max_speed = int(edge.max_speed * adjustment)
                adjusted_count += 1
        
        logger.info(f"   Adjusted {adjusted_count} edges")
    
    def _print_stats(self, stats: Dict, graph: Graph) -> None:
        """Print statistics"""
        print("\n" + "="*60)
        print("📊 HANOI MAP STATISTICS")
        print("="*60)
        print(f"🗺️  Area: {self.config['city']['name']}, Vietnam")
        print(f"\n📈 Data Statistics:")
        print(f"   Total OSM nodes: {stats.get('total_nodes', 0):,}")
        print(f"   Total OSM ways: {stats.get('total_ways', 0):,}")
        print(f"   Included ways: {stats.get('included_ways', 0):,}")
        print(f"   Graph nodes: {len(graph.nodes):,}")
        print(f"   Graph edges: {len(graph.edges):,}")
        print(f"   Intersections: {graph.stats.get('intersection_count', 0):,}")
        
        # Validate
        validation = graph.validate_graph()
        print(f"\n🔍 Validation:")
        print(f"   Connected components: {validation['connected_components']}")
        if validation['connected_components'] > 1:
            print(f"   ⚠️  Graph has disconnected parts!")
        
        print("="*60 + "\n")
    
    def get_landmarks(self) -> List[Dict]:
        """Get landmarks list"""
        return self.config.get('landmarks', [])
    
    def get_universities(self) -> List[Dict]:
        """Get universities list"""
        return self.config.get('universities', [])
    
    def get_hospitals(self) -> List[Dict]:
        """Get hospitals list"""
        return self.config.get('hospitals', [])
    
    def get_all_pois(self) -> List[Dict]:
        """Get all POIs"""
        pois = []
        
        for landmark in self.get_landmarks():
            pois.append({**landmark, 'type': 'landmark'})
        
        for university in self.get_universities():
            pois.append({**university, 'type': 'university'})
        
        for hospital in self.get_hospitals():
            pois.append({**hospital, 'type': 'hospital'})
        
        return pois
    
    def find_nearest_poi_node(self, graph: Graph, poi: Dict) -> Optional[int]:
        """Find the nearest graph node to a POI"""
        nearest_node = graph.find_nearest_node(
            poi['lat'], 
            poi['lon'], 
            max_distance=500
        )
        
        if nearest_node:
            return nearest_node.id
        return None
    
    def attach_pois_to_graph(self, graph: Graph) -> Dict[str, int]:
        """Attach all POIs to nearest graph nodes"""
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


# =====================================
# USAGE IN setup_hanoi_map.py
# =====================================

"""
The setup_hanoi_map.py script should work now with the complete HanoiOSMManager

Example usage:

def setup_all_priority_districts():
    manager = HanoiOSMManager()
    
    # Download all priority 1 districts
    files = manager.download_all_districts(priority=1)
    
    if files:
        # Parse and merge all files into one graph
        graph = manager.parse_multiple_and_build_graph(files, "hanoi_priority")
        return graph
    return None
"""