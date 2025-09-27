import React, { useState, useEffect } from 'react';

const Home = () => {
  const [apiStatus, setApiStatus] = useState('checking...');

  useEffect(() => {
    // Test API connection
    fetch('/api/health')
      .then(response => response.json())
      .then(data => {
        setApiStatus(data.status === 'healthy' ? '✅ Connected' : '❌ Error');
      })
      .catch(error => {
        setApiStatus('❌ Backend not running');
      });
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">
          Welcome to PathFinder
        </h2>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">System Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Backend API:</span>
              <span className="font-semibold">{apiStatus}</span>
            </div>
            <div className="flex justify-between">
              <span>Frontend:</span>
              <span className="font-semibold">✅ Running</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            🚧 Coming Soon
          </h3>
          <ul className="text-blue-800 space-y-1">
            <li>• Interactive map with OpenStreetMap</li>
            <li>• A* pathfinding algorithm</li>
            <li>• Smart route caching</li>
            <li>• Mobile-responsive design</li>
            <li>• Offline PWA capabilities</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Home;
