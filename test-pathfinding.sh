#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Pathfinding Project Test Script${NC}"
echo -e "${YELLOW}========================================${NC}\n"

# Navigate to project directory
cd ~/my-folder/hoc/code/pathfinding-project/frontend || {
    echo -e "${RED}✗ Error: frontend directory not found${NC}"
    exit 1
}

echo -e "${GREEN}✓ Found frontend directory${NC}\n"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install || {
        echo -e "${RED}✗ npm install failed${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ Dependencies installed${NC}\n"
else
    echo -e "${GREEN}✓ node_modules exists${NC}\n"
fi

# Check if lucide-react is installed
echo -e "${YELLOW}Checking lucide-react...${NC}"
if grep -q "lucide-react" package.json; then
    echo -e "${GREEN}✓ lucide-react found in package.json${NC}\n"
else
    echo -e "${YELLOW}Installing lucide-react...${NC}"
    npm install lucide-react || {
        echo -e "${RED}✗ Failed to install lucide-react${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ lucide-react installed${NC}\n"
fi

# Verify file structure
echo -e "${YELLOW}Checking file structure...${NC}"
FILES=("src/App.js" "src/index.js" "src/index.css" "public/index.html")
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file exists${NC}"
    else
        echo -e "${RED}✗ $file missing${NC}"
    fi
done
echo ""

# Check if App.js contains PathfindingVisualizer
echo -e "${YELLOW}Checking App.js content...${NC}"
if grep -q "PathfindingVisualizer" src/App.js; then
    echo -e "${GREEN}✓ PathfindingVisualizer component found${NC}\n"
else
    echo -e "${RED}✗ PathfindingVisualizer component not found${NC}"
    echo -e "${YELLOW}Please replace src/App.js with the PathfindingVisualizer code${NC}\n"
    exit 1
fi

# Check if lucide-react is imported
if grep -q "lucide-react" src/App.js; then
    echo -e "${GREEN}✓ lucide-react imported in App.js${NC}\n"
else
    echo -e "${RED}✗ lucide-react not imported in App.js${NC}\n"
    exit 1
fi

# Run build test
echo -e "${YELLOW}Testing build (this may take a minute)...${NC}"
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful!${NC}\n"
    rm -rf build  # Clean up build directory
else
    echo -e "${RED}✗ Build failed${NC}"
    echo -e "${YELLOW}Running build to show errors...${NC}\n"
    npm run build
    exit 1
fi

# Final summary
echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN}✓ All tests passed!${NC}"
echo -e "${YELLOW}========================================${NC}\n"

echo -e "${GREEN}Your pathfinding visualizer is ready!${NC}\n"
echo -e "${YELLOW}To start the development server, run:${NC}"
echo -e "${GREEN}npm start${NC}\n"

echo -e "${YELLOW}Then open your browser to:${NC}"
echo -e "${GREEN}http://localhost:3000${NC}\n"

echo -e "${YELLOW}Features to test:${NC}"
echo "1. Draw walls by clicking and dragging on the grid"
echo "2. Click 'Visualize Dijkstra' or 'Visualize A*' to see pathfinding"
echo "3. Adjust speed slider to change animation speed"
echo "4. Switch between Dijkstra and A* algorithms"
echo "5. Use Reset to clear visited cells and path"
echo "6. Use Clear Walls to remove all walls"
echo ""

read -p "Would you like to start the dev server now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${GREEN}Starting development server...${NC}\n"
    npm start
fi
