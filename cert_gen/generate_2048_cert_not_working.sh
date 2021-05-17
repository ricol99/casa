# generate private keys for the 3 entities
echo "Generating CA key"
openssl genrsa -out ca.key 2048

echo "Generating Server key"
openssl genrsa -out server.key 2048

echo "Generating Client key"
openssl genrsa -out client.key 2048

# generate CA certificate
echo "Generating CA Cert"
openssl req -x509 -new -nodes -key ca.key -sha256 -days 364 -out ca.crt

# create client CSR
#echo "Generating Client CSR"
openssl req -new -key client.key -config config.cnf -out client.csr

#echo "Verifying Client CSR"
openssl req -in client.csr -noout -text

# create the client certificate and sign it
#echo "Generating Client Cert and Signing it"
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt -days 364 -sha256 -extfile config.cnf -extensions req_ext

#echo "Verifying Client Certificate"
openssl x509 -in client.crt -text -noout

# create the server CSR
#echo "Generating Server CSR"
openssl req -new -key server.key -config config.cnf -out server.csr

#echo "Verifying Server CSR"
openssl req -in server.csr -noout -text

# create the server certificate and sign it
#echo "Generating Server Cert and Signing it"
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 364 -sha256 -extfile config.cnf -extensions req_ext

#echo "Verifying Server Certificate"
openssl x509 -in server.crt -text -noout
