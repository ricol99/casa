# generate private keys for the 3 entities
echo "Generating CA key"
openssl genrsa -out ca.key 2048

echo "Generating Server key"
openssl genrsa -out server.key 2048

echo "Generating Client key"
openssl genrsa -out client.key 2048

# generate CA certificate
echo "Generating CA Cert"
openssl req -new -x509 -days 365 -key ca.key -out ca.crt

# create client CSR
echo "Generating Client CSR"
openssl req -new -key client.key -out client.csr

# create the client certificate and sign it
echo "Generating Client Cert and Signing it"
openssl x509 -req -days 365 -in client.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out client.crt

# create the server CSR
echo "Generating Server CSR"
openssl req -new -key server.key -out server.csr

# create the server certificate and sign it
echo "Generating Server Cert and Signing it"
openssl x509 -req -days 365 -in server.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out server.crt
