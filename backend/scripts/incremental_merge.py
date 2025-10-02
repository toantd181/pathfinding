#!/usr/bin/env python3
"""
Incremental graph merger
Add new district graphs to an existing base graph without re-merging everything
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


def add_graph_to_existing(base_graph: Graph, new_graph: Graph) -> tuple:
    """
    Add nodes and edges from new_graph to base_graph (in-place)
    
    Args:
        base_graph: Existing graph to add to
        new_graph: New graph to add from
        
    Returns:
        Tuple of (nodes_added, edges_added, nodes_skipped, edges_skipped)
    """
    nodes_added = 0
    edges_added = 0
    nodes_skipped = 0
    edges_skipped = 0
    
    # Add nodes
    for node_id, node in new_graph.nodes.items():
        if node_id not in base_graph.nodes:
            new_node = Node(
                id=node.id,
                latitude=node.latitude,
                longitude=node.longitude,
                tags=node.tags.copy()
            )
            base_graph.add_node(new_node)
            nodes_added += 1
        else:
            nodes_skipped += 1
    
    # Add edges
    for edge_key, edge in new_graph.edges.items():
        if edge_key not in base_graph.edges:
            # Both nodes must exist
            if edge.from_node_id in base_graph.nodes and edge.to_node_id in base_graph.nodes:
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
                
                base_graph.edges[edge_key] = new_edge
                
                # Add neighbor relationships
                from_node = base_graph.nodes[edge.from_node_id]
                to_node = base_graph.nodes[edge.to_node_id]
                
                # Check if neighbor already exists
                neighbor_exists = any(n.id == to_node.id for n, _ in from_node.neighbors)
                if not neighbor_exists:
                    from_node.neighbors.append((to_node, edge.weight))
                
                edges_added += 1
        else:
            edges_skipped += 1
    
    return nodes_added, edges_added, nodes_skipped, edges_skipped


def incremental_merge(base_graph_name: str, new_graphs: list, 
                     output_name: str = None) -> Graph:
    """
    Incrementally add new districts to an existing base graph
    
    Args:
        base_graph_name: Name of existing base graph (e.g., 'hanoi_main')
        new_graphs: List of new graph file names to add
        output_name: Output name (default: same as base_graph_name)
        
    Returns:
        Updated graph
    """
    print("\n" + "="*60)
    print("➕ INCREMENTAL GRAPH MERGE")
    print("="*60 + "\n")
    
    # Load base graph
    base_file = get_graph_file(base_graph_name)
    
    if not base_file.exists():
        print(f"❌ Base graph not found: {base_file}")
        print(f"\n💡 Create a base graph first:")
        print(f"   python scripts/setup_hanoi_map.py --area center")
        print(f"   or")
        print(f"   python scripts/merge_graphs.py --files hanoi_center.pkl --output {base_graph_name}")
        return None
    
    print(f"📦 Loading base graph: {base_graph_name}")
    base_graph = Graph()
    base_graph.load_from_file(str(base_file))
    
    original_nodes = len(base_graph.nodes)
    original_edges = len(base_graph.edges)
    
    print(f"   Original: {original_nodes:,} nodes, {original_edges:,} edges\n")
    
    # Process each new graph
    total_nodes_added = 0
    total_edges_added = 0
    
    for i, new_graph_name in enumerate(new_graphs, 1):
        print(f"{'='*60}")
        print(f"📥 Adding graph {i}/{len(new_graphs)}: {new_graph_name}")
        
        new_file = get_graph_file(new_graph_name)
        
        if not new_file.exists():
            print(f"   ⚠️  File not found: {new_file}")
            print(f"   Skipping...")
            continue
        
        # Load new graph
        new_graph = Graph()
        new_graph.load_from_file(str(new_file))
        
        print(f"   Contains: {len(new_graph.nodes):,} nodes, {len(new_graph.edges):,} edges")
        
        # Add to base graph
        nodes_added, edges_added, nodes_skipped, edges_skipped = \
            add_graph_to_existing(base_graph, new_graph)
        
        print(f"   ✅ Added: {nodes_added:,} nodes, {edges_added:,} edges")
        print(f"   ⏭️  Skipped: {nodes_skipped:,} duplicate nodes, {edges_skipped:,} duplicate edges")
        
        total_nodes_added += nodes_added
        total_edges_added += edges_added
    
    # Update stats
    base_graph._update_stats()
    
    # Summary
    print(f"\n{'='*60}")
    print("📊 MERGE SUMMARY")
    print(f"{'='*60}")
    print(f"\n   Base graph: {base_graph_name}")
    print(f"   Graphs added: {len(new_graphs)}")
    print(f"\n   Before: {original_nodes:,} nodes, {original_edges:,} edges")
    print(f"   After:  {len(base_graph.nodes):,} nodes, {len(base_graph.edges):,} edges")
    print(f"\n   New nodes added: {total_nodes_added:,}")
    print(f"   New edges added: {total_edges_added:,}")
    
    # Validate
    print(f"\n🔍 Validating merged graph...")
    validation = base_graph.validate_graph()
    print(f"   Valid: {validation['valid']}")
    print(f"   Connected components: {validation['connected_components']}")
    
    if validation['connected_components'] > 1:
        print(f"   ⚠️  Graph has {validation['connected_components']} disconnected components")
    
    # Save
    if output_name is None:
        output_name = base_graph_name
    
    output_file = str(get_graph_file(output_name))
    print(f"\n💾 Saving to: {output_file}")
    base_graph.save_to_file(output_file)
    
    print(f"{'='*60}")
    print("✅ INCREMENTAL MERGE COMPLETE!")
    print(f"{'='*60}\n")
    
    return base_graph


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Incrementally add districts to existing graph",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Add hoan_kiem to hanoi_main
  python scripts/incremental_merge.py --base hanoi_main --add hanoi_hoan_kiem
  
  # Add multiple districts at once
  python scripts/incremental_merge.py --base hanoi_main --add hanoi_hoan_kiem hanoi_ba_dinh
  
  # Add and save as new name
  python scripts/incremental_merge.py --base hanoi_main --add hanoi_cau_giay --output hanoi_expanded
  
  # Interactive mode
  python scripts/incremental_merge.py
        """
    )
    
    parser.add_argument('--base', type=str,
                       help='Base graph name (without .pkl)')
    parser.add_argument('--add', nargs='+',
                       help='Graph names to add (without .pkl)')
    parser.add_argument('--output', type=str,
                       help='Output graph name (default: same as base)')
    
    args = parser.parse_args()
    
    # Interactive mode
    if not args.base or not args.add:
        print("\n🔄 INCREMENTAL GRAPH MERGER")
        print("="*60)
        print("Add new district graphs to an existing base graph\n")
        
        # List available graphs
        processed_dir = get_processed_dir()
        pkl_files = sorted(processed_dir.glob("*.pkl"))
        
        if not pkl_files:
            print("❌ No graph files found!")
            return
        
        print("📂 Available graphs:\n")
        for i, pkl_file in enumerate(pkl_files, 1):
            size_mb = pkl_file.stat().st_size / (1024 * 1024)
            # Try to load and get node count
            try:
                g = Graph()
                g.load_from_file(str(pkl_file))
                nodes = len(g.nodes)
                print(f"   {i:2}. {pkl_file.stem:25} ({nodes:,} nodes, {size_mb:.1f} MB)")
            except:
                print(f"   {i:2}. {pkl_file.stem:25} ({size_mb:.1f} MB)")
        
        # Select base
        print(f"\n🎯 Select BASE graph (the one to add to):")
        base_choice = input("   Enter number: ").strip()
        
        try:
            base_idx = int(base_choice) - 1
            if 0 <= base_idx < len(pkl_files):
                base_name = pkl_files[base_idx].stem
            else:
                print("Invalid choice")
                return
        except ValueError:
            print("Invalid input")
            return
        
        # Select graphs to add
        print(f"\n➕ Select graphs to ADD (space-separated numbers):")
        print(f"   (Don't select the base graph again)")
        add_choice = input("   Enter numbers: ").strip().split()
        
        add_names = []
        for num in add_choice:
            try:
                idx = int(num) - 1
                if 0 <= idx < len(pkl_files) and idx != base_idx:
                    add_names.append(pkl_files[idx].stem)
            except ValueError:
                continue
        
        if not add_names:
            print("\n❌ No graphs selected to add")
            return
        
        # Confirm
        print(f"\n📋 Will add to '{base_name}':")
        for name in add_names:
            print(f"   + {name}")
        
        confirm = input("\n✅ Proceed? (yes/no): ").strip().lower()
        if confirm not in ['yes', 'y']:
            print("❌ Cancelled")
            return
        
        # Perform merge
        incremental_merge(base_name, add_names, args.output)
        
    else:
        # Command-line mode
        incremental_merge(args.base, args.add, args.output)


