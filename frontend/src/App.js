import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/globals.css';

// Pages (we'll create these in later parts)
import Home from './pages/Home';

function App() {
  return (
    <Router>
      <div className="App min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <h1 className="text-2xl font-bold text-gray-900">
                🗺️ PathFinder
              </h1>
              <nav className="space-x-4">
                <span className="text-gray-600">OpenStreetMap Routing</span>
              </nav>
            </div>
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
