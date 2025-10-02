"""
Run the REST API server
"""

import os
import sys
import logging
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from src.api.rest_endpoints import create_app

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Main function to run the API server"""
    
    print("\n" + "="*60)
    print("🚀 STARTING PATHFINDING API SERVER")
    print("="*60)
    
    # Create Flask app
    app = create_app()
    
    # Get configuration
    host = os.getenv('API_HOST', '0.0.0.0')
    port = int(os.getenv('API_PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    print(f"\n📍 Server starting on http://{host}:{port}")
    print(f"🔧 Debug mode: {debug}")
    print(f"\n📚 API Documentation:")
    print(f"   Health: http://localhost:{port}/api/health")
    print(f"   Info: http://localhost:{port}/api/info")
    print(f"   Route: POST http://localhost:{port}/api/route/coordinates")
    print("\n" + "="*60 + "\n")
    
    # Run server
    app.run(host=host, port=port, debug=debug)


if __name__ == '__main__':
    main()
