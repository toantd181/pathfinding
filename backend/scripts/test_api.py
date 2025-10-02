"""
Test script for REST API endpoints
"""

import requests
import json
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


API_URL = "http://localhost:5000/api"


def test_health():
    """Test health endpoint"""
    print("\n🔍 Testing /api/health...")
    response = requests.get(f"{API_URL}/health")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    return response.status_code == 200


def test_info():
    """Test info endpoint"""
    print("\n📊 Testing /api/info...")
    response = requests.get(f"{API_URL}/info")
    print(f"   Status: {response.status_code}")
    data = response.json()
    if data.get('success'):
        print(f"   Graph nodes: {data['graph']['nodes']}")
        print(f"   Cache routes: {data['cache']['total_routes']}")
        print(f"   Hit rate: {data['cache']['hit_rate']:.1f}%")
    return response.status_code == 200


def test_route_coordinates():
    """Test route by coordinates"""
    print("\n🗺️  Testing /api/route/coordinates...")
    print("   Route: Hoan Kiem Lake → HUST")
    
    payload = {
        "start": {"lat": 21.0285, "lon": 105.8542},  # Hoan Kiem Lake
        "end": {"lat": 21.0047, "lon": 105.8438},    # HUST
        "use_cache": True
    }
    
    response = requests.post(
        f"{API_URL}/route/coordinates",
        json=payload,
        headers={'Content-Type': 'application/json'}
    )
    
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            route = data['route']
            print(f"   ✅ Route found!")
            print(f"   Distance: {route['summary']['distance_km']} km")
            print(f"   Time: {route['summary']['travel_time_minutes']} minutes")
            print(f"   Nodes: {route['summary']['nodes_count']}")
            print(f"   Cached: {route['cached']}")
            print(f"   Calculation: {route['calculation_time']*1000:.1f}ms")
            return True
    else:
        print(f"   ❌ Error: {response.json()}")
        return False


def test_nearest_node():
    """Test nearest node endpoint"""
    print("\n📍 Testing /api/node/nearest...")
    print("   Location: Near Hoan Kiem Lake")
    
    response = requests.get(
        f"{API_URL}/node/nearest",
        params={'lat': 21.0285, 'lon': 105.8542}
    )
    
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            node = data['node']
            print(f"   ✅ Node found!")
            print(f"   Node ID: {node['node_id']}")
            print(f"   Distance: {node['distance']:.1f}m")
            return True
    
    return False


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("🧪 TESTING PATHFINDING API")
    print("="*60)
    print("\n⚠️  Make sure the API server is running:")
    print("   python backend/run_api.py")
    
    input("\nPress Enter to start tests...")
    
    tests = [
        ("Health Check", test_health),
        ("API Info", test_info),
        ("Nearest Node", test_nearest_node),
        ("Route by Coordinates", test_route_coordinates),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except requests.exceptions.ConnectionError:
            print(f"\n❌ Cannot connect to API server at {API_URL}")
            print("   Make sure the server is running!")
            return
        except Exception as e:
            print(f"\n❌ Error in test: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {status}: {name}")
    
    print(f"\n   Total: {passed}/{total} tests passed")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()