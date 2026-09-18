#!/usr/bin/env python3
"""
LOGOS-3 Development Server with Byte-Range Audio Support & File Saving API
"""
import os
import sys
import re
import json
import http.server
import socketserver

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8002

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

    def do_GET(self):
        if self.path.startswith("/api/list-cases"):
            cases_dir = os.path.join(os.getcwd(), "game", "cases")
            cases = []
            if os.path.isdir(cases_dir):
                for fname in sorted(os.listdir(cases_dir)):
                    if fname.endswith(".json") and fname != "progression.json":
                        fpath = os.path.join(cases_dir, fname)
                        title = fname
                        case_id = fname[:-5]
                        subtitle = ""
                        try:
                            with open(fpath, "r", encoding="utf-8") as jf:
                                data = json.load(jf)
                                title = data.get("meta", {}).get("title") or data.get("title") or fname
                                subtitle = data.get("meta", {}).get("subtitle") or ""
                                case_id = data.get("id") or case_id
                        except Exception:
                            pass
                        cases.append({
                            "id": case_id,
                            "filename": fname,
                            "path": f"cases/{fname}",
                            "title": title,
                            "subtitle": subtitle
                        })
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(cases, ensure_ascii=False).encode("utf-8"))
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/save-file":
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode("utf-8"))
                file_rel = payload.get("file", "")
                content = payload.get("content", "")

                clean_path = os.path.normpath(file_rel).lstrip("./")
                if ".." in clean_path or os.path.isabs(clean_path):
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"error": "Invalid path"}')
                    return

                target_dir = os.path.dirname(clean_path)
                if target_dir:
                    os.makedirs(target_dir, exist_ok=True)

                with open(clean_path, "w", encoding="utf-8") as out_f:
                    out_f.write(content)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok", "file": clean_path}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        self.send_error(404, "Endpoint not found")

if __name__ == "__main__":
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    print(f"Starting server on port {PORT}...")
    with socketserver.ThreadingTCPServer(("", PORT), RangeHandler) as httpd:
        httpd.serve_forever()
