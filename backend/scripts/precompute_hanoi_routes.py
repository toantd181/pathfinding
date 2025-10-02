"""
Pre-compute routes with absolute path handling
"""

import sys
import os
import logging
from itertools import combinations
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from src.core.graph import Graph
from src.cache.destination_cache import DestinationCache
from src.cache.route_optimizer import RouteOptimizer
from src.data.hanoi_osm_manager import HanoiOSMManager
from src.utils.path_utils import get_graph_file, get_cache_db_file

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


def precompute_poi_routes():
    """Pre-compute routes between all POIs"""
    
    print("\n" + "="*60)
    print("🚀 PRE-COMPUTING HANOI ROUTES")
    print("="*60 + "\n")
    
    # Load graph
    print("📦 Loading Hanoi graph...")
    graph_file = get_graph_file("hanoi_main")
    
    if not graph_file.exists():
        logger.error(f"Graph file not found: {graph_file}")
        logger.info("Run: python backend/scripts/setup_hanoi_map.py --area center")
        return
    
    graph = Graph()
    graph.load_from_file(str(graph_file))
    print(f"   ✓ Loaded: {len(graph.nodes):,} nodes, {len(graph.edges):,} edges")
    print(f"   ✓ From: {graph_file}\n")
    
    # Initialize cache
    print("💾 Initializing cache system...")
    cache_file = get_cache_db_file()
    cache = DestinationCache()
    print(f"   ✓ Cache ready")
    print(f"   ✓ Location: {cache_file}\n")
    
    # Initialize optimizer
    optimizer = RouteOptimizer(graph, cache)
    
    # Load POIs
    print("📍 Loading Hanoi POIs...")
    manager = HanoiOSMManager()
    pois = manager.get_all_pois()
    print(f"   ✓ Found {len(pois)} POIs\n")
    
    # Map POIs to nodes
    print("🔍 Mapping POIs to road network...")
    poi_nodes = {}
    for poi in pois:
        name = poi.get('name_en', poi.get('name'))
        nearest = graph.find_nearest_node(poi['lat'], poi['lon'], max_distance=500)
        if nearest:
            poi_nodes[name] = nearest.id
            print(f"   ✓ {name}: Node {nearest.id}")
    
    print(f"\n   Mapped {len(poi_nodes)}/{len(pois)} POIs\n")
    
    # Generate all pairs
    node_ids = list(poi_nodes.values())
    poi_pairs = list(combinations(node_ids, 2))
    
    print(f"🔄 Pre-computing {len(poi_pairs)} routes...")
    print("   This may take a few minutes...\n")
    
    # Progress callback
    def show_progress(current, total):
        percent = (current / total) * 100
        if current % 10 == 0 or current == total:
            print(f"   Progress: {current}/{total} ({percent:.1f}%)")
    
    # Pre-compute
    cached_count = optimizer.precompute_routes(poi_pairs, show_progress)
    
    # Show statistics
    print("\n" + "="*60)
    print("📊 CACHE STATISTICS")
    print("="*60)
    
    stats = cache.get_cache_statistics()
    print(f"\n   Total cached routes: {stats['total_routes']:,}")
    print(f"   New routes computed: {cached_count:,}")
    print(f"   Already cached: {len(poi_pairs) - cached_count:,}")
    print(f"   Database: {cache_file}")
    
    if stats['top_routes']:
        print(f"\n   🏆 Top accessed routes:")
        for i, route in enumerate(stats['top_routes'][:5], 1):
            print(f"      {i}. {route['start_id']} -> {route['end_id']}: "
                  f"{route['access_count']} accesses, {route['distance']:.0f}m")
    
    print("\n" + "="*60)
    print("✅ PRE-COMPUTATION COMPLETE!")
    print("="*60)
    print(f"\n💡 Routes between popular destinations are now instant!\n")


def test_cache_performance():
    """Test cache performance"""
    
    print("\n" + "="*60)
    print("⚡ TESTING CACHE PERFORMANCE")
    print("="*60 + "\n")
    
    # Load graph
    graph_file = get_graph_file("hanoi_center")
    graph = Graph()
    graph.load_from_file(str(graph_file))
    print(f"✓ Loaded graph from: {graph_file}\n")
    
    # Initialize cache
    cache = DestinationCache()
    optimizer = RouteOptimizer(graph, cache)
    print(f"✓ Cache ready: {get_cache_db_file()}\n")
    
    # Test routes
    nodes = list(graph.nodes.keys())
    if len(nodes) < 10:
        print("Not enough nodes for testing")
        return
    
    test_pairs = [
        (nodes[0], nodes[100]),
        (nodes[50], nodes[150]),
        (nodes[100], nodes[200]),
    ]
    
    print("Testing 3 sample routes:\n")
    
    for i, (start, end) in enumerate(test_pairs, 1):
        print(f"Route {i}: {start} -> {end}")
        
        import time
        
        # First query
        start_time = time.time()
        route1 = optimizer.find_route(start, end)
        time1 = (time.time() - start_time) * 1000
        
        # Second query (cached)
        start_time = time.time()
        route2 = optimizer.find_route(start, end)
        time2 = (time.time() - start_time) * 1000
        
        if route1 and route2:
            speedup = time1 / time2 if time2 > 0 else 0
            print(f"   First query: {time1:.2f}ms (calculated)")
            print(f"   Second query: {time2:.2f}ms (cached)")
            print(f"   ⚡ Speedup: {speedup:.1f}x faster\n")
    
    # Statistics
    stats = optimizer.get_statistics()
    print("="*60)
    print(f"Cache hit rate: {stats['hit_rate']:.1f}%")
    print(f"Total cached routes: {stats['cache']['total_routes']}")
    print("="*60 + "\n")


def show_statistics():
    """Show cache statistics"""
    cache = DestinationCache()
    stats = cache.get_cache_statistics()
    
    print(f"\n📊 Cache Statistics:")
    print(f"   Database: {get_cache_db_file()}")
    print(f"   Total routes: {stats['total_routes']:,}")
    print(f"   Total queries: {stats['total_queries']:,}")
    print(f"   Cache hits: {stats['total_hits']:,}")
    print(f"   Cache misses: {stats['total_misses']:,}")
    print(f"   Hit rate: {stats['hit_rate']:.1f}%\n")


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Pre-compute Hanoi routes")
    parser.add_argument('--precompute', action='store_true',
                       help='Pre-compute routes between POIs')
    parser.add_argument('--test', action='store_true',
                       help='Test cache performance')
    parser.add_argument('--stats', action='store_true',
                       help='Show cache statistics')
    
    args = parser.parse_args()
    
    if args.precompute:
        precompute_poi_routes()
    elif args.test:
        test_cache_performance()
    elif args.stats:
        show_statistics()
    else:
        parser.print_help()
        print("\n💡 Quick start:")
        print("   python backend/scripts/precompute_hanoi_routes.py --precompute\n")


if __name__ == "__main__":
    main()