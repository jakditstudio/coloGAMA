#!/bin/bash

echo "Stopping coloGAMA services..."

# Stop using saved PIDs
if [ -f /tmp/cologama-backend.pid ]; then
    BACKEND_PID=$(cat /tmp/cologama-backend.pid)
    sudo kill $BACKEND_PID 2>/dev/null
    echo "Backend (PID: $BACKEND_PID) stopped"
    rm /tmp/cologama-backend.pid
fi

if [ -f /tmp/cologama-frontend.pid ]; then
    FRONTEND_PID=$(cat /tmp/cologama-frontend.pid)
    kill $FRONTEND_PID 2>/dev/null
    echo "Frontend (PID: $FRONTEND_PID) stopped"
    rm /tmp/cologama-frontend.pid
fi

# Fallback: kill by process name
sudo pkill -f "python main.py" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null

echo "✓ coloGAMA services stopped!"