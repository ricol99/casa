#!/bin/sh
export HOME="/home/pi"
casa=${1}
cd /home/pi/dev/casa/src

RC=1
while [ $RC -ne 0 ]; do
   mv /home/pi/dev/casa/log.txt /home/pi/dev/casa/last-log.txt
   mv /home/pi/dev/casa/error.txt /home/pi/dev/casa/last-error.txt
   sudo -u pi git pull origin master
   node app.js ${casa} --secure >/home/pi/dev/casa/log.txt 2>/home/pi/dev/casa/error.txt
   RC=$?
done
