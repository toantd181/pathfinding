"""
Complete diagnostic script for Hanoi Pathfinding Project
Checks graph quality, connectivity, and routing efficiency
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.graph import Graph
from src.algorithms.astar import AStar
from src.utils.geo_utils import haversine_distance
from collections import deque, defaultdict
import random

def print_section(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print('='*70)

def check_graph_basic(graph):
    """Basic graph statistics"""
    print_section("GRAPH BASIC STATS")
    print(f"Total nodes: {len(graph.nodes):,}")
    print(f"Total edges: {len(graph.edges):,}")
    
    # Node degree distribution
    degrees = [len(node.neighbors) for node in graph.nodes.values()]
    print(f"\nNode Degree Distribution:")
    print(f"  Min degree: {min(degrees)}")
    print(f"  Max degree: {max(degrees)}")
    print(f"  Avg degree: {sum(degrees)/len(degrees):.2f}")
    print(f"  Dead ends (degree=1): {sum(1 for d in degrees if d == 1)}")
    print(f"  Poorly connected (degree<=2): {sum(1 for d in degrees if d <= 2)}")
    print(f"  Well connected (degree>=4): {sum(1 for d in degrees if d >= 4)}")
    
    return degrees

def check_connectivity(graph):
    """Check if graph is truly connected"""
    print_section("CONNECTIVITY ANALYSIS")
    
    visited = set()
    components = []
    
    print("Finding connected components...")
    for start_id in graph.nodes.keys():
        if start_id not in visited:
            component = set()
            queue = deque([start_id])
            
            while queue:
                node_id = queue.popleft()
                if node_id not in visited:
                    visited.add(node_id)
                    component.add(node_id)
                    for neighbor, _ in graph.get_neighbors(node_id):
                        queue.append(neighbor.id)
            
            components.append(component)
    
    components.sort(key=len, reverse=True)
    
    print(f"\nConnected components: {len(components)}")
    if len(components) > 1:
        print(f"⚠ WARNING: Graph has {len(components)} disconnected components!")
        for i, comp in enumerate(components[:10], 1):
            print(f"  Component {i}: {len(comp):,} nodes ({len(comp)/len(graph.nodes)*100:.1f}%)")
    else:
        print(f"✓ Graph is fully connected")
    
    return components

def check_route_quality(graph, num_samples=10):
    """Test random routes to check quality"""
    print_section("ROUTE QUALITY ANALYSIS")
    
    pathfinder = AStar(graph)
    
    # Sample random node pairs
    node_ids = list(graph.nodes.keys())
    results = []
    
    print(f"Testing {num_samples} random routes...\n")
    
    for i in range(num_samples):
        start_id = random.choice(node_ids)
        end_id = random.choice(node_ids)
        
        if start_id == end_id:
            continue
        
        start = graph.nodes[start_id]
        end = graph.nodes[end_id]
        
        direct_dist = haversine_distance(
            start.latitude, start.longitude,
            end.latitude, end.longitude
        )
        
        # Skip if too close or too far
        if direct_dist < 500 or direct_dist > 15000:
            continue
        
        result = pathfinder.find_path(start_id, end_id)
        
        if result:
            # Calculate route distance from path
            route_dist = 0
            for j in range(len(result) - 1):
                from_node = graph.nodes[result[j]]
                to_node = graph.nodes[result[j + 1]]
                # Get distance between consecutive nodes
                for neighbor, weight in from_node.neighbors:
                    if neighbor.id == to_node.id:
                        route_dist += weight
                        break
            
            ratio = route_dist / direct_dist
            calc_time = pathfinder.stats.get('search_time', 0)
            results.append({
                'direct': direct_dist,
                'route': route_dist,
                'ratio': ratio,
                'nodes': len(result),
                'time': calc_time
            })
            status = "✓" if ratio < 1.5 else "⚠" if ratio < 2.0 else "✗"
            print(f"{status} Route {i+1}: {direct_dist:.0f}m direct → {route_dist:.0f}m route (×{ratio:.2f}), {len(result)} nodes")
        else:
            print(f"✗ Route {i+1}: NO PATH FOUND ({direct_dist:.0f}m direct)")
            results.append({'direct': direct_dist, 'route': None, 'ratio': None})
    
    # Summary
    print(f"\nRoute Quality Summary:")
    successful = [r for r in results if r['route'] is not None]
    failed = [r for r in results if r['route'] is None]
    
    print(f"  Successful routes: {len(successful)}/{len(results)}")
    print(f"  Failed routes: {len(failed)}/{len(results)}")
    
    if successful:
        ratios = [r['ratio'] for r in successful]
        print(f"\n  Route efficiency (route/direct distance):")
        print(f"    Best: ×{min(ratios):.2f}")
        print(f"    Worst: ×{max(ratios):.2f}")
        print(f"    Average: ×{sum(ratios)/len(ratios):.2f}")
        print(f"    Median: ×{sorted(ratios)[len(ratios)//2]:.2f}")
        
        good = sum(1 for r in ratios if r < 1.5)
        ok = sum(1 for r in ratios if 1.5 <= r < 2.0)
        bad = sum(1 for r in ratios if r >= 2.0)
        
        print(f"\n  Quality distribution:")
        print(f"    Good (×<1.5): {good} ({good/len(ratios)*100:.0f}%)")
        print(f"    OK (×1.5-2.0): {ok} ({ok/len(ratios)*100:.0f}%)")
        print(f"    Bad (×>2.0): {bad} ({bad/len(ratios)*100:.0f}%)")

def check_graph_bounds(graph):
    """Check geographic bounds"""
    print_section("GEOGRAPHIC COVERAGE")
    
    lats = [node.latitude for node in graph.nodes.values()]
    lons = [node.longitude for node in graph.nodes.values()]
    
    print(f"Latitude range: {min(lats):.4f} to {max(lats):.4f}")
    print(f"Longitude range: {min(lons):.4f} to {max(lons):.4f}")
    print(f"\nCoverage area:")
    print(f"  North: {max(lats):.4f}")
    print(f"  South: {min(lats):.4f}")
    print(f"  East: {max(lons):.4f}")
    print(f"  West: {min(lons):.4f}")
    
    # Approximate area
    lat_span = max(lats) - min(lats)
    lon_span = max(lons) - min(lons)
    area_km2 = lat_span * 111 * lon_span * 111 * 0.8  # Rough estimate
    print(f"\nApproximate coverage area: {area_km2:.1f} km²")

def check_problem_nodes(graph, degrees):
    """Find and analyze problematic nodes"""
    print_section("PROBLEM NODE ANALYSIS")
    
    # Find nodes with degree <= 2
    problem_nodes = [
        (node_id, len(node.neighbors)) 
        for node_id, node in graph.nodes.items() 
        if len(node.neighbors) <= 2
    ]
    
    print(f"Nodes with degree ≤ 2: {len(problem_nodes)}")
    
    # Sample some problem nodes
    if problem_nodes:
        print(f"\nSample problem nodes (first 10):")
        for node_id, degree in problem_nodes[:10]:
            node = graph.nodes[node_id]
            print(f"  Node {node_id}: degree={degree}, ({node.latitude:.4f}, {node.longitude:.4f})")
        
        # Check if problem nodes are distributed or clustered
        problem_lats = [graph.nodes[nid].latitude for nid, _ in problem_nodes]
        problem_lons = [graph.nodes[nid].longitude for nid, _ in problem_nodes]
        
        print(f"\nProblem nodes distribution:")
        print(f"  Lat range: {min(problem_lats):.4f} to {max(problem_lats):.4f}")
        print(f"  Lon range: {min(problem_lons):.4f} to {max(problem_lons):.4f}")

def main():
    print_section("HANOI PATHFINDING PROJECT DIAGNOSTICS")
    print("Analyzing graph quality and routing performance...")
    
    # Load graph
    graph_file = 'data/processed/hanoi_main_improved_v2.pkl'
    print(f"\nLoading graph: {graph_file}")
    
    graph = Graph()
    try:
        graph.load_from_file(graph_file)
        print(f"✓ Graph loaded successfully")
    except FileNotFoundError:
        print(f"✗ File not found. Trying hanoi_main.pkl...")
        graph.load_from_file('data/processed/hanoi_main.pkl')
        print(f"✓ Using hanoi_main.pkl")
    
    # Run diagnostics
    degrees = check_graph_basic(graph)
    components = check_connectivity(graph)
    check_graph_bounds(graph)
    check_problem_nodes(graph, degrees)
    check_route_quality(graph, num_samples=20)
    
    # Final recommendations
    print_section("RECOMMENDATIONS")
    
    if len(components) > 1:
        print("⚠ CRITICAL: Multiple disconnected components detected")
        print("  → Run component connection script to bridge gaps")
    
    poor_nodes = sum(1 for d in degrees if d <= 2)
    if poor_nodes > len(graph.nodes) * 0.1:
        print(f"⚠ WARNING: {poor_nodes/len(graph.nodes)*100:.1f}% nodes poorly connected")
        print("  → Run connection improvement script")
    
    print("\n✓ Diagnostic complete")

if __name__ == '__main__':
    main()