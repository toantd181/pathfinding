import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';

const GRID_ROWS = 20;
const GRID_COLS = 40;
const CELL_SIZE = 25;

const CELL_TYPES = {
  EMPTY: 0,
  WALL: 1,
  START: 2,
  END: 3,
  PATH: 4,
  VISITED: 5
};

const PathfindingVisualizer = () => {
  const [grid, setGrid] = useState([]);
  const [start, setStart] = useState({ row: 5, col: 5 });
  const [end, setEnd] = useState({ row: 15, col: 35 });
  const [isRunning, setIsRunning] = useState(false);
  const [algorithm, setAlgorithm] = useState('dijkstra');
  const [speed, setSpeed] = useState(50);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState('wall');

  // Initialize grid
  useEffect(() => {
    initializeGrid();
  }, []);

  const initializeGrid = () => {
    const newGrid = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      const currentRow = [];
      for (let col = 0; col < GRID_COLS; col++) {
        currentRow.push({
          row,
          col,
          type: CELL_TYPES.EMPTY,
          distance: Infinity,
          visited: false,
          parent: null
        });
      }
      newGrid.push(currentRow);
    }
    setGrid(newGrid);
  };

  const resetGrid = () => {
    setIsRunning(false);
    const newGrid = grid.map(row =>
      row.map(cell => ({
        ...cell,
        type: cell.type === CELL_TYPES.WALL ? CELL_TYPES.WALL : CELL_TYPES.EMPTY,
        distance: Infinity,
        visited: false,
        parent: null
      }))
    );
    setGrid(newGrid);
  };

  const clearWalls = () => {
    const newGrid = grid.map(row =>
      row.map(cell => ({
        ...cell,
        type: cell.type === CELL_TYPES.WALL ? CELL_TYPES.EMPTY : cell.type,
        distance: Infinity,
        visited: false,
        parent: null
      }))
    );
    setGrid(newGrid);
  };

  const handleMouseDown = (row, col) => {
    if (isRunning) return;
    setIsDrawing(true);
    toggleCell(row, col);
  };

  const handleMouseEnter = (row, col) => {
    if (!isDrawing || isRunning) return;
    toggleCell(row, col);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const toggleCell = (row, col) => {
    const newGrid = [...grid];
    const cell = newGrid[row][col];

    if (row === start.row && col === start.col) return;
    if (row === end.row && col === end.col) return;

    if (drawMode === 'wall') {
      cell.type = cell.type === CELL_TYPES.WALL ? CELL_TYPES.EMPTY : CELL_TYPES.WALL;
    }

    setGrid(newGrid);
  };

  const getNeighbors = (node) => {
    const neighbors = [];
    const { row, col } = node;
    
    if (row > 0) neighbors.push(grid[row - 1][col]);
    if (row < GRID_ROWS - 1) neighbors.push(grid[row + 1][col]);
    if (col > 0) neighbors.push(grid[row][col - 1]);
    if (col < GRID_COLS - 1) neighbors.push(grid[row][col + 1]);
    
    return neighbors.filter(neighbor => neighbor.type !== CELL_TYPES.WALL);
  };

  const dijkstra = async () => {
    const newGrid = [...grid];
    const startNode = newGrid[start.row][start.col];
    const endNode = newGrid[end.row][end.col];
    
    startNode.distance = 0;
    const unvisitedNodes = getAllNodes(newGrid);
    const visitedNodesInOrder = [];

    while (unvisitedNodes.length) {
      sortNodesByDistance(unvisitedNodes);
      const closestNode = unvisitedNodes.shift();
      
      if (closestNode.type === CELL_TYPES.WALL) continue;
      if (closestNode.distance === Infinity) break;
      
      closestNode.visited = true;
      visitedNodesInOrder.push(closestNode);
      
      if (closestNode === endNode) break;
      
      updateNeighbors(closestNode);
    }

    await animateAlgorithm(visitedNodesInOrder, endNode);
  };

  const aStar = async () => {
    const newGrid = [...grid];
    const startNode = newGrid[start.row][start.col];
    const endNode = newGrid[end.row][end.col];
    
    startNode.distance = 0;
    startNode.heuristic = manhattanDistance(startNode, endNode);
    
    const openSet = [startNode];
    const visitedNodesInOrder = [];

    while (openSet.length > 0) {
      openSet.sort((a, b) => 
        (a.distance + a.heuristic) - (b.distance + b.heuristic)
      );
      
      const currentNode = openSet.shift();
      
      if (currentNode.type === CELL_TYPES.WALL) continue;
      if (currentNode.visited) continue;
      
      currentNode.visited = true;
      visitedNodesInOrder.push(currentNode);
      
      if (currentNode === endNode) break;
      
      const neighbors = getNeighbors(currentNode);
      for (const neighbor of neighbors) {
        if (neighbor.visited) continue;
        
        const tentativeDistance = currentNode.distance + 1;
        if (tentativeDistance < neighbor.distance) {
          neighbor.distance = tentativeDistance;
          neighbor.parent = currentNode;
          neighbor.heuristic = manhattanDistance(neighbor, endNode);
          
          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    await animateAlgorithm(visitedNodesInOrder, endNode);
  };

  const manhattanDistance = (nodeA, nodeB) => {
    return Math.abs(nodeA.row - nodeB.row) + Math.abs(nodeA.col - nodeB.col);
  };

  const getAllNodes = (grid) => {
    const nodes = [];
    for (const row of grid) {
      for (const node of row) {
        nodes.push(node);
      }
    }
    return nodes;
  };

  const sortNodesByDistance = (unvisitedNodes) => {
    unvisitedNodes.sort((a, b) => a.distance - b.distance);
  };

  const updateNeighbors = (node) => {
    const neighbors = getNeighbors(node);
    for (const neighbor of neighbors) {
      const distance = node.distance + 1;
      if (distance < neighbor.distance) {
        neighbor.distance = distance;
        neighbor.parent = node;
      }
    }
  };

  const animateAlgorithm = async (visitedNodes, endNode) => {
    for (let i = 0; i < visitedNodes.length; i++) {
      if (!isRunning) break;
      
      await new Promise(resolve => setTimeout(resolve, 101 - speed));
      
      const node = visitedNodes[i];
      if (node !== grid[start.row][start.col] && node !== grid[end.row][end.col]) {
        const newGrid = [...grid];
        newGrid[node.row][node.col].type = CELL_TYPES.VISITED;
        setGrid(newGrid);
      }
    }

    if (endNode.parent) {
      await animateShortestPath(endNode);
    }
    
    setIsRunning(false);
  };

  const animateShortestPath = async (endNode) => {
    const path = [];
    let currentNode = endNode;
    
    while (currentNode !== null) {
      path.unshift(currentNode);
      currentNode = currentNode.parent;
    }

    for (let i = 0; i < path.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const node = path[i];
      if (node !== grid[start.row][start.col] && node !== grid[end.row][end.col]) {
        const newGrid = [...grid];
        newGrid[node.row][node.col].type = CELL_TYPES.PATH;
        setGrid(newGrid);
      }
    }
  };

  const visualize = () => {
    if (isRunning) return;
    resetGrid();
    setIsRunning(true);
    
    setTimeout(() => {
      if (algorithm === 'dijkstra') {
        dijkstra();
      } else if (algorithm === 'astar') {
        aStar();
      }
    }, 100);
  };

  const getCellColor = (cell) => {
    if (cell.row === start.row && cell.col === start.col) return 'bg-green-500';
    if (cell.row === end.row && cell.col === end.col) return 'bg-red-500';
    
    switch (cell.type) {
      case CELL_TYPES.WALL:
        return 'bg-gray-800';
      case CELL_TYPES.VISITED:
        return 'bg-blue-300';
      case CELL_TYPES.PATH:
        return 'bg-yellow-400';
      default:
        return 'bg-white border border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          Pathfinding Visualizer
        </h1>
        
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <button
                onClick={visualize}
                disabled={isRunning}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Play size={20} />
                Visualize {algorithm === 'dijkstra' ? 'Dijkstra' : 'A*'}
              </button>
              
              <button
                onClick={resetGrid}
                disabled={isRunning}
                className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw size={20} />
                Reset
              </button>
              
              <button
                onClick={clearWalls}
                disabled={isRunning}
                className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Clear Walls
              </button>
            </div>
            
            <div className="flex gap-4 items-center">
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                disabled={isRunning}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200"
              >
                <option value="dijkstra">Dijkstra's Algorithm</option>
                <option value="astar">A* Algorithm</option>
              </select>
              
              <div className="flex items-center gap-2">
                <label className="text-gray-700 font-medium">Speed:</label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-32"
                />
                <span className="text-gray-600 w-8">{speed}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-500 rounded"></div>
              <span>Start</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500 rounded"></div>
              <span>End</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-800 rounded"></div>
              <span>Wall</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-300 rounded"></div>
              <span>Visited</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-yellow-400 rounded"></div>
              <span>Path</span>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-lg shadow-lg p-6 inline-block">
          <div 
            className="inline-block"
            onMouseLeave={handleMouseUp}
          >
            {grid.map((row, rowIdx) => (
              <div key={rowIdx} className="flex">
                {row.map((cell, cellIdx) => (
                  <div
                    key={`${rowIdx}-${cellIdx}`}
                    className={`${getCellColor(cell)} transition-colors duration-200 cursor-pointer`}
                    style={{
                      width: `${CELL_SIZE}px`,
                      height: `${CELL_SIZE}px`,
                    }}
                    onMouseDown={() => handleMouseDown(rowIdx, cellIdx)}
                    onMouseEnter={() => handleMouseEnter(rowIdx, cellIdx)}
                    onMouseUp={handleMouseUp}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-6 text-center text-gray-600">
          <p>Click and drag to draw walls. Click Visualize to see the algorithm in action!</p>
        </div>
      </div>
    </div>
  );
};

export default PathfindingVisualizer;