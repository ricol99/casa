# generate private keys for the 3 entities
openssl genrsa -out ca.key 2048
openssl genrsa -out server.key 2048
openssl genrsa -out client.key 2048

# generate CA certificate
openssl req -new -x509 -days 365 -key ca.key -out ca.crt

# create client CSR
openssl req -new -key client.key -out client.csr

# create the client certificate and sign it
openssl x509 -req -days 365 -in client.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out client.crt

# create the server CSR
openssl req -new -key server.key -out server.csr

# create the server certificate and sign it
openssl x509 -req -days 365 -in server.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out server.crt