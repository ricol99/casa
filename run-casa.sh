#!/bin/sh
export HOME="/home/pi"
casa=${1}-config.json
cd /home/pi/dev/casa/src

RC=1
while [ $RC -ne 0 ]; do
   sudo -u pi git pull origin master
   cp /home/pi/dev/casa/log.txt /home/pi/dev/casa/last-log.txt 2> /dev/null
   cp /home/pi/dev/casa/error.txt /home/pi/dev/casa/last-error.txt 2> /dev/null
   node app.js --system configs/casa-collin-config.json configs/env-config.json --secure >/home/pi/dev/casa/log.txt 2>/home/pi/dev/casa/error.txt
   RC=$?
done
