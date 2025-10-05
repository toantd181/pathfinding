"""
Convert manually created graph JSON to backend Graph format
"""
import sys
import json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.graph import Graph
from src.core.node import Node

# Load manual graph
with open('data/manual/hanoi_manual_graph_v1.json') as f:
    data = json.load(f)

# Create Graph
graph = Graph()

# Add nodes
for node_data in data['nodes']:
    node = Node(
        id=node_data['id'],
        latitude=node_data['lat'],
        longitude=node_data['lng'],
        tags={'name': node_data['name']}
    )
    graph.add_node(node)

print(f"Added {len(data['nodes'])} nodes")

# Add edges
for edge_data in data['edges']:
    from_node = graph.get_node(edge_data['from'])
    to_node = graph.get_node(edge_data['to'])
    
    if from_node and to_node:
        # Add forward edge
        from_node.add_neighbor(to_node, edge_data['distance'])
        
        # Add reverse edge if bidirectional
        if edge_data['bidirectional']:
            to_node.add_neighbor(from_node, edge_data['distance'])

print(f"Added {len(data['edges'])} edges")

# Save as pickle
graph.save_to_file('data/processed/hanoi_manual.pkl')
print("Saved to: hanoi_manual.pkl")

# Validate
degrees = [len(node.neighbors) for node in graph.nodes.values()]
print(f"\nGraph stats:")
print(f"  Avg degree: {sum(degrees)/len(degrees):.2f}")
print(f"  Min degree: {min(degrees)}")
print(f"  Max degree: {max(degrees)}")
