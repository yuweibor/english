#!/usr/bin/env python3
"""Local HTTPS static file server for LAN access.

Usage: python3 serve_https.py [port] [root] [cert] [key]
"""
import http.server
import ssl
import sys
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8443
ROOT = sys.argv[2] if len(sys.argv) > 2 else ".."
CERT = os.path.abspath(sys.argv[3]) if len(sys.argv) > 3 else os.path.abspath("cert.pem")
KEY = os.path.abspath(sys.argv[4]) if len(sys.argv) > 4 else os.path.abspath("key.pem")

os.chdir(ROOT)


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))


httpd = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(CERT, KEY)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
print("HTTPS serving %s on https://0.0.0.0:%d" % (os.path.abspath(ROOT), PORT), flush=True)
httpd.serve_forever()
