"""
OpenStreetMap XML parser for extracting road networks
Converts OSM data into our Graph structure
"""

import xml.etree.ElementTree as ET
from typing import Dict, List, Set, Tuple, Optional
import logging
from collections import defaultdict

from ..core.node import Node
from ..core.edge import Edge, RoadType
from ..core.graph import Graph

logger = logging.getLogger(__name__)


class OSMParser:
    """
    Parse OpenStreetMap XML files and build road network graphs
    
    Supports:
    - Way filtering by highway type
    - Bidirectional road handling
    - Speed limit extraction
    - One-way street support
    """
    
    # Highway types we want to include in the graph
    ALLOWED_HIGHWAY_TYPES = {
        'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
        'unclassified', 'residential', 'motorway_link', 'trunk_link',
        'primary_link', 'secondary_link', 'tertiary_link',
        'living_street', 'service', 'road'
    }
    
    # Default speed limits by road type (km/h)
    DEFAULT_SPEEDS = {
        'motorway': 120,
        'trunk': 100,
        'primary': 80,
        'secondary': 60,
        'tertiary': 50,
        'unclassified': 50,
        'residential': 30,
        'living_street': 20,
        'service': 20,
        'motorway_link': 60,
        'trunk_link': 60,
        'primary_link': 50,
        'secondary_link': 50,
        'tertiary_link': 40,
        'road': 50
    }
    
    def __init__(self, filter_highways: bool = True):
        """
        Initialize OSM parser
        
        Args:
            filter_highways: If True, only include roads suitable for routing
        """
        self.graph = Graph()
        self.filter_highways = filter_highways
        self.osm_nodes: Dict[int, Dict] = {}  # Temporary storage for OSM nodes
        self.stats = {
            'total_nodes': 0,
            'total_ways': 0,
            'included_ways': 0,
            'excluded_ways': 0,
            'parsing_errors': 0
        }
    
    def parse_osm_file(self, file_path: str) -> Graph:
        """
        Parse an OSM XML file and return a Graph
        
        Args:
            file_path: Path to OSM XML file
            
        Returns:
            Graph object containing the road network
        """
        logger.info(f"Parsing OSM file: {file_path}")
        
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            # First pass: collect all nodes
            logger.info("First pass: Reading nodes...")
            for node_elem in root.findall('node'):
                self._parse_node_element(node_elem)
            
            self.stats['total_nodes'] = len(self.osm_nodes)
            logger.info(f"Collected {self.stats['total_nodes']} nodes")
            
            # Second pass: process ways (roads) and build graph
            logger.info("Second pass: Processing ways...")
            for way_elem in root.findall('way'):
                self._parse_way_element(way_elem)
            
            logger.info(f"Parsed {self.stats['included_ways']} ways "
                       f"({self.stats['excluded_ways']} excluded)")
            
            # Clean up temporary data
            self.osm_nodes.clear()
            
            # Validate the graph
            logger.info("Validating graph...")
            validation = self.graph.validate_graph()
            logger.info(f"Graph validation: {validation['valid']}, "
                       f"{validation['total_nodes']} nodes, "
                       f"{validation['total_edges']} edges")
            
            if validation['isolated_nodes']:
                logger.warning(f"Found {len(validation['isolated_nodes'])} isolated nodes")
            
            return self.graph
            
        except Exception as e:
            logger.error(f"Error parsing OSM file: {e}")
            self.stats['parsing_errors'] += 1
            raise
    
    def _parse_node_element(self, node_elem: ET.Element) -> None:
        """Parse a single OSM node element"""
        try:
            node_id = int(node_elem.get('id'))
            lat = float(node_elem.get('lat'))
            lon = float(node_elem.get('lon'))
            
            # Extract tags
            tags = {}
            for tag in node_elem.findall('tag'):
                key = tag.get('k')
                value = tag.get('v')
                tags[key] = value
            
            # Store node data temporarily
            self.osm_nodes[node_id] = {
                'lat': lat,
                'lon': lon,
                'tags': tags
            }
            
        except (ValueError, TypeError) as e:
            logger.warning(f"Error parsing node: {e}")
            self.stats['parsing_errors'] += 1
    
    def _parse_way_element(self, way_elem: ET.Element) -> None:
        """Parse a single OSM way element (road)"""
        try:
            way_id = int(way_elem.get('id'))
            self.stats['total_ways'] += 1
            
            # Extract tags
            tags = {}
            for tag in way_elem.findall('tag'):
                key = tag.get('k')
                value = tag.get('v')
                tags[key] = value
            
            # Check if this is a road we want to include
            highway_type = tags.get('highway')
            if not highway_type:
                self.stats['excluded_ways'] += 1
                return
            
            if self.filter_highways and highway_type not in self.ALLOWED_HIGHWAY_TYPES:
                self.stats['excluded_ways'] += 1
                return
            
            # Get node references (the path of the road)
            node_refs = []
            for nd in way_elem.findall('nd'):
                ref = int(nd.get('ref'))
                node_refs.append(ref)
            
            if len(node_refs) < 2:
                logger.warning(f"Way {way_id} has less than 2 nodes, skipping")
                self.stats['excluded_ways'] += 1
                return
            
            # Check if it's a one-way street
            oneway = tags.get('oneway', 'no')
            is_oneway = oneway in ['yes', 'true', '1']
            if highway_type == 'motorway':
                is_oneway = True  # Motorways are always one-way
            
            # Get speed limit
            max_speed = self._extract_speed(tags, highway_type)
            
            # Get road name
            name = tags.get('name', tags.get('ref', f'Way {way_id}'))
            
            # Create nodes and edges for this way
            self._create_way_graph(node_refs, highway_type, max_speed, name, 
                                  is_oneway, tags)
            
            self.stats['included_ways'] += 1
            
        except Exception as e:
            logger.warning(f"Error parsing way: {e}")
            self.stats['parsing_errors'] += 1
    
    def _create_way_graph(self, node_refs: List[int], highway_type: str,
                         max_speed: int, name: str, is_oneway: bool,
                         tags: Dict[str, str]) -> None:
        """
        Create graph nodes and edges from a way's node references
        
        Args:
            node_refs: List of OSM node IDs forming the way
            highway_type: Type of highway
            max_speed: Maximum speed limit
            name: Road name
            is_oneway: Whether the road is one-way
            tags: Additional OSM tags
        """
        # Convert highway type to RoadType enum
        road_type = self._get_road_type(highway_type)
        
        # Create or get nodes
        graph_nodes = []
        for osm_id in node_refs:
            if osm_id not in self.osm_nodes:
                logger.warning(f"Node {osm_id} referenced but not found")
                continue
            
            node_data = self.osm_nodes[osm_id]
            
            # Check if node already exists in graph
            existing_node = self.graph.get_node(osm_id)
            if existing_node:
                graph_nodes.append(existing_node)
            else:
                # Create new node
                node = Node(
                    id=osm_id,
                    latitude=node_data['lat'],
                    longitude=node_data['lon'],
                    tags=node_data['tags']
                )
                self.graph.add_node(node)
                graph_nodes.append(node)
        
        if len(graph_nodes) < 2:
            return
        
        # Create edges between consecutive nodes
        for i in range(len(graph_nodes) - 1):
            from_node = graph_nodes[i]
            to_node = graph_nodes[i + 1]
            
            # Calculate distance
            distance = from_node.distance_to(to_node)
            
            # Create edge
            edge = Edge(
                from_node_id=from_node.id,
                to_node_id=to_node.id,
                weight=distance,
                road_type=road_type,
                max_speed=max_speed,
                tags=tags,
                bidirectional=not is_oneway,
                name=name
            )
            
            try:
                self.graph.add_edge(edge)
            except Exception as e:
                logger.warning(f"Error adding edge {from_node.id}->{to_node.id}: {e}")
    
    def _extract_speed(self, tags: Dict[str, str], highway_type: str) -> int:
        """
        Extract speed limit from tags or use default
        
        Args:
            tags: OSM tags dictionary
            highway_type: Type of highway
            
        Returns:
            Speed limit in km/h
        """
        maxspeed = tags.get('maxspeed')
        
        if maxspeed:
            # Handle different formats: "50", "50 mph", "50 km/h"
            try:
                # Extract numeric part
                speed_str = ''.join(filter(str.isdigit, maxspeed))
                speed = int(speed_str)
                
                # Convert mph to km/h if needed
                if 'mph' in maxspeed.lower():
                    speed = int(speed * 1.60934)
                
                return speed
            except ValueError:
                pass
        
        # Use default speed for this highway type
        return self.DEFAULT_SPEEDS.get(highway_type, 50)
    
    def _get_road_type(self, highway_type: str) -> RoadType:
        """Convert OSM highway type to RoadType enum"""
        type_mapping = {
            'motorway': RoadType.MOTORWAY,
            'trunk': RoadType.TRUNK,
            'primary': RoadType.PRIMARY,
            'secondary': RoadType.SECONDARY,
            'tertiary': RoadType.TERTIARY,
            'residential': RoadType.RESIDENTIAL,
            'service': RoadType.SERVICE,
            'footway': RoadType.FOOTWAY,
            'cycleway': RoadType.CYCLEWAY,
            'path': RoadType.PATH,
        }
        
        # Handle link roads (e.g., motorway_link)
        if '_link' in highway_type:
            base_type = highway_type.replace('_link', '')
            return type_mapping.get(base_type, RoadType.UNKNOWN)
        
        return type_mapping.get(highway_type, RoadType.UNKNOWN)
    
    def get_statistics(self) -> Dict:
        """Get parsing statistics"""
        return {
            **self.stats,
            'graph_nodes': len(self.graph.nodes),
            'graph_edges': len(self.graph.edges)
        }
