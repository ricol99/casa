FROM node:latest

# prepare dir where app will reside
RUN mkdir -p /src
WORKDIR /src

# copy the npm config file and run install
COPY package.json /src/package.json

# do the actual npm install of local modules
RUN npm install --registry http://registry.npmjs.org

# tweak this line to force a reinstall of npm modules including blockone: tweak #2
RUN npm set registry "NPM_REG"

# install blockone-eth-lightwallet globally to avoid bitcore-lib issues
RUN npm install -g blockone@BLOCKONE_SDK_VERSION
ENV NODE_PATH /usr/local/lib/node_modules:/usr/local/lib/node_modules/blockone/node_modules

# copy the actual app inside #1
COPY . /src

EXPOSE 8080
CMD [ "node", "app.js" ]

# get us off these annoying broken persistent volumes
RUN mkdir /logs
