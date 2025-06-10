from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import json

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Get the target URL from the query parameters
        url = self.path[1:]  # Remove leading slash
        
        try:
            # Make the request to the target URL
            with urllib.request.urlopen(url) as response:
                # Get the response content
                content = response.read()
                
                # Set CORS headers
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', response.headers.get_content_type())
                self.end_headers()
                
                # Write the content
                self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_msg = json.dumps({
                'error': str(e),
                'message': 'Failed to fetch from target URL'
            })
            self.wfile.write(error_msg.encode())

def run_proxy_server(port=8001):
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    print(f'Starting CORS proxy server on port {port}...')
    httpd.serve_forever()

if __name__ == '__main__':
    run_proxy_server()
