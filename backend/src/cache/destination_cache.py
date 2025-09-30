"""
Route caching system with absolute path handling
"""

import sqlite3
import pickle
import logging
from typing import List, Optional, Dict
from datetime import datetime, timedelta

from ..utils.path_utils import get_cache_db_file

logger = logging.getLogger(__name__)


class DestinationCache:
    """
    Persistent cache for storing calculated routes
    Uses absolute paths for database location
    """
    
    def __init__(self, db_path: str = None):
        """
        Initialize route cache
        
        Args:
            db_path: Optional custom path to SQLite database file
                    If None, uses default absolute path
        """
        if db_path is None:
            self.db_path = str(get_cache_db_file())
        else:
            self.db_path = db_path
        
        logger.info(f"Cache database path: {self.db_path}")
        
        # Initialize database
        self.init_database()
        
        # Statistics
        self.stats = {
            'hits': 0,
            'misses': 0,
            'total_queries': 0,
            'cache_size': 0
        }
        
        self._update_stats()
    
    def init_database(self):
        """Create database tables if they don't exist"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Routes table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cached_routes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_id INTEGER NOT NULL,
                end_id INTEGER NOT NULL,
                route_data BLOB NOT NULL,
                distance REAL NOT NULL,
                travel_time REAL NOT NULL,
                nodes_count INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                access_count INTEGER DEFAULT 0,
                UNIQUE(start_id, end_id)
            )
        ''')
        
        # Create indexes for fast lookups
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_start_end 
            ON cached_routes(start_id, end_id)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_last_accessed 
            ON cached_routes(last_accessed)
        ''')
        
        # Statistics table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cache_stats (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                total_routes INTEGER DEFAULT 0,
                total_hits INTEGER DEFAULT 0,
                total_misses INTEGER DEFAULT 0,
                last_cleanup TIMESTAMP
            )
        ''')
        
        # Initialize stats if empty
        cursor.execute('INSERT OR IGNORE INTO cache_stats (id) VALUES (1)')
        
        conn.commit()
        conn.close()
        
        logger.info(f"Cache database initialized: {self.db_path}")
    
    def cache_route(self, start_id: int, end_id: int, route: List[int], 
                   distance: float, travel_time: float) -> bool:
        """Store a route in the cache"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            route_blob = pickle.dumps({
                'path': route,
                'distance': distance,
                'travel_time': travel_time
            })
            
            cursor.execute('''
                INSERT OR REPLACE INTO cached_routes 
                (start_id, end_id, route_data, distance, travel_time, nodes_count, created_at, last_accessed)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ''', (start_id, end_id, route_blob, distance, travel_time, len(route)))
            
            conn.commit()
            conn.close()
            
            self._update_stats()
            logger.debug(f"Cached route: {start_id} -> {end_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error caching route: {e}")
            return False
    
    def get_cached_route(self, start_id: int, end_id: int) -> Optional[Dict]:
        """Retrieve a cached route"""
        self.stats['total_queries'] += 1
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT route_data, distance, travel_time, nodes_count 
                FROM cached_routes 
                WHERE start_id = ? AND end_id = ?
            ''', (start_id, end_id))
            
            result = cursor.fetchone()
            
            if result:
                cursor.execute('''
                    UPDATE cached_routes 
                    SET last_accessed = CURRENT_TIMESTAMP,
                        access_count = access_count + 1
                    WHERE start_id = ? AND end_id = ?
                ''', (start_id, end_id))
                
                cursor.execute('''
                    UPDATE cache_stats 
                    SET total_hits = total_hits + 1
                    WHERE id = 1
                ''')
                
                conn.commit()
                conn.close()
                
                route_data = pickle.loads(result[0])
                
                self.stats['hits'] += 1
                logger.debug(f"Cache HIT: {start_id} -> {end_id}")
                
                return {
                    'path': route_data['path'],
                    'distance': result[1],
                    'travel_time': result[2],
                    'nodes_count': result[3],
                    'cached': True
                }
            else:
                cursor.execute('''
                    UPDATE cache_stats 
                    SET total_misses = total_misses + 1
                    WHERE id = 1
                ''')
                conn.commit()
                conn.close()
                
                self.stats['misses'] += 1
                logger.debug(f"Cache MISS: {start_id} -> {end_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error retrieving cached route: {e}")
            return None
    
    def get_bidirectional_route(self, start_id: int, end_id: int) -> Optional[Dict]:
        """Try to get route in both directions"""
        route = self.get_cached_route(start_id, end_id)
        if route:
            return route
        
        reverse_route = self.get_cached_route(end_id, start_id)
        if reverse_route:
            reverse_route['path'] = list(reversed(reverse_route['path']))
            logger.debug(f"Using reversed cached route")
            return reverse_route
        
        return None
    
    def get_cache_statistics(self) -> Dict:
        """Get detailed cache statistics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('SELECT COUNT(*) FROM cached_routes')
            total_routes = cursor.fetchone()[0]
            
            cursor.execute('''
                SELECT total_hits, total_misses, last_cleanup 
                FROM cache_stats WHERE id = 1
            ''')
            stats_row = cursor.fetchone()
            
            cursor.execute('''
                SELECT start_id, end_id, access_count, distance 
                FROM cached_routes 
                ORDER BY access_count DESC 
                LIMIT 10
            ''')
            top_routes = cursor.fetchall()
            
            conn.close()
            
            total_hits = stats_row[0] if stats_row else 0
            total_misses = stats_row[1] if stats_row else 0
            total_queries = total_hits + total_misses
            hit_rate = (total_hits / total_queries * 100) if total_queries > 0 else 0
            
            return {
                'total_routes': total_routes,
                'total_hits': total_hits,
                'total_misses': total_misses,
                'total_queries': total_queries,
                'hit_rate': hit_rate,
                'last_cleanup': stats_row[2] if stats_row else None,
                'top_routes': [
                    {
                        'start_id': r[0],
                        'end_id': r[1],
                        'access_count': r[2],
                        'distance': r[3]
                    }
                    for r in top_routes
                ]
            }
            
        except Exception as e:
            logger.error(f"Error getting statistics: {e}")
            return {}
    
    def _update_stats(self):
        """Update internal statistics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) FROM cached_routes')
            self.stats['cache_size'] = cursor.fetchone()[0]
            conn.close()
        except Exception as e:
            logger.error(f"Error updating stats: {e}")
    
    def clear_cache(self) -> bool:
        """Clear all cached routes"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('DELETE FROM cached_routes')
            cursor.execute('UPDATE cache_stats SET total_routes = 0 WHERE id = 1')
            conn.commit()
            conn.close()
            
            logger.info("Cache cleared")
            self._update_stats()
            return True
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
            return False
