#!/bin/bash

echo "Restarting Backend Service...."

sudo systemctl restart cologama-backend
sleep 2
sudo systemctl status cologama-backend --no-pager

# sudo journalctl -u cologama-backend -f

echo "Cologama backend Service has been restarted!"