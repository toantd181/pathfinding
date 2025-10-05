@app.route('/api/coverage/check', methods=['POST'])
def check_coverage():
    """
    Check if a point is within coverage area
    
    Request: {"lat": 21.0285, "lon": 105.8542}
    Response: {"in_coverage": true, "nearest_distance": 45.2}
    """
    data = request.get_json()
    lat = data.get('lat')
    lon = data.get('lon')
    
    if not lat or not lon:
        return jsonify({'success': False, 'error': 'Missing lat/lon'}), 400
    
    # Find nearest node within reasonable distance
    node = pathfinding_service.get_node_by_coordinates(lat, lon, max_distance=1000)
    
    if node:
        return jsonify({
            'success': True,
            'in_coverage': True,
            'nearest_distance': node['distance']
        })
    else:
        return jsonify({
            'success': True,
            'in_coverage': False,
            'nearest_distance': None
        })