#!/bin/sh
  
# generate private client key
openssl genrsa -out client.key 2048

# generate CA certificate
openssl req -new -x509 -days 365 -key ca.key -out ca.crt

# create client CSR
openssl req -new -key client.key -out client.csr

# create the client certificate and sign it
openssl x509 -req -days 365 -in client.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out client.crt

mkdir -p ~/.casa-keys

cp client.crt client.key ~/.casa-keys/
