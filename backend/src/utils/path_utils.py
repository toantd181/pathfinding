"""
Path utility functions for consistent absolute path handling
"""

import os
from pathlib import Path


def get_project_root() -> Path:
    """
    Get the absolute path to the project root directory
    
    Returns:
        Path object pointing to project root
    """
    # This file is in backend/src/utils/
    # Go up 3 levels to reach project root
    current_file = Path(__file__).resolve()
    project_root = current_file.parent.parent.parent.parent
    return project_root


def get_backend_dir() -> Path:
    """
    Get the absolute path to the backend directory
    
    Returns:
        Path object pointing to backend directory
    """
    return get_project_root() / "backend"


def get_data_dir() -> Path:
    """Get absolute path to data directory"""
    return get_backend_dir() / "data"


def get_maps_dir() -> Path:
    """Get absolute path to maps directory"""
    return get_data_dir() / "maps"


def get_processed_dir() -> Path:
    """Get absolute path to processed data directory"""
    return get_data_dir() / "processed"


def get_cache_dir() -> Path:
    """Get absolute path to cache directory"""
    return get_data_dir() / "cache"


def get_config_dir() -> Path:
    """Get absolute path to config directory"""
    return get_backend_dir() / "config"


def ensure_directories():
    """Create all necessary directories if they don't exist"""
    directories = [
        get_data_dir(),
        get_maps_dir(),
        get_processed_dir(),
        get_cache_dir(),
        get_config_dir(),
        get_maps_dir() / "hanoi"
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)


def get_graph_file(name: str = "hanoi_center") -> Path:
    """
    Get absolute path to a graph file
    
    Args:
        name: Graph name (without .pkl extension)
        
    Returns:
        Absolute path to graph file
    """
    return get_processed_dir() / f"{name}.pkl"


def get_cache_db_file() -> Path:
    """Get absolute path to cache database"""
    return get_cache_dir() / "routes.db"


def get_config_file(name: str = "hanoi_config.yaml") -> Path:
    """
    Get absolute path to a config file
    
    Args:
        name: Config file name
        
    Returns:
        Absolute path to config file
    """
    return get_config_dir() / name


# Initialize directories on import
ensure_directories()
