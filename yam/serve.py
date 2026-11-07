"""Local web server for YAM.

Usage:  python serve.py [port]

Forces correct MIME types (Windows can map .js to text/plain through the
registry, which makes browsers refuse to load the app's JavaScript modules),
finds a free port if the requested one is busy, and opens the browser.
"""
import http.server
import os
import socket
import socketserver
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.pdf': 'application/pdf',
    '.md': 'text/plain; charset=utf-8',
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return TYPES.get(ext) or super().guess_type(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the console quiet


def free_port(start):
    for port in range(start, start + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    raise SystemExit('No free port found between %d and %d' % (start, start + 49))


def main():
    port = free_port(int(sys.argv[1]) if len(sys.argv) > 1 else 8080)
    url = 'http://localhost:%d/' % port
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('127.0.0.1', port), Handler) as httpd:
        print('YAM is running at %s' % url)
        print('Keep this window open while you use the app. Press Ctrl+C to stop.')
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nStopped.')


if __name__ == '__main__':
    main()
