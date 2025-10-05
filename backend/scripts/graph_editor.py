"""
PyQt6 Graph Editor for Manual Connection Editing
Visualize nodes, edges, and manually fix incorrect connections
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QPushButton, QLabel, QListWidget, 
                             QMessageBox, QFileDialog, QSpinBox, QCheckBox)
from PyQt6.QtCore import Qt, QPointF, QRectF
from PyQt6.QtGui import QPainter, QPen, QColor, QBrush

from src.core.graph import Graph

class GraphCanvas(QWidget):
    """Canvas for drawing and editing graph"""
    
    def __init__(self, graph=None):
        super().__init__()
        self.graph = graph
        self.scale = 10000  # Scale factor for lat/lon to pixels
        self.offset_x = 0
        self.offset_y = 0
        self.selected_node = None
        self.hover_node = None
        self.show_edges = True
        self.show_node_ids = False
        self.min_degree_filter = 0
        
        # For adding connections
        self.connection_mode = False
        self.first_node = None
        
        self.setMinimumSize(800, 600)
        self.setMouseTracking(True)
        
        if graph:
            self.center_view()
    
    def center_view(self):
        """Center view on graph"""
        if not self.graph or not self.graph.nodes:
            return
        
        lats = [n.latitude for n in self.graph.nodes.values()]
        lons = [n.longitude for n in self.graph.nodes.values()]
        
        center_lat = (min(lats) + max(lats)) / 2
        center_lon = (min(lons) + max(lons)) / 2
        
        self.offset_x = self.width() / 2 - center_lon * self.scale
        self.offset_y = self.height() / 2 + center_lat * self.scale
        
        self.update()
    
    def lat_lon_to_screen(self, lat, lon):
        """Convert lat/lon to screen coordinates"""
        x = lon * self.scale + self.offset_x
        y = -lat * self.scale + self.offset_y
        return QPointF(x, y)
    
    def screen_to_lat_lon(self, x, y):
        """Convert screen coordinates to lat/lon"""
        lon = (x - self.offset_x) / self.scale
        lat = -(y - self.offset_y) / self.scale
        return lat, lon
    
    def find_node_at(self, x, y, radius=10):
        """Find node near screen coordinates"""
        if not self.graph:
            return None
        
        for node in self.graph.nodes.values():
            if self.min_degree_filter > 0 and len(node.neighbors) < self.min_degree_filter:
                continue
            
            pos = self.lat_lon_to_screen(node.latitude, node.longitude)
            dist = ((pos.x() - x) ** 2 + (pos.y() - y) ** 2) ** 0.5
            if dist < radius:
                return node
        return None
    
    def paintEvent(self, event):
        """Draw the graph"""
        if not self.graph:
            return
        
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Draw edges
        if self.show_edges:
            painter.setPen(QPen(QColor(200, 200, 200), 1))
            for node in self.graph.nodes.values():
                if self.min_degree_filter > 0 and len(node.neighbors) < self.min_degree_filter:
                    continue
                
                pos1 = self.lat_lon_to_screen(node.latitude, node.longitude)
                for neighbor, weight in node.neighbors:
                    pos2 = self.lat_lon_to_screen(neighbor.latitude, neighbor.longitude)
                    
                    # Color code by distance
                    if weight > 1000:
                        painter.setPen(QPen(QColor(255, 0, 0), 2))  # Red for suspicious long edges
                    elif weight > 500:
                        painter.setPen(QPen(QColor(255, 165, 0), 1))  # Orange
                    else:
                        painter.setPen(QPen(QColor(200, 200, 200), 1))  # Gray
                    
                    painter.drawLine(pos1, pos2)
        
        # Draw nodes
        for node in self.graph.nodes.values():
            if self.min_degree_filter > 0 and len(node.neighbors) < self.min_degree_filter:
                continue
            
            pos = self.lat_lon_to_screen(node.latitude, node.longitude)
            
            # Color based on degree
            degree = len(node.neighbors)
            if degree == 0:
                color = QColor(128, 128, 128)  # Gray - isolated
            elif degree <= 2:
                color = QColor(255, 200, 0)    # Yellow - poorly connected
            elif degree >= 4:
                color = QColor(0, 200, 0)      # Green - well connected
            else:
                color = QColor(100, 150, 255)  # Blue - normal
            
            # Highlight selected/hover
            if node == self.selected_node:
                painter.setBrush(QBrush(QColor(255, 0, 0)))
                radius = 8
            elif node == self.hover_node:
                painter.setBrush(QBrush(QColor(0, 255, 255)))
                radius = 6
            elif node == self.first_node:
                painter.setBrush(QBrush(QColor(255, 0, 255)))
                radius = 7
            else:
                painter.setBrush(QBrush(color))
                radius = 4
            
            painter.setPen(QPen(Qt.GlobalColor.black, 1))
            painter.drawEllipse(pos, radius, radius)
            
            # Draw node ID if enabled
            if self.show_node_ids and (node == self.selected_node or node == self.hover_node):
                painter.drawText(pos.x() + 10, pos.y(), str(node.id))
    
    def mousePressEvent(self, event):
        """Handle mouse clicks"""
        node = self.find_node_at(event.pos().x(), event.pos().y())
        
        if event.button() == Qt.MouseButton.LeftButton:
            if self.connection_mode and node:
                if self.first_node is None:
                    self.first_node = node
                else:
                    # Add connection
                    self.add_connection(self.first_node, node)
                    self.first_node = None
            else:
                self.selected_node = node
        elif event.button() == Qt.MouseButton.RightButton:
            if node:
                self.show_node_context(node)
        
        self.update()
    
    def mouseMoveEvent(self, event):
        """Handle mouse hover"""
        self.hover_node = self.find_node_at(event.pos().x(), event.pos().y())
        self.update()
    
    def wheelEvent(self, event):
        """Zoom with mouse wheel"""
        delta = event.angleDelta().y()
        factor = 1.1 if delta > 0 else 0.9
        self.scale *= factor
        self.update()
    
    def add_connection(self, node1, node2):
        """Add edge between two nodes"""
        if node1 == node2:
            return
        
        from src.utils.geo_utils import haversine_distance
        distance = haversine_distance(
            node1.latitude, node1.longitude,
            node2.latitude, node2.longitude
        )
        
        # Add bidirectional connection
        node1.add_neighbor(node2, distance)
        node2.add_neighbor(node1, distance)
        
        print(f"Added connection: {node1.id} <-> {node2.id} ({distance:.0f}m)")
        self.update()
    
    def show_node_context(self, node):
        """Show context menu for node"""
        # In a full implementation, this would show a menu
        # For now, just print info
        print(f"\nNode: {node.id}")
        print(f"  Position: ({node.latitude:.4f}, {node.longitude:.4f})")
        print(f"  Degree: {len(node.neighbors)}")
        print(f"  Neighbors: {[n.id for n, w in node.neighbors]}")


class GraphEditorWindow(QMainWindow):
    """Main window for graph editor"""
    
    def __init__(self):
        super().__init__()
        self.graph = None
        self.graph_file = None
        self.init_ui()
    
    def init_ui(self):
        self.setWindowTitle("Hanoi Graph Editor")
        self.setGeometry(100, 100, 1200, 800)
        
        # Central widget
        central = QWidget()
        self.setCentralWidget(central)
        layout = QHBoxLayout(central)
        
        # Left panel - controls
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_panel.setMaximumWidth(300)
        
        # File operations
        left_layout.addWidget(QLabel("<b>File Operations</b>"))
        
        btn_load = QPushButton("Load Graph")
        btn_load.clicked.connect(self.load_graph)
        left_layout.addWidget(btn_load)
        
        btn_save = QPushButton("Save Graph")
        btn_save.clicked.connect(self.save_graph)
        left_layout.addWidget(btn_save)
        
        # View controls
        left_layout.addWidget(QLabel("<b>View Controls</b>"))
        
        self.chk_edges = QCheckBox("Show Edges")
        self.chk_edges.setChecked(True)
        self.chk_edges.stateChanged.connect(self.toggle_edges)
        left_layout.addWidget(self.chk_edges)
        
        self.chk_ids = QCheckBox("Show Node IDs")
        self.chk_ids.stateChanged.connect(self.toggle_ids)
        left_layout.addWidget(self.chk_ids)
        
        # Degree filter
        filter_layout = QHBoxLayout()
        filter_layout.addWidget(QLabel("Min Degree:"))
        self.spin_degree = QSpinBox()
        self.spin_degree.setRange(0, 10)
        self.spin_degree.valueChanged.connect(self.update_filter)
        filter_layout.addWidget(self.spin_degree)
        left_layout.addLayout(filter_layout)
        
        # Editing
        left_layout.addWidget(QLabel("<b>Editing</b>"))
        
        self.btn_connect = QPushButton("Add Connection (click 2 nodes)")
        self.btn_connect.setCheckable(True)
        self.btn_connect.clicked.connect(self.toggle_connection_mode)
        left_layout.addWidget(self.btn_connect)
        
        btn_remove_long = QPushButton("Remove Long Edges (>500m)")
        btn_remove_long.clicked.connect(self.remove_long_edges)
        left_layout.addWidget(btn_remove_long)
        
        # Info
        left_layout.addWidget(QLabel("<b>Information</b>"))
        self.info_label = QLabel("Load a graph to start")
        self.info_label.setWordWrap(True)
        left_layout.addWidget(self.info_label)
        
        left_layout.addStretch()
        
        # Canvas
        self.canvas = GraphCanvas()
        
        layout.addWidget(left_panel)
        layout.addWidget(self.canvas, 1)
    
    def load_graph(self):
        """Load graph from file"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Load Graph", "data/processed",
            "Pickle Files (*.pkl);;All Files (*)"
        )
        
        if file_path:
            try:
                graph = Graph()
                graph.load_from_file(file_path)
                self.graph = graph
                self.graph_file = file_path
                self.canvas.graph = graph
                self.canvas.center_view()
                self.update_info()
                QMessageBox.information(self, "Success", f"Loaded {len(graph.nodes)} nodes")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Failed to load: {e}")
    
    def save_graph(self):
        """Save graph to file"""
        if not self.graph:
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "Save Graph", self.graph_file or "data/processed/hanoi_edited.pkl",
            "Pickle Files (*.pkl)"
        )
        
        if file_path:
            try:
                self.graph.save_to_file(file_path)
                QMessageBox.information(self, "Success", "Graph saved")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Failed to save: {e}")
    
    def toggle_edges(self, state):
        self.canvas.show_edges = (state == Qt.CheckState.Checked.value)
        self.canvas.update()
    
    def toggle_ids(self, state):
        self.canvas.show_node_ids = (state == Qt.CheckState.Checked.value)
        self.canvas.update()
    
    def update_filter(self, value):
        self.canvas.min_degree_filter = value
        self.canvas.update()
    
    def toggle_connection_mode(self, checked):
        self.canvas.connection_mode = checked
        self.canvas.first_node = None
        if checked:
            self.info_label.setText("Connection mode: Click two nodes to connect them")
        else:
            self.update_info()
    
    def remove_long_edges(self):
        """Remove suspiciously long edges"""
        if not self.graph:
            return
        
        removed = 0
        for node in list(self.graph.nodes.values()):
            original = len(node.neighbors)
            node.neighbors = [(n, w) for n, w in node.neighbors if w <= 500]
            removed += original - len(node.neighbors)
        
        self.canvas.update()
        self.update_info()
        QMessageBox.information(self, "Done", f"Removed {removed} long edges")
    
    def update_info(self):
        """Update info label"""
        if not self.graph:
            return
        
        degrees = [len(n.neighbors) for n in self.graph.nodes.values()]
        avg_degree = sum(degrees) / len(degrees) if degrees else 0
        poor = sum(1 for d in degrees if d <= 2)
        
        info = f"Nodes: {len(self.graph.nodes):,}\n"
        info += f"Edges: {len(self.graph.edges):,}\n"
        info += f"Avg Degree: {avg_degree:.2f}\n"
        info += f"Poorly Connected: {poor} ({poor/len(self.graph.nodes)*100:.1f}%)"
        
        self.info_label.setText(info)


def main():
    app = QApplication(sys.argv)
    window = GraphEditorWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == '__main__':
    main()