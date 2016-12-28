FROM node:latest

# prepare dir where app will reside
RUN mkdir -p /src
WORKDIR /src

# copy the npm config file and run install
COPY package.json /src/package.json

# do the actual npm install of local modules
RUN npm install 
# RUN npm install --registry http://registry.npmjs.org

ENV NODE_PATH /usr/local/lib/node_modules:/usr/local/lib/node_modules/casa/node_modules

# copy the actual app inside #1
COPY src/* /src/

EXPOSE 8096
CMD [ "node", "app.js", "casa-collin-config.json", "internet-config.json", "-nopeer" ]

# get us off these annoying broken persistent volumes
RUN mkdir /logs
