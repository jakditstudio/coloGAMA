#!/bin/bash
# Script to activate the Python virtual environment for this project
# Path: /home/abyan/Documents/BUAT_MAGANG/VISION-TAILS/activate_venv.sh

# Absolute or relative path to the venv
VENV_PATH="./coloGAMA/bin/activate"

# Check if the venv exists
if [ -f "$VENV_PATH" ]; then
    source "$VENV_PATH"
    echo "✅ Virtual environment activated."
else
    echo "❌ Virtual environment not found at $VENV_PATH"
    exit 1
fi
