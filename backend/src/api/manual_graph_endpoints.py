"""
API endpoints for manual graph building
"""
from flask import Blueprint, request, jsonify
import json
from pathlib import Path

manual_graph_bp = Blueprint('manual_graph', __name__)

GRAPH_FILE = Path('data/manual/hanoi_manual_graph_v1.json')
GRAPH_FILE.parent.mkdir(parents=True, exist_ok=True)

@manual_graph_bp.route('/api/graph/save', methods=['POST'])
def save_manual_graph():
    """Save manually created graph"""
    data = request.get_json()
    
    with open(GRAPH_FILE, 'w') as f:
        json.dump(data, f, indent=2)
    
    return jsonify({'success': True, 'message': 'Graph saved'})

@manual_graph_bp.route('/api/graph/load', methods=['GET'])
def load_manual_graph():
    """Load manually created graph"""
    if GRAPH_FILE.exists():
        with open(GRAPH_FILE) as f:
            data = json.load(f)
        return jsonify(data)
    return jsonify({'nodes': [], 'edges': []})