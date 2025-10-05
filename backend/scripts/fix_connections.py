"""
Fix disconnected components in merged graph - Simplified version
"""
import pickle
import sys
from collections import deque
import math

def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in meters"""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def find_components(nodes_data):
    """Find all connected components"""
    visited = set()
    components = []
    
    for start_node_id in nodes_data.keys():
        if start_node_id not in visited:
            component = set()
            queue = deque([start_node_id])
            
            while queue:
                node_id = queue.popleft()
                if node_id not in visited:
                    visited.add(node_id)
                    component.add(node_id)
                    
                    node_data = nodes_data.get(node_id)
                    if node_data:
                        for neighbor_id, _ in node_data['neighbor_ids']:
                            if neighbor_id not in visited:
                                queue.append(neighbor_id)
            
            components.append(component)
    
    components.sort(key=len, reverse=True)
    return components

# Add backend to path so we can use Graph class
sys.path.insert(0, '/home/toantd/my-folder/hoc/code/pathfinding-project/backend')

from src.core.graph import Graph

def connect_components_using_graph(input_file, output_file, max_bridge_distance=5000):
    """Connect disconnected components using Graph class"""
    
    print(f"Loading graph from {input_file}...")
    
    # Load using Graph class
    graph = Graph()
    graph.load_from_file(input_file)
    
    print(f"Total nodes: {len(graph.nodes)}")
    
    # Convert to simple dict for analysis
    nodes_data = {}
    for node_id, node in graph.nodes.items():
        nodes_data[node_id] = {
            'id': node_id,
            'latitude': node.latitude,
            'longitude': node.longitude,
            'neighbor_ids': [(n.id, w) for n, w in node.neighbors]
        }
    
    # Find components
    print("Finding components...")
    components = find_components(nodes_data)
    print(f"Found {len(components)} components")
    
    if len(components) == 1:
        print("Graph is already fully connected!")
        return
    
    for i, comp in enumerate(components[:10]):
        print(f"  Component {i+1}: {len(comp)} nodes")
    
    # Connect smaller components to largest
    main_component = components[0]
    bridges_added = 0
    
    for comp_idx, component in enumerate(components[1:], start=2):
        print(f"\nConnecting component {comp_idx} ({len(component)} nodes)...")
        
        min_distance = float('inf')
        best_pair = None
        
        # Sample nodes
        comp_sample = list(component)[:min(500, len(component))]
        main_sample = list(main_component)[:min(500, len(main_component))]
        
        for node1_id in comp_sample:
            node1 = graph.nodes[node1_id]
            
            for node2_id in main_sample:
                node2 = graph.nodes[node2_id]
                
                distance = haversine(node1.latitude, node1.longitude, 
                                   node2.latitude, node2.longitude)
                
                if distance < min_distance:
                    min_distance = distance
                    best_pair = (node1_id, node2_id)
        
        if best_pair and min_distance <= max_bridge_distance:
            node1_id, node2_id = best_pair
            node1 = graph.nodes[node1_id]
            node2 = graph.nodes[node2_id]
            
            # Add bidirectional neighbor connections
            node1.add_neighbor(node2, min_distance)
            node2.add_neighbor(node1, min_distance)
            
            bridges_added += 1
            print(f"  ✓ Connected with {min_distance:.0f}m bridge")
            
            main_component.update(component)
        else:
            print(f"  ✗ Too far: {min_distance:.0f}m")
    
    print(f"\n{'='*60}")
    print(f"Added {bridges_added} bridge connections")
    
    # Save fixed graph
    graph.save_to_file(output_file)
    print(f"Saved to: {output_file}")
    
    # Verify by reloading
    print("\nVerifying...")
    verify_graph = Graph()
    verify_graph.load_from_file(output_file)
    
    verify_nodes = {}
    for node_id, node in verify_graph.nodes.items():
        verify_nodes[node_id] = {
            'neighbor_ids': [(n.id, w) for n, w in node.neighbors]
        }
    
    new_components = find_components(verify_nodes)
    print(f"Components after fix: {len(new_components)}")
    
    if len(new_components) == 1:
        print("✓ Graph is now fully connected!")
    else:
        print(f"⚠ Still {len(new_components)} components")

if __name__ == '__main__':
    connect_components_using_graph(
        'data/processed/hanoi_main.pkl',
        'data/processed/hanoi_main_fixed.pkl',
        max_bridge_distance=5000
    )