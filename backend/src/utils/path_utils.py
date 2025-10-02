"""
Centralized path management with absolute paths
All project paths flow through here
"""

import os
from pathlib import Path


def get_project_root() -> Path:
    """
    Get absolute path to project root
    Works from any file in the project
    """
    # This file is at: backend/src/utils/path_utils.py
    # Go up 3 levels: utils -> src -> backend -> project_root
    current_file = Path(__file__).resolve()
    backend_dir = current_file.parent.parent.parent
    project_root = backend_dir.parent
    return project_root


def get_backend_dir() -> Path:
    """Get absolute path to backend directory"""
    return get_project_root() / "backend"


def get_src_dir() -> Path:
    """Get absolute path to src directory"""
    return get_backend_dir() / "src"


def get_data_dir() -> Path:
    """Get absolute path to data directory"""
    data_dir = get_backend_dir() / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def get_maps_dir() -> Path:
    """Get absolute path to maps directory"""
    maps_dir = get_data_dir() / "maps"
    maps_dir.mkdir(parents=True, exist_ok=True)
    return maps_dir


def get_hanoi_maps_dir() -> Path:
    """Get absolute path to Hanoi maps directory"""
    hanoi_dir = get_maps_dir() / "hanoi"
    hanoi_dir.mkdir(parents=True, exist_ok=True)
    return hanoi_dir


def get_processed_dir() -> Path:
    """Get absolute path to processed data directory"""
    processed_dir = get_data_dir() / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)
    return processed_dir


def get_cache_dir() -> Path:
    """Get absolute path to cache directory"""
    cache_dir = get_data_dir() / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def get_config_dir() -> Path:
    """Get absolute path to config directory"""
    config_dir = get_backend_dir() / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir


def get_logs_dir() -> Path:
    """Get absolute path to logs directory"""
    logs_dir = get_backend_dir() / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    return logs_dir


def get_scripts_dir() -> Path:
    """Get absolute path to scripts directory"""
    return get_backend_dir() / "scripts"


# === File-specific paths ===

def get_graph_file(name: str = "hanoi_center") -> Path:
    """
    Get absolute path to a graph file
    
    Args:
        name: Graph name (without .pkl extension)
    """
    return get_processed_dir() / f"{name}.pkl"


def get_cache_db_file() -> Path:
    """Get absolute path to cache database"""
    return get_cache_dir() / "routes.db"


def get_config_file(name: str = "hanoi_config.yaml") -> Path:
    """
    Get absolute path to a config file
    
    Args:
        name: Config filename
    """
    return get_config_dir() / name


def get_osm_file(area: str) -> Path:
    """
    Get absolute path to an OSM file
    
    Args:
        area: Area name (e.g., 'hanoi_center', 'hoan_kiem')
    """
    return get_hanoi_maps_dir() / f"{area}.osm"


def get_log_file(name: str = "app.log") -> Path:
    """Get absolute path to a log file"""
    return get_logs_dir() / name


# === Utility functions ===

def ensure_all_directories():
    """Create all necessary directories"""
    directories = [
        get_data_dir(),
        get_maps_dir(),
        get_hanoi_maps_dir(),
        get_processed_dir(),
        get_cache_dir(),
        get_config_dir(),
        get_logs_dir()
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)


def get_path_info() -> dict:
    """Get information about all paths"""
    return {
        'project_root': str(get_project_root()),
        'backend': str(get_backend_dir()),
        'data': str(get_data_dir()),
        'maps': str(get_maps_dir()),
        'processed': str(get_processed_dir()),
        'cache': str(get_cache_dir()),
        'config': str(get_config_dir()),
        'logs': str(get_logs_dir())
    }


# Initialize directories on import
ensure_all_directories()