"""
Test script for A* pathfinding algorithm
Tests with real Hanoi map data
"""

import sys
import os
import logging

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from src.core.graph import Graph
from src.algorithms.astar import AStar
from src.algorithms.dijkstra import Dijkstra
from src.data.hanoi_osm_manager import HanoiOSMManager

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


def load_hanoi_graph():
    """Load Hanoi graph from file"""
    graph_file = "/home/toantd/my-folder/hoc/code/pathfinding-project/backend/backend/data/processed/hanoi_center.pkl"
    
    if not os.path.exists(graph_file):
        logger.error(f"Graph file not found: {graph_file}")
        logger.info("Please run: python backend/scripts/setup_hanoi_map.py --area center")
        return None
    
    graph = Graph()
    graph.load_from_file(graph_file)
    logger.info(f"✅ Loaded graph: {len(graph.nodes):,} nodes, {len(graph.edges):,} edges")
    return graph


def test_pathfinding_with_pois():
    """Test pathfinding between Hanoi POIs"""
    
    print("\n" + "="*60)
    print("🧪 TESTING A* PATHFINDING IN HANOI")
    print("="*60 + "\n")
    
    # Load graph
    graph = load_hanoi_graph()
    if not graph:
        return
    
    # Load POIs
    manager = HanoiOSMManager()
    pois = manager.get_all_pois()
    
    # Find nearest nodes for POIs
    poi_nodes = {}
    print("📍 Finding POI locations on road network...\n")
    for poi in pois[:10]:  # Test with first 10 POIs
        name = poi.get('name_en', poi.get('name'))
        nearest = graph.find_nearest_node(poi['lat'], poi['lon'], max_distance=500)
        if nearest:
            poi_nodes[name] = nearest.id
            distance = nearest.distance_to(
                type('obj', (object,), {'latitude': poi['lat'], 'longitude': poi['lon']})()
            )
            print(f"   ✓ {name}: Node {nearest.id} ({distance:.0f}m from POI)")
    
    # Test routes
    print(f"\n🚗 Testing Routes:")
    print("="*60 + "\n")
    
    # Test 1: Hoan Kiem Lake to HUST
    if "Hoan Kiem Lake" in poi_nodes and "Hanoi University of Science and Technology" in poi_nodes:
        test_route(graph, 
                  poi_nodes["Hoan Kiem Lake"], 
                  poi_nodes["Hanoi University of Science and Technology"],
                  "Hoan Kiem Lake", 
                  "HUST")
    
    # Test 2: Opera House to Bach Mai Hospital
    if "Hanoi Opera House" in poi_nodes and "Bach Mai Hospital" in poi_nodes:
        test_route(graph,
                  poi_nodes["Hanoi Opera House"],
                  poi_nodes["Bach Mai Hospital"],
                  "Opera House",
                  "Bach Mai Hospital")
    
    # Test 3: Temple of Literature to National Economics University
    if "Temple of Literature" in poi_nodes and "National Economics University" in poi_nodes:
        test_route(graph,
                  poi_nodes["Temple of Literature"],
                  poi_nodes["National Economics University"],
                  "Temple of Literature",
                  "NEU")


def test_route(graph: Graph, start_id: int, goal_id: int, start_name: str, goal_name: str):
    """Test a single route"""
    
    print(f"🎯 Route: {start_name} → {goal_name}")
    print("-" * 60)
    
    # A* algorithm
    astar = AStar(graph)
    path_details = astar.find_path_with_details(start_id, goal_id)
    
    if path_details:
        distance_km = path_details['total_distance'] / 1000
        time_min = path_details['total_time'] / 60
        
        print(f"   ✅ Path found!")
        print(f"   📏 Distance: {distance_km:.2f} km")
        print(f"   ⏱️  Time: {time_min:.1f} minutes")
        print(f"   🗺️  Nodes in path: {len(path_details['path'])}")
        print(f"   🔍 Nodes explored: {path_details['nodes_explored']}")
        print(f"   ⚡ Search time: {path_details['search_time']*1000:.1f}ms")
        
        # Show first few segments
        if path_details['segments'][:3]:
            print(f"\n   📍 First segments:")
            for i, seg in enumerate(path_details['segments'][:3], 1):
                road = seg['road_name'] or 'Unnamed road'
                dist = seg['distance']
                print(f"      {i}. {road} ({dist:.0f}m)")
        
        print()
    else:
        print(f"   ❌ No path found")
        print()


def test_algorithm_comparison():
    """Compare A* vs Dijkstra"""
    
    print("\n" + "="*60)
    print("⚔️  A* vs DIJKSTRA COMPARISON")
    print("="*60 + "\n")
    
    graph = load_hanoi_graph()
    if not graph:
        return
    
    # Get two random nodes far apart
    nodes = list(graph.nodes.keys())
    if len(nodes) < 2:
        return
    
    start_id = nodes[0]
    goal_id = nodes[len(nodes)//2]
    
    print(f"Testing route: Node {start_id} → Node {goal_id}\n")
    
    # Test A*
    print("🌟 A* Algorithm:")
    astar = AStar(graph)
    astar_path = astar.find_path(start_id, goal_id)
    astar_stats = astar.get_statistics()
    
    if astar_path:
        print(f"   Distance: {astar_stats['total_distance']:.0f}m")
        print(f"   Nodes explored: {astar_stats['nodes_explored']}")
        print(f"   Time: {astar_stats['search_time']*1000:.1f}ms")
    
    # Test Dijkstra
    print(f"\n🔵 Dijkstra Algorithm:")
    dijkstra = Dijkstra(graph)
    dijkstra_path = dijkstra.find_path(start_id, goal_id)
    dijkstra_stats = dijkstra.stats
    
    if dijkstra_path:
        print(f"   Distance: {dijkstra_stats['total_distance']:.0f}m")
        print(f"   Nodes explored: {dijkstra_stats['nodes_explored']}")
    
    # Comparison
    if astar_path and dijkstra_path:
        speedup = dijkstra_stats['nodes_explored'] / astar_stats['nodes_explored']
        print(f"\n🏆 A* explored {speedup:.1f}x fewer nodes!")
    
    print()


def main():
    """Main test function"""
    
    print("\n🇻🇳 HANOI PATHFINDING ALGORITHM TEST")
    print("="*60)
    
    # Test with POIs
    test_pathfinding_with_pois()
    
    # Compare algorithms
    test_algorithm_comparison()
    
    print("="*60)
    print("✅ ALL TESTS COMPLETED!")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()