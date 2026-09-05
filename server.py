import http.server
import socketserver
import json
import os
import sys
import urllib.parse

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'shipments.json')
ADMIN_FILE = os.path.join(BASE_DIR, 'data', 'admin.json')

def load_admin():
    if not os.path.exists(ADMIN_FILE):
        return {
            "email": "admin@aeroexpress.com",
            "password": "admin123",
            "lastModified": "2026-09-04T08:00:00Z"
        }
    try:
        with open(ADMIN_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading admin: {e}", flush=True)
        return {
            "email": "admin@aeroexpress.com",
            "password": "admin123",
            "lastModified": "2026-09-04T08:00:00Z"
        }

def save_admin(admin_data):
    os.makedirs(os.path.dirname(ADMIN_FILE), exist_ok=True)
    with open(ADMIN_FILE, 'w', encoding='utf-8') as f:
        json.dump(admin_data, f, indent=2, ensure_ascii=False)

def load_shipments():
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading shipments: {e}", flush=True)
        return []

def save_shipments(shipments):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(shipments, f, indent=2, ensure_ascii=False)

class AeroExpressHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path

            # GET /api/admin/info
            if path in ('/api/admin/info', '/api/admin/info/'):
                admin = load_admin()
                data = json.dumps({'email': admin.get('email', 'admin@aeroexpress.com')}, ensure_ascii=False).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return

            # GET /api/shipments
            if path in ('/api/shipments', '/api/shipments/'):
                shipments = load_shipments()
                data = json.dumps(shipments, ensure_ascii=False).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return

            # GET /api/shipments/<code_or_query>
            if path.startswith('/api/shipments/'):
                code = urllib.parse.unquote(path[len('/api/shipments/'):]).strip().upper()
                shipments = load_shipments()
                matched = next((s for s in shipments if s.get('code', '').upper() == code), None)
                if matched:
                    data = json.dumps(matched, ensure_ascii=False).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.send_header('Content-Length', str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                else:
                    err = json.dumps({'error': f'Consignment {code} not found'}).encode('utf-8')
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.send_header('Content-Length', str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                return

            # Static file serving
            super().do_GET()
        except Exception as e:
            print(f"Exception in do_GET: {e}", flush=True)

    def do_POST(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path

            if path in ('/api/shipments', '/api/shipments/'):
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                new_shipment = json.loads(body)
                code = new_shipment.get('code', '').strip().upper()
                if not code:
                    err = json.dumps({'error': 'Tracking code is required.'}).encode('utf-8')
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return

                new_shipment['code'] = code
                shipments = load_shipments()
                existing_idx = next((i for i, s in enumerate(shipments) if s.get('code', '').upper() == code), -1)
                if existing_idx >= 0:
                    shipments[existing_idx] = new_shipment
                else:
                    shipments.insert(0, new_shipment)

                save_shipments(shipments)
                print(f"[AERO DISPATCH] Shipment {code} saved. Total records: {len(shipments)}", flush=True)

                resp = json.dumps({'success': True, 'shipment': new_shipment}).encode('utf-8')
                self.send_response(201)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                return

            # POST /api/admin/verify-credentials
            if path in ('/api/admin/verify-credentials', '/api/admin/verify-credentials/'):
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                payload = json.loads(body)
                email = payload.get('email', '').strip().lower()
                password = payload.get('password', '')

                admin = load_admin()
                admin_email = admin.get('email', 'admin@aeroexpress.com').strip().lower()
                admin_pass = admin.get('password', 'admin123')

                if email == admin_email and password == admin_pass:
                    resp = json.dumps({'valid': True, 'email': admin.get('email', 'admin@aeroexpress.com')}).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(resp)))
                    self.end_headers()
                    self.wfile.write(resp)
                else:
                    err = json.dumps({'valid': False, 'error': 'Invalid administrator email or security password.'}).encode('utf-8')
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                return

            # POST /api/admin/update-email
            if path in ('/api/admin/update-email', '/api/admin/update-email/'):
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                payload = json.loads(body)
                current_password = payload.get('currentPassword', '')
                new_email = payload.get('newEmail', '').strip()
                otp = payload.get('otp', '').strip()

                admin = load_admin()
                admin_pass = admin.get('password', 'admin123')

                if current_password != admin_pass:
                    err = json.dumps({'error': 'Incorrect current security password. Verification failed.'}).encode('utf-8')
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return

                if otp != '081599':
                    err = json.dumps({'error': 'Invalid code. Please try again.'}).encode('utf-8')
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return

                if not new_email or '@' not in new_email:
                    err = json.dumps({'error': 'Please provide a valid new email address.'}).encode('utf-8')
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return

                admin['email'] = new_email
                admin['lastModified'] = '2026-09-04T09:00:00Z'
                save_admin(admin)
                print(f"[AERO DISPATCH] Admin email updated to {new_email}", flush=True)

                resp = json.dumps({'success': True, 'email': new_email, 'message': 'Administrator email successfully updated.'}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                return

            # POST /api/admin/update-password
            if path in ('/api/admin/update-password', '/api/admin/update-password/'):
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                payload = json.loads(body)
                current_password = payload.get('currentPassword', '')
                new_password = payload.get('newPassword', '')
                confirm_password = payload.get('confirmNewPassword', '')
                otp = payload.get('otp', '').strip()

                admin = load_admin()
                admin_pass = admin.get('password', 'admin123')

                if current_password != admin_pass:
                    err = json.dumps({'error': 'Incorrect current security password. Verification failed.'}).encode('utf-8')
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return

                if otp != '081599':
                    err = json.dumps({'error': 'Invalid code. Please try again.'}).encode('utf-8')
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return

                if not new_password or len(new_password) < 6:
                    err = json.dumps({'error': 'New security password must be at least 6 characters.'}).encode('utf-8')
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return

                if new_password != confirm_password:
                    err = json.dumps({'error': 'New password and confirmation password do not match.'}).encode('utf-8')
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return

                admin['password'] = new_password
                admin['lastModified'] = '2026-09-04T09:00:00Z'
                save_admin(admin)
                print("[AERO DISPATCH] Admin security password updated successfully.", flush=True)

                resp = json.dumps({'success': True, 'message': 'Administrator security password successfully updated.'}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                return

            self.send_error(404, "Endpoint not found")
        except Exception as e:
            print(f"Exception in do_POST: {e}", flush=True)
            err = json.dumps({'error': str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(err)))
            self.end_headers()
            self.wfile.write(err)

    def do_PUT(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path

            if path.startswith('/api/shipments/'):
                code = urllib.parse.unquote(path[len('/api/shipments/'):]).strip().upper()
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                updates = json.loads(body)
                shipments = load_shipments()
                idx = next((i for i, s in enumerate(shipments) if s.get('code', '').upper() == code), -1)
                if idx >= 0:
                    shipments[idx].update(updates)
                    shipments[idx]['code'] = code
                    save_shipments(shipments)
                    resp = json.dumps({'success': True, 'shipment': shipments[idx]}).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(resp)))
                    self.end_headers()
                    self.wfile.write(resp)
                else:
                    updates['code'] = code
                    shipments.insert(0, updates)
                    save_shipments(shipments)
                    resp = json.dumps({'success': True, 'shipment': updates}).encode('utf-8')
                    self.send_response(201)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(resp)))
                    self.end_headers()
                    self.wfile.write(resp)
                return

            self.send_error(404, "Endpoint not found")
        except Exception as e:
            print(f"Exception in do_PUT: {e}", flush=True)
            err = json.dumps({'error': str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(err)))
            self.end_headers()
            self.wfile.write(err)

    def do_DELETE(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path

            if path.startswith('/api/shipments/'):
                code = urllib.parse.unquote(path[len('/api/shipments/'):]).strip().upper()
                shipments = load_shipments()
                initial_count = len(shipments)
                shipments = [s for s in shipments if s.get('code', '').upper() != code]
                if len(shipments) < initial_count:
                    save_shipments(shipments)
                    resp = json.dumps({'success': True, 'deleted': code}).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(resp)))
                    self.end_headers()
                    self.wfile.write(resp)
                else:
                    err = json.dumps({'error': f'Consignment {code} not found'}).encode('utf-8')
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                return

            self.send_error(404, "Endpoint not found")
        except Exception as e:
            print(f"Exception in do_DELETE: {e}", flush=True)

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True

    with ThreadedHTTPServer(("127.0.0.1", PORT), AeroExpressHandler) as httpd:
        print(f"[AERO EXPRESS] Server active on http://127.0.0.1:{PORT}", flush=True)
        httpd.serve_forever()
