usage() {
	echo `basename $0`: ERROR: $* 1>&2
	echo usage: `basename $0` '[db-files]' 1>&2
	exit 1
}

for i in $*
do
   case $i in
     /*) absolute=$i;;
     *) absolute=$PWD/$i;;
   esac

   echo $absolute
   node src/utils/createdb $absolute
done

mkdir .certs
cp -R ~/.casa-keys/* .certs
docker build -t ricol99/casa .
docker push ricol99/casa
rm -rf .certs
hyper pull ricol99/casa
hyper stop `hyper ps -a | tail -1 | awk '{print $1}'`
hyper rm `hyper ps -a | tail -1 | awk '{print $1}'`
hyper rmi `hyper images | tail -1 | awk '{print $3}'`
CONTAINERID=`hyper create --size=s2 --name casa -p 443:8096 ricol99/casa | awk '{print $1}'`
hyper start $CONTAINERID
sleep 30
hyper fip attach 199.245.56.152 $CONTAINERID
