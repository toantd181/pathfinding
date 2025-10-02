"""
JSON-based graph storage (alternative to pickle)
"""

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def save_graph_json(graph, filename: str):
    """Save graph to JSON file"""
    
    # Convert nodes to JSON-serializable format
    nodes_data = []
    for node_id, node in graph.nodes.items():
        nodes_data.append({
            'id': node.id,
            'lat': node.latitude,
            'lon': node.longitude,
            'tags': node.tags,
            'neighbors': [(n.id, w) for n, w in node.neighbors]
        })
    
    # Convert edges to JSON format
    edges_data = []
    for (from_id, to_id), edge in graph.edges.items():
        edges_data.append({
            'from': from_id,
            'to': to_id,
            'weight': edge.weight,
            'road_type': edge.road_type.value,
            'max_speed': edge.max_speed,
            'name': edge.name,
            'bidirectional': edge.bidirectional
        })
    
    data = {
        'nodes': nodes_data,
        'edges': edges_data,
        'stats': graph.stats
    }
    
    # Save with compression if file is large
    json_str = json.dumps(data)
    
    if len(json_str) > 10_000_000:  # If > 10MB, compress
        import gzip
        filename_gz = filename.replace('.json', '.json.gz')
        with gzip.open(filename_gz, 'wt', encoding='utf-8') as f:
            json.dump(data, f, indent=None, separators=(',', ':'))
        logger.info(f"Graph saved to {filename_gz} (compressed)")
    else:
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        logger.info(f"Graph saved to {filename}")


def load_graph_json(graph, filename: str):
    """Load graph from JSON file"""
    from .node import Node
    from .edge import Edge, RoadType
    
    # Try compressed first
    filename_gz = filename.replace('.json', '.json.gz')
    
    if Path(filename_gz).exists():
        import gzip
        with gzip.open(filename_gz, 'rt', encoding='utf-8') as f:
            data = json.load(f)
    else:
        with open(filename, 'r') as f:
            data = json.load(f)
    
    # Rebuild nodes
    graph.nodes = {}
    for node_data in data['nodes']:
        node = Node(
            id=node_data['id'],
            latitude=node_data['lat'],
            longitude=node_data['lon'],
            tags=node_data.get('tags', {})
        )
        graph.nodes[node.id] = node
    
    # Rebuild neighbor relationships
    for node_data in data['nodes']:
        node = graph.nodes[node_data['id']]
        for neighbor_id, weight in node_data['neighbors']:
            if neighbor_id in graph.nodes:
                neighbor = graph.nodes[neighbor_id]
                node.neighbors.append((neighbor, weight))
    
    # Rebuild edges
    graph.edges = {}
    for edge_data in data['edges']:
        edge = Edge(
            from_node_id=edge_data['from'],
            to_node_id=edge_data['to'],
            weight=edge_data['weight'],
            road_type=RoadType(edge_data['road_type']),
            max_speed=edge_data.get('max_speed'),
            name=edge_data.get('name'),
            bidirectional=edge_data.get('bidirectional', True)
        )
        graph.edges[(edge.from_node_id, edge.to_node_id)] = edge
    
    graph.stats = data.get('stats', {})
    graph._rebuild_spatial_index()
    
    logger.info(f"Graph loaded from {filename}")