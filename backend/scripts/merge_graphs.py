"""
Merge multiple district graph files into one comprehensive Hanoi graph
"""

import sys
import os
from pathlib import Path
import logging

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from src.core.graph import Graph
from src.core.node import Node
from src.core.edge import Edge
from src.utils.path_utils import get_processed_dir, get_graph_file

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


def merge_graphs(graph_files: list, output_name: str = "hanoi_merged") -> Graph:
    """
    Merge multiple graph files into one
    
    Args:
        graph_files: List of graph file paths
        output_name: Name for the merged graph
        
    Returns:
        Merged Graph object
    """
    print("\n" + "="*60)
    print("🔄 MERGING DISTRICT GRAPHS")
    print("="*60 + "\n")
    
    # Create new merged graph
    merged_graph = Graph()
    
    total_nodes_added = 0
    total_edges_added = 0
    duplicate_nodes = 0
    duplicate_edges = 0
    
    # Process each graph file
    for i, graph_file in enumerate(graph_files, 1):
        if not Path(graph_file).exists():
            logger.warning(f"⚠️  File not found: {graph_file}")
            continue
        
        print(f"📦 Loading graph {i}/{len(graph_files)}: {Path(graph_file).name}")
        
        # Load source graph
        source_graph = Graph()
        source_graph.load_from_file(str(graph_file))
        
        print(f"   Nodes: {len(source_graph.nodes):,}, Edges: {len(source_graph.edges):,}")
        
        # Merge nodes
        nodes_added = 0
        for node_id, node in source_graph.nodes.items():
            if node_id not in merged_graph.nodes:
                # Create new node (without neighbors yet)
                new_node = Node(
                    id=node.id,
                    latitude=node.latitude,
                    longitude=node.longitude,
                    tags=node.tags.copy()
                )
                merged_graph.add_node(new_node)
                nodes_added += 1
            else:
                duplicate_nodes += 1
        
        print(f"   ✅ Added {nodes_added:,} new nodes ({duplicate_nodes:,} duplicates skipped)")
        total_nodes_added += nodes_added
        
        # Merge edges
        edges_added = 0
        for edge_key, edge in source_graph.edges.items():
            if edge_key not in merged_graph.edges:
                # Both nodes must exist in merged graph
                if edge.from_node_id in merged_graph.nodes and edge.to_node_id in merged_graph.nodes:
                    new_edge = Edge(
                        from_node_id=edge.from_node_id,
                        to_node_id=edge.to_node_id,
                        weight=edge.weight,
                        road_type=edge.road_type,
                        max_speed=edge.max_speed,
                        tags=edge.tags.copy(),
                        bidirectional=edge.bidirectional,
                        name=edge.name
                    )
                    
                    # Add edge to merged graph
                    merged_graph.edges[edge_key] = new_edge
                    
                    # Add neighbor relationships
                    from_node = merged_graph.nodes[edge.from_node_id]
                    to_node = merged_graph.nodes[edge.to_node_id]
                    
                    # Check if neighbor already exists
                    neighbor_exists = any(n.id == to_node.id for n, _ in from_node.neighbors)
                    if not neighbor_exists:
                        from_node.add_neighbor(to_node, edge.weight)
                    
                    edges_added += 1
            else:
                duplicate_edges += 1
        
        print(f"   ✅ Added {edges_added:,} new edges ({duplicate_edges:,} duplicates skipped)\n")
        total_edges_added += edges_added
    
    # Update stats
    merged_graph._update_stats()
    
    # Print summary
    print("="*60)
    print("📊 MERGE SUMMARY")
    print("="*60)
    print(f"\n   Total graphs merged: {len(graph_files)}")
    print(f"   Total nodes: {len(merged_graph.nodes):,}")
    print(f"   Total edges: {len(merged_graph.edges):,}")
    print(f"   New nodes added: {total_nodes_added:,}")
    print(f"   New edges added: {total_edges_added:,}")
    print(f"   Duplicate nodes: {duplicate_nodes:,}")
    print(f"   Duplicate edges: {duplicate_edges:,}")
    
    # Validate merged graph
    print(f"\n🔍 Validating merged graph...")
    validation = merged_graph.validate_graph()
    print(f"   Valid: {validation['valid']}")
    print(f"   Connected components: {validation['connected_components']}")
    print(f"   Isolated nodes: {len(validation['isolated_nodes'])}")
    
    if validation['connected_components'] > 1:
        print(f"\n⚠️  Warning: Graph has {validation['connected_components']} disconnected components")
        print(f"   Some routes between districts may not be possible")
    
    # Save merged graph
    output_file = str(get_graph_file(output_name))
    print(f"\n💾 Saving merged graph to: {output_file}")
    merged_graph.save_to_file(output_file)
    
    print("="*60)
    print("✅ MERGE COMPLETE!")
    print("="*60 + "\n")
    
    return merged_graph


def find_all_district_graphs() -> list:
    """Find all district graph files in processed directory"""
    processed_dir = get_processed_dir()
    
    # Look for all .pkl files
    pkl_files = list(processed_dir.glob("*.pkl"))
    
    if not pkl_files:
        logger.error(f"No .pkl files found in {processed_dir}")
        return []
    
    print(f"\n📂 Found {len(pkl_files)} graph file(s) in {processed_dir}:\n")
    for pkl_file in pkl_files:
        size_mb = pkl_file.stat().st_size / (1024 * 1024)
        print(f"   • {pkl_file.name:30} ({size_mb:.1f} MB)")
    
    return [str(f) for f in pkl_files]


def select_graphs_to_merge() -> list:
    """Interactive selection of graphs to merge"""
    all_graphs = find_all_district_graphs()
    
    if not all_graphs:
        return []
    
    print(f"\n🤔 Which graphs do you want to merge?\n")
    print(f"   1. Merge ALL graphs")
    print(f"   2. Select specific graphs")
    print(f"   3. Cancel")
    
    choice = input("\nYour choice (1-3): ").strip()
    
    if choice == "1":
        return all_graphs
    elif choice == "2":
        selected = []
        print(f"\nSelect graphs to merge (enter numbers separated by space):")
        for i, graph_file in enumerate(all_graphs, 1):
            print(f"   {i}. {Path(graph_file).name}")
        
        selection = input("\nEnter numbers (e.g., 1 3 5): ").strip().split()
        
        for num in selection:
            try:
                idx = int(num) - 1
                if 0 <= idx < len(all_graphs):
                    selected.append(all_graphs[idx])
            except ValueError:
                continue
        
        return selected
    else:
        return []


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Merge multiple district graphs into one",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive mode - select which graphs to merge
  python scripts/merge_graphs.py
  
  # Merge all graphs automatically
  python scripts/merge_graphs.py --all
  
  # Merge specific graphs
  python scripts/merge_graphs.py --files hanoi_center.pkl hanoi_cau_giay.pkl
  
  # Specify output name
  python scripts/merge_graphs.py --all --output hanoi_main
        """
    )
    
    parser.add_argument('--all', action='store_true',
                       help='Merge all available graphs')
    parser.add_argument('--files', nargs='+',
                       help='Specific graph files to merge')
    parser.add_argument('--output', default='hanoi_merged',
                       help='Output graph name (default: hanoi_merged)')
    
    args = parser.parse_args()
    
    # Determine which graphs to merge
    if args.files:
        # Use specified files
        processed_dir = get_processed_dir()
        graph_files = [str(processed_dir / f) for f in args.files]
    elif args.all:
        # Use all graphs
        graph_files = find_all_district_graphs()
    else:
        # Interactive selection
        graph_files = select_graphs_to_merge()
    
    if not graph_files:
        print("\n❌ No graphs selected for merging")
        return
    
    if len(graph_files) < 2:
        print(f"\n⚠️  Only {len(graph_files)} graph selected")
        print(f"   Need at least 2 graphs to merge")
        return
    
    # Confirm merge
    print(f"\n📋 Will merge {len(graph_files)} graphs:")
    for gf in graph_files:
        print(f"   • {Path(gf).name}")
    
    print(f"\n   Output: {args.output}.pkl")
    
    confirm = input("\n✅ Proceed with merge? (yes/no): ").strip().lower()
    
    if confirm not in ['yes', 'y']:
        print("\n❌ Merge cancelled")
        return
    
    # Perform merge
    merged_graph = merge_graphs(graph_files, args.output)
    
    # Usage instructions
    print(f"\n📝 To use the merged graph in your API:")
    print(f"   1. Update PathfindingService:")
    print(f"      PathfindingService(graph_name='{args.output}')")
    print(f"\n   2. Or set as default in pathfinding_service.py:")
    print(f"      def __init__(self, graph_name: str = '{args.output}'):")
    print()


if __name__ == "__main__":
    main()
