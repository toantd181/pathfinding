"""
Download complete unified Hanoi road network
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.data.osm_downloader import OSMDownloader
import logging

logging.basicConfig(level=logging.INFO)

# Hanoi bounding box (covers all your districts)
bbox = (20.95, 105.75, 21.15, 105.95)  # (min_lat, min_lon, max_lat, max_lon)

downloader = OSMDownloader(timeout=600)  # 10 minute timeout

print("Downloading unified Hanoi road network...")
print("This may take 5-10 minutes...")

success = downloader.download_by_bbox(
    bbox=bbox,
    output_file='data/maps/hanoi_unified.osm'
)

if success:
    print("\n✓ Download complete!")
    print("Next: Run the processing script")
else:
    print("\n✗ Download failed. Check logs above.")
