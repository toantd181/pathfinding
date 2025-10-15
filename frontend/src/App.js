// App.js
import React, { useState } from 'react';
import ManualGraphBuilder from './ManualBuilder';
import PathfindingDashboard from './PathfindingDashboard';

function App() {
  const [currentView, setCurrentView] = useState('pathfinding'); // Default to pathfinding

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Navigation Bar */}
      <nav className="bg-gray-800 shadow-lg flex-shrink-0">
        <div className="px-6 py-3 flex gap-4">
          <button
            onClick={() => setCurrentView('builder')}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              currentView === 'builder'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🏗️ Graph Builder
          </button>
          <button
            onClick={() => setCurrentView('pathfinding')}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              currentView === 'pathfinding'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🎯 Pathfinding
          </button>
        </div>
      </nav>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'builder' ? (
          <ManualGraphBuilder />
        ) : (
          // Render the new dashboard component
          <PathfindingDashboard />
        )}
      </div>
    </div>
  );
}

export default App;
