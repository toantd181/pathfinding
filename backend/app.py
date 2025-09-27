"""
Main Flask application for the Pathfinding API
"""
from flask import Flask, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import logging
from datetime import datetime

# Load environment variables
load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
    app.config['DEBUG'] = os.getenv('FLASK_ENV') == 'development'
    
    # CORS setup
    CORS(app, origins=os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(','))
    
    # Logging setup
    if not os.path.exists('logs'):
        os.makedirs('logs')
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('logs/app.log'),
            logging.StreamHandler()
        ]
    )
    
    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'version': '1.0.0'
        })
    
    # Basic info endpoint
    @app.route('/api/info', methods=['GET'])
    def info():
        return jsonify({
            'name': 'Pathfinding API',
            'version': '1.0.0',
            'description': 'OpenStreetMap-based pathfinding with A* algorithm',
            'endpoints': {
                'health': '/api/health',
                'route': '/api/route (POST)',
                'geocode': '/api/geocode (GET)',
                'info': '/api/info'
            }
        })
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(
        host=os.getenv('HOST', '0.0.0.0'),
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('FLASK_ENV') == 'development'
    )
