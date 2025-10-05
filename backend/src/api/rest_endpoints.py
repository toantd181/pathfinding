"""
Flask REST API endpoints for pathfinding service
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from typing import Dict, Any
from .pathfinding_service import PathfindingService

logger = logging.getLogger(__name__)


def create_app():
    """Create and configure Flask application"""
    app = Flask(__name__)
    
    # Enable CORS for frontend
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:3000", "http://localhost:5173"],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type"]
        }
    })
    
    # Initialize pathfinding service
    try:
        pathfinding_service = PathfindingService()
        logger.info("Pathfinding service initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize pathfinding service: {e}")
        pathfinding_service = None
    
    # Helper function to validate service
    def check_service():
        if pathfinding_service is None:
            return jsonify({
                'success': False,
                'error': 'Pathfinding service not initialized. Please ensure graph data is available.'
            }), 503
        return None
    
    # ============== ROUTES ==============
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Health check endpoint"""
        return jsonify({
            'status': 'healthy',
            'service': 'pathfinding-api',
            'version': '1.0.0'
        })
    
    @app.route('/api/info', methods=['GET'])
    def info():
        """API information"""
        error = check_service()
        if error:
            return error
        
        stats = pathfinding_service.get_statistics()
        
        return jsonify({
            'success': True,
            'service': {
                'name': 'Hanoi Pathfinding API',
                'version': '1.0.0',
                'description': 'A* pathfinding with intelligent caching'
            },
            'graph': stats['graph'],
            'cache': {
                'total_routes': stats['cache']['total_routes'],
                'hit_rate': stats['cache']['hit_rate']
            },
            'endpoints': {
                'route_coordinates': 'POST /api/route/coordinates',
                'route_nodes': 'POST /api/route/nodes',
                'nearest_node': 'GET /api/node/nearest',
                'statistics': 'GET /api/statistics'
            }
        })
    
    @app.route('/api/route/coordinates', methods=['POST'])
    def route_by_coordinates():
        """
        Find route between two GPS coordinates
        
        Request body:
        {
            "start": {"lat": 21.0285, "lon": 105.8542},
            "end": {"lat": 21.0047, "lon": 105.8438},
            "use_cache": true (optional)
        }
        """
        error = check_service()
        if error:
            return error
        
        data = request.get_json()
        
        # Validate input
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        if 'start' not in data or 'end' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing start or end coordinates'
            }), 400
        
        start = data['start']
        end = data['end']
        
        if 'lat' not in start or 'lon' not in start:
            return jsonify({
                'success': False,
                'error': 'Invalid start coordinates'
            }), 400
        
        if 'lat' not in end or 'lon' not in end:
            return jsonify({
                'success': False,
                'error': 'Invalid end coordinates'
            }), 400
        
        use_cache = data.get('use_cache', True)
        
        # Find route
        try:
            route = pathfinding_service.find_route_by_coordinates(
                start['lat'], start['lon'],
                end['lat'], end['lon'],
                use_cache=use_cache
            )
            
            if route:
                return jsonify(route)
            else:
                return jsonify({
                    'success': False,
                    'error': 'No route found between the specified points'
                }), 404
                
        except Exception as e:
            logger.error(f"Error finding route: {e}")
            return jsonify({
                'success': False,
                'error': f'Internal error: {str(e)}'
            }), 500
    
    @app.route('/api/route/nodes', methods=['POST'])
    def route_by_nodes():
        """
        Find route between two node IDs
        
        Request body:
        {
            "start_id": 123456,
            "end_id": 789012,
            "use_cache": true (optional)
        }
        """
        error = check_service()
        if error:
            return error
        
        data = request.get_json()
        
        if not data or 'start_id' not in data or 'end_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing start_id or end_id'
            }), 400
        
        use_cache = data.get('use_cache', True)
        
        try:
            route = pathfinding_service.find_route_by_node_ids(
                data['start_id'],
                data['end_id'],
                use_cache=use_cache
            )
            
            if route:
                return jsonify(route)
            else:
                return jsonify({
                    'success': False,
                    'error': 'No route found'
                }), 404
                
        except Exception as e:
            logger.error(f"Error finding route: {e}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @app.route('/api/node/nearest', methods=['GET'])
    def nearest_node():
        """
        Find nearest road node to coordinates
        
        Query parameters:
        - lat: Latitude
        - lon: Longitude
        - max_distance: Maximum search distance in meters (optional, default: 500)
        """
        error = check_service()
        if error:
            return error
        
        try:
            lat = float(request.args.get('lat'))
            lon = float(request.args.get('lon'))
        except (TypeError, ValueError):
            return jsonify({
                'success': False,
                'error': 'Invalid or missing lat/lon parameters'
            }), 400
        
        max_distance = float(request.args.get('max_distance', 500))
        
        try:
            node = pathfinding_service.get_node_by_coordinates(lat, lon, max_distance)
            
            if node:
                return jsonify({
                    'success': True,
                    'node': node
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'No road found within search radius'
                }), 404
                
        except Exception as e:
            logger.error(f"Error finding node: {e}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @app.route('/api/statistics', methods=['GET'])
    def statistics():
        """Get service statistics"""
        error = check_service()
        if error:
            return error
        
        try:
            stats = pathfinding_service.get_statistics()
            return jsonify({
                'success': True,
                'statistics': stats
            })
        except Exception as e:
            logger.error(f"Error getting statistics: {e}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'success': False,
            'error': 'Endpoint not found'
        }), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500
    
    from .manual_graph_endpoints import manual_graph_bp
    app.register_blueprint(manual_graph_bp)

    return app