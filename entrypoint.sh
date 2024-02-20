#!/bin/sh

# Use envsubst to replace environment variables in the nginx.conf.template file
envsubst '$HOST_NAME' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Execute the original nginx command
exec nginx -g 'daemon off;'
