from src.core.graph import Graph
from collections import deque
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

print("Loading graph...")
graph = Graph()
graph.load_from_file('data/processed/hanoi_main.pkl')

print(f"Total nodes: {len(graph.nodes)}")

# Find all components
visited = set()
components = []

for start_id in list(graph.nodes.keys())[:50000]:  # Limit for speed
    if start_id not in visited:
        component = set()
        queue = deque([start_id])
        
        while queue and len(component) < 100000:
            node_id = queue.popleft()
            if node_id not in visited:
                visited.add(node_id)
                component.add(node_id)
                for neighbor, _ in graph.get_neighbors(node_id):
                    queue.append(neighbor.id)
        
        components.append(component)

components.sort(key=len, reverse=True)
print(f"Found {len(components)} components")
for i, comp in enumerate(components[:5]):
    print(f"  Component {i+1}: {len(comp)} nodes")

if len(components) == 1:
    print("Already connected!")
    exit()

# Connect components
main = components[0]
bridges = 0

for comp in components[1:]:
    if len(comp) < 10:  # Skip tiny components
        continue
        
    best_dist = float('inf')
    best_pair = None
    
    # Sample 100 nodes from each
    comp_sample = list(comp)[:100]
    main_sample = list(main)[:100]
    
    for n1_id in comp_sample:
        n1 = graph.nodes[n1_id]
        for n2_id in main_sample:
            n2 = graph.nodes[n2_id]
            dist = haversine(n1.latitude, n1.longitude, n2.latitude, n2.longitude)
            if dist < best_dist:
                best_dist = dist
                best_pair = (n1_id, n2_id)
    
    if best_pair and best_dist < 3000:  # Max 3km
        n1 = graph.nodes[best_pair[0]]
        n2 = graph.nodes[best_pair[1]]
        n1.add_neighbor(n2, best_dist)
        n2.add_neighbor(n1, best_dist)
        bridges += 1
        print(f"Bridge {bridges}: {best_dist:.0f}m, component size {len(comp)}")
        main.update(comp)

print(f"\nAdded {bridges} bridges")
graph.save_to_file('data/processed/hanoi_main_fixed.pkl')
print("Saved to hanoi_main_fixed.pkl")