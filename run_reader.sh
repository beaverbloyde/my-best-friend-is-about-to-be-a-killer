#!/usr/bin/env bash
# Script to launch local development server for Pogranichny 2118 Reader Interface
PORT=8002
echo "=========================================================="
echo " Starting Pogranichny 2118 (LOGOS-3) Web Reader Interface"
echo " Open in your browser: http://localhost:$PORT/"
echo "=========================================================="
python3 -c '
import os, sys, re, http.server, socketserver

class RangeHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        fs = os.fstat(f.fileno())
        total_length = fs.st_size

        range_header = self.headers.get("Range")
        if not range_header or not range_header.startswith("bytes="):
            self.send_response(200)
            self.send_header("Content-type", self.guess_type(path))
            self.send_header("Content-Length", str(total_length))
            self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
            self.end_headers()
            return f

        range_match = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if not range_match:
            self.send_error(416, "Requested Range Not Satisfiable")
            f.close()
            return None

        start_str, end_str = range_match.groups()
        if start_str:
            start = int(start_str)
            end = int(end_str) if end_str else total_length - 1
        else:
            start = total_length - int(end_str)
            end = total_length - 1

        if start >= total_length or end >= total_length or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{total_length}")
            self.end_headers()
            f.close()
            return None

        content_length = end - start + 1
        self.send_response(206)
        self.send_header("Content-type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{total_length}")
        self.send_header("Content-Length", str(content_length))
        self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
        self.end_headers()

        f.seek(start)

        class SlicedFile:
            def __init__(self, file_obj, length):
                self.file_obj = file_obj
                self.remaining = length
            def read(self, size=-1):
                if self.remaining <= 0:
                    return b""
                if size < 0 or size > self.remaining:
                    size = self.remaining
                data = self.file_obj.read(size)
                self.remaining -= len(data)
                return data
            def close(self):
                self.file_obj.close()

        return SlicedFile(f, content_length)

socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("", '"$PORT"'), RangeHandler) as httpd:
    httpd.serve_forever()
'

