mkdir .certs
cp ~/.casa-keys/* .certs
docker build -t ricol99/casa .
docker push ricol99/casa
rm -rf .certs
hyper pull ricol99/casa
hyper stop `hyper ps -a | tail -1 | awk '{print $1}'`
hyper rm `hyper ps -a | tail -1 | awk '{print $1}'`
hyper rmi `hyper images | tail -1 | awk '{print $3}'`
CONTAINERID=`hyper create --size=s2 --name casa -p 443:8096 ricol99/casa | awk '{print $1}'`
hyper start $CONTAINERID
sleep 2
hyper fip attach 199.245.56.152 $CONTAINERID
