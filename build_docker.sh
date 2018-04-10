usage() {
	echo Usage: `basename $0` '--host <hostname> --config <casa-config-file> [<gang-config-file>] | --host <hostname> <casa-name>' 1>&2
	exit 1
}

if [ $# -eq 0 ]
then
   usage
fi

if [ "$1" = --host ]
then
   if [ $# -lt 3 ]
   then
      usage
   else
      hostname=$2
      if [ "$3" = --config ]
      then
         if [ $# -ge 4 ]
         then
            casaConfig=1
            casaConfigFile=$4
            gangConfig=0
            casaName=`grep -o '"uName":[ ]*"[A-Za-z0-9]*:[A-Za-z0-9]*' $casaConfigFile | head -1 | awk 'BEGIN{FS="\""}{print $4}'`
            casaShortName=`echo $casaName | awk 'BEGIN{FS=":"}{print$2}'`
         fi
         if [ $# -eq 5 ]
         then
            gangConfig=1
            gangConfigFile=$5
         fi
      else
         if [ $# -ne 3 ]
         then
            usage
         else
            casaConfig=0
            gangConfig=0
            casa=1
            casaName="casa:"$3
            casaShortName=$3
         fi
      fi
   fi
else
   usage
fi

mkdir -p .certs
cp -R ~/.casa-keys/* .certs

if [ $casaConfig -eq 1 ]
then
   echo Creating casa db from $casaConfigFile
   node src/utils/createdb $casaConfigFile
else
   echo Fetching casa db for $casaName from host $hostname
   node src/utils/fetchdb --host $hostname --certs $HOME/.casa-keys $casaName
fi

if [ $gangConfig -eq 1 ]
then
   echo Creating gang db from $gangConfigFile
   node src/utils/createdb $gangConfigFile
else
   gang="gang:"`grep -o '"gang":"[A-Za-z0-9]*:[A-Za-z0-9]*' $HOME/.casa-keys/secure-config/${casaName}.db | awk 'BEGIN{FS="gang:"}{print $2}'`
   echo Fetching gang db for $gang from host $hostname
   node src/utils/fetchdb --host $hostname --certs $HOME/.casa-keys $gang 
fi

sed s/REPLACEWITHCASANAME/${casaShortName}/ dockerTemplate > Dockerfile

docker build -t ricol99/casa .
docker push ricol99/casa
rm Dockerfile
rm -rf .certs
hyper pull ricol99/casa
hyper stop `hyper ps -a | tail -1 | awk '{print $1}'`
hyper rm `hyper ps -a | tail -1 | awk '{print $1}'`
hyper rmi `hyper images | tail -1 | awk '{print $3}'`
CONTAINERID=`hyper create --size=s2 --name casa -p 443:8096 ricol99/casa | awk '{print $1}'`
hyper start $CONTAINERID
sleep 30
hyper fip attach 199.245.56.152 $CONTAINERID
