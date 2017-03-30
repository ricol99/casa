FROM node:latest

# prepare dir where app will reside
RUN mkdir -p /src/.certs/secure-config /src/properies /src/steps /src/configs /src/things /src/services

WORKDIR /src

# copy the npm config file and run install
COPY package.json /src/package.json

# do the actual npm install of local modules
RUN npm install 

ENV NODE_PATH /usr/local/lib/node_modules:/usr/local/lib/node_modules/casa/node_modules

# copy the actual app inside #1
COPY src/* /src/
COPY src/properties/* /src/properties/
COPY src/steps/* /src/steps/
COPY src/configs/* /src/configs/
COPY src/things/* /src/things/
COPY src/services/* /src/services/

# copy the certs 
COPY .certs/* /src/.certs/
COPY secure-config/* /src/.certs/secure-config/

EXPOSE 8096
CMD [ "node", "app.js", "--system", "configs/casa-collin-config.json", "configs/internet-config.json", "--nopeer", "--secure", "--certs", ".certs" ]

# get us off these annoying broken persistent volumes
RUN mkdir /logs