if __name__ == "__main__":
    main()


# =====================================
# QUICK USAGE EXAMPLES
# =====================================

"""
INCREMENTAL MERGE - QUICK GUIDE

SCENARIO 1: You have hanoi_main and downloaded hoan_kiem
============================================================
python scripts/incremental_merge.py --base hanoi_main --add hanoi_hoan_kiem

Result: hanoi_main.pkl updated with hoan_kiem data
Time: ~10 seconds (not minutes!)


SCENARIO 2: Add multiple new districts
============================================================
python scripts/incremental_merge.py --base hanoi_main --add hanoi_hoan_kiem hanoi_ba_dinh hanoi_cau_giay

Result: All three districts added to hanoi_main
Time: ~30 seconds total


SCENARIO 3: Keep original, create new merged file
============================================================
python scripts/incremental_merge.py --base hanoi_main --add hanoi_dong_da --output hanoi_expanded

Result: hanoi_main unchanged, new file hanoi_expanded.pkl created


SCENARIO 4: Interactive mode (easiest!)
============================================================
python scripts/incremental_merge.py

   1. Shows all your graphs
   2. Pick base graph
   3. Pick graphs to add
   4. Done!


WORKFLOW EXAMPLE:
================

Day 1:
  python scripts/setup_hanoi_map.py --area center
  → Creates hanoi_center.pkl

Day 2:
  python scripts/setup_hanoi_map.py --area district --district hoan_kiem
  → Creates hanoi_hoan_kiem.pkl
  
  python scripts/incremental_merge.py --base hanoi_center --add hanoi_hoan_kiem --output hanoi_main
  → Creates hanoi_main.pkl (10 seconds!)

Day 3:
  python scripts/setup_hanoi_map.py --area district --district ba_dinh
  → Creates hanoi_ba_dinh.pkl
  
  python scripts/incremental_merge.py --base hanoi_main --add hanoi_ba_dinh
  → Updates hanoi_main.pkl (10 seconds!)

Day 4:
  python scripts/setup_hanoi_map.py --area district --district cau_giay
  python scripts/incremental_merge.py --base hanoi_main --add hanoi_cau_giay
  → Updates hanoi_main.pkl (10 seconds!)


WHY THIS IS BETTER:
==================
❌ Old way: Re-merge ALL graphs each time (5+ minutes)
✅ New way: Add only NEW district (10 seconds)

✅ No re-downloading
✅ No re-parsing
✅ No re-processing duplicates
✅ Keep building on your base graph
✅ Much faster!


TIPS:
====
1. Start with a good base (hanoi_center or hanoi_main)
2. Download districts one at a time
3. Incrementally add each new district
4. Your base graph keeps growing
5. Always faster than full merge!
"""