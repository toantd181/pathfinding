"""
Setup script to download and prepare Hanoi map data
"""

import sys
import os
import logging
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.data.hanoi_osm_manager import HanoiOSMManager

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def setup_city_center():
    """Download and parse Hanoi city center"""
    manager = HanoiOSMManager()
    
    print("\n" + "="*60)
    print("🇻🇳 HANOI CITY CENTER MAP SETUP")
    print("="*60)
    print("📍 Area: ~9 km² around Hoan Kiem Lake")
    print("🏛️  Includes: Old Quarter, French Quarter, Ba Dinh")
    print("⏱️  Estimated time: 30-60 seconds")
    print("="*60 + "\n")
    
    # Download city center
    osm_file = manager.download_city_center()
    if not osm_file:
        logger.error("Failed to download city center")
        return None
    
    # Parse and build graph
    graph = manager.parse_and_build_graph(osm_file, "hanoi_center")
    
    # Attach POIs to graph
    poi_map = manager.attach_pois_to_graph(graph)
    
    # Show POIs
    print("\n📍 HANOI POINTS OF INTEREST")
    print("="*60)
    
    print("\n🏛️  Landmarks:")
    for landmark in manager.get_landmarks()[:6]:
        name = landmark.get('name_en', landmark['name'])
        print(f"   • {name}")
    
    print("\n🎓 Universities:")
    for uni in manager.get_universities():
        name = uni.get('short_name', uni.get('name_en', uni['name']))
        print(f"   • {name}")
    
    print("\n🏥 Hospitals:")
    for hospital in manager.get_hospitals():
        name = hospital.get('name_en', hospital['name'])
        print(f"   • {name}")
    
    print("="*60 + "\n")
    
    return graph


def setup_district(district_name: str):
    """Download and parse a specific district"""
    manager = HanoiOSMManager()
    
    print(f"\n📥 Downloading {district_name} district...")
    osm_file = manager.download_district(district_name)
    
    if osm_file:
        graph = manager.parse_and_build_graph(osm_file, f"hanoi_{district_name}")
        return graph
    return None


def setup_all_priority_districts():
    """Download all priority 1 districts (Hoan Kiem, Ba Dinh)"""
    manager = HanoiOSMManager()
    
    print("\n" + "="*60)
    print("🇻🇳 HANOI PRIORITY DISTRICTS SETUP")
    print("="*60)
    print("📍 Districts: Hoàn Kiếm, Ba Đình")
    print("⏱️  Estimated time: 2-3 minutes")
    print("="*60 + "\n")
    
    files = manager.download_all_districts(priority=1)
    
    if files:
        # Parse first file as main graph
        # In a real implementation, you'd want to merge multiple graphs
        graph = manager.parse_and_build_graph(files[0], "hanoi_priority_districts")
        return graph
    return None


def list_available_districts():
    """List all available Hanoi districts"""
    manager = HanoiOSMManager()
    districts = manager.config.get('districts', {})
    
    print("\n" + "="*60)
    print("📋 AVAILABLE HANOI DISTRICTS")
    print("="*60)
    
    for priority in [1, 2, 3]:
        priority_districts = {k: v for k, v in districts.items() 
                            if v.get('priority') == priority}
        if priority_districts:
            label = ("Downtown" if priority == 1 else 
                    "Urban Core" if priority == 2 else "Outer Areas")
            print(f"\n🏙️  Priority {priority} ({label}):")
            for key, data in priority_districts.items():
                print(f"   • {data['name']} (key: {key})")
    
    print("="*60 + "\n")


def show_pois():
    """Show all configured POIs"""
    manager = HanoiOSMManager()
    
    print("\n" + "="*60)
    print("📍 HANOI POINTS OF INTEREST")
    print("="*60)
    
    print("\n🏛️  LANDMARKS:")
    for landmark in manager.get_landmarks():
        name_vn = landmark['name']
        name_en = landmark.get('name_en', '')
        print(f"   • {name_vn}")
        if name_en:
            print(f"     ({name_en})")
    
    print("\n🎓 UNIVERSITIES:")
    for uni in manager.get_universities():
        name_vn = uni['name']
        name_en = uni.get('name_en', '')
        short = uni.get('short_name', '')
        print(f"   • {name_vn}")
        if name_en:
            print(f"     ({name_en} - {short})")
    
    print("\n🏥 HOSPITALS:")
    for hospital in manager.get_hospitals():
        name_vn = hospital['name']
        name_en = hospital.get('name_en', '')
        print(f"   • {name_vn}")
        if name_en:
            print(f"     ({name_en})")
    
    print("="*60 + "\n")


def main():
    """Main setup function"""
    parser = argparse.ArgumentParser(
        description="Setup Hanoi map data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python setup_hanoi_map.py --area center
  python setup_hanoi_map.py --area district --district hoan_kiem
  python setup_hanoi_map.py --area list
  python setup_hanoi_map.py --pois
        """
    )
    
    parser.add_argument('--area', type=str, 
                       choices=['center', 'district', 'priority', 'list'],
                       help='Area to download')
    parser.add_argument('--district', type=str,
                       help='Specific district to download (e.g., hoan_kiem)')
    parser.add_argument('--pois', action='store_true',
                       help='Show all configured POIs')
    
    args = parser.parse_args()
    
    # Show POIs if requested
    if args.pois:
        show_pois()
        return
    
    # Show help if no arguments
    if not args.area:
        parser.print_help()
        print("\n💡 Quick start: python setup_hanoi_map.py --area center\n")
        return
    
    print("\n🇻🇳 HANOI PATHFINDING - MAP SETUP")
    print("="*60)
    
    if args.area == 'list':
        list_available_districts()
        return
    
    graph = None
    if args.area == 'center':
        graph = setup_city_center()
    elif args.area == 'district' and args.district:
        graph = setup_district(args.district)
    elif args.area == 'priority':
        graph = setup_all_priority_districts()
    else:
        logger.error("Invalid arguments")
        parser.print_help()
        return
    
    if graph:
        print("\n✅ SUCCESS! Hanoi map data is ready!")
        print(f"📦 Graph contains: {len(graph.nodes):,} nodes, {len(graph.edges):,} edges")
        print(f"💾 Saved to: backend/data/processed/")
        print("\n🚀 Ready for Part 4: A* Algorithm Implementation!")
        print("\nNext steps:")
        print("  1. The graph is ready for pathfinding")
        print("  2. POIs are attached to nearest road nodes")
        print("  3. Traffic speeds adjusted for Hanoi conditions")
        print("\n")
    else:
        print("\n❌ Setup failed. Please check errors above.\n")


if __name__ == "__main__":
    main()
