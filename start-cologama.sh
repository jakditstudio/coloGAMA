#!/bin/bash

echo "Starting coloGAMA services..."

# Kill any existing processes first
sudo pkill -f "python main.py" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
sleep 2

# Start backend in background
echo "Starting backend..."
cd /home/admin/Documents/coloGAMA/backend
nohup sudo python main.py > /tmp/cologama-backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

# Start frontend in background
echo "Starting frontend..."
cd /home/admin/Documents/coloGAMA/frontend
nohup npm run dev -- --host 0.0.0.0 > /tmp/cologama-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

# Save PIDs for later
echo $BACKEND_PID > /tmp/cologama-backend.pid
echo $FRONTEND_PID > /tmp/cologama-frontend.pid

echo ""
echo "✓ coloGAMA services started successfully!"
echo "Backend PID: $BACKEND_PID (log: /tmp/cologama-backend.log)"
echo "Frontend PID: $FRONTEND_PID (log: /tmp/cologama-frontend.log)"
echo ""
echo "Access the app at: http://localhost:5173"