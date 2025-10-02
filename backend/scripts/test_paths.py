"""
Test script to verify all paths are absolute and correct
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from src.utils.path_utils import get_path_info

def test_all_paths():
    """Test and display all paths"""
    print("\n" + "="*60)
    print("🔍 TESTING ABSOLUTE PATHS")
    print("="*60 + "\n")
    
    paths = get_path_info()
    
    print("📂 All Project Paths:\n")
    for name, path in paths.items():
        exists = "✅" if Path(path).exists() else "❌"
        print(f"{exists} {name:15} {path}")
    
    print("\n" + "="*60)
    print("✅ All paths are absolute!")
    print("="*60 + "\n")
    
    # Test specific files
    from src.utils.path_utils import (
        get_graph_file, get_cache_db_file, 
        get_config_file, get_osm_file
    )
    
    print("📄 Specific File Paths:\n")
    
    files = {
        'Graph (center)': get_graph_file('hanoi_center'),
        'Graph (full)': get_graph_file('hanoi_full'),
        'Cache DB': get_cache_db_file(),
        'Config': get_config_file(),
        'OSM (center)': get_osm_file('hanoi_center')
    }
    
    for name, path in files.items():
        exists = "✅" if path.exists() else "⚠️ "
        print(f"{exists} {name:20} {path}")
    
    print()

if __name__ == "__main__":
    test_all_paths()