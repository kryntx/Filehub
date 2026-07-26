"""FileHub — entry point."""

import os

from app import create_app

app = create_app()

if __name__ == '__main__':
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', '8888'))
    debug = os.environ.get('DEBUG', '').lower() in ('1', 'true', 'yes')
    app.run(host=host, port=port, debug=debug, threaded=True)
