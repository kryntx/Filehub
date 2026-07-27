"""FileHub — entry point (waitress production server)."""

import os
from waitress import serve
from app import create_app

app = create_app()

if __name__ == '__main__':
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', '8888'))
    debug = os.environ.get('DEBUG', '').lower() in ('1', 'true', 'yes')

    if debug:
        app.run(host=host, port=port, debug=True, threaded=True)
    else:
        serve(app, host=host, port=port, threads=8, connection_limit=1000)
