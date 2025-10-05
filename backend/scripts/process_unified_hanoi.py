"""
Process unified Hanoi OSM data into optimized graph
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.data.osm_parser import OSMParser
from src.core.graph import Graph
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

print("="*70)
print("PROCESSING UNIFIED HANOI OSM DATA")
print("="*70)

# Parse OSM file
osm_file = 'data/maps/hanoi_unified.osm'
print(f"\nParsing: {osm_file}")

parser = OSMParser(filter_highways=True)
graph = parser.parse_osm_file(osm_file)

# Statistics
stats = parser.get_statistics()
print(f"\n{'='*70}")
print("PARSING STATISTICS")
print(f"{'='*70}")
print(f"OSM nodes read: {stats['total_nodes']:,}")
print(f"OSM ways read: {stats['total_ways']:,}")
print(f"Ways included: {stats['included_ways']:,}")
print(f"Ways excluded: {stats['excluded_ways']:,}")
print(f"Graph nodes: {stats['graph_nodes']:,}")
print(f"Graph edges: {stats['graph_edges']:,}")

# Analyze connectivity
from collections import deque

print(f"\n{'='*70}")
print("CONNECTIVITY ANALYSIS")
print(f"{'='*70}")

visited = set()
components = []

for start_id in list(graph.nodes.keys())[:50000]:
    if start_id not in visited:
        component = set()
        queue = deque([start_id])
        
        while queue and len(component) < 100000:
            node_id = queue.popleft()
            if node_id not in visited:
                visited.add(node_id)
                component.add(node_id)
                for neighbor, _ in graph.get_neighbors(node_id):
                    queue.append(neighbor.id)
        
        components.append(len(component))

components.sort(reverse=True)
print(f"Connected components: {len(components)}")
for i, size in enumerate(components[:5], 1):
    print(f"  Component {i}: {size:,} nodes")

# Check node degrees
degrees = [len(node.neighbors) for node in graph.nodes.values()]
print(f"\nNode Degree Distribution:")
print(f"  Average: {sum(degrees)/len(degrees):.2f}")
print(f"  Dead ends (degree=1): {sum(1 for d in degrees if d == 1):,}")
print(f"  Poorly connected (≤2): {sum(1 for d in degrees if d <= 2):,} ({sum(1 for d in degrees if d <= 2)/len(degrees)*100:.1f}%)")
print(f"  Well connected (≥4): {sum(1 for d in degrees if d >= 4):,}")

# Save graph
output_file = 'data/processed/hanoi_unified.pkl'
print(f"\n{'='*70}")
print(f"SAVING GRAPH")
print(f"{'='*70}")
print(f"Saving to: {output_file}")

graph.save_to_file(output_file)

print(f"\n✓ COMPLETE!")
print(f"\nTo use this graph, update pathfinding_service.py:")
print(f'  def __init__(self, graph_name: str = "hanoi_unified"):')
