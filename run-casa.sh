#!/bin/sh
export HOME="/home/pi"
casa=${1}-config.json
cd /home/pi/dev/casa/src

RC=1
while [ $RC -ne 0 ]; do
   sudo -u pi git pull origin master
   node app.js --system casa-collin-config.json env-config.json --secure >/home/pi/dev/casa/log.txt 2>/home/pi/dev/casa/error.txt
   RC=$?
done
