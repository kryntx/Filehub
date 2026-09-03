"""FileHub — entry point (gevent production server).

gevent 以协程并发：SSE 长连接、大文件上传等挂起等待时只占用协程，
不会像 waitress 线程池那样被 N 个在线用户的 SSE 连接占满而卡死。
"""

import os

from gevent import monkey
monkey.patch_all()

from gevent.pool import Pool
from gevent.pywsgi import WSGIServer

from app import create_app

app = create_app()

if __name__ == '__main__':
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', '8888'))
    debug = os.environ.get('DEBUG', '').lower() in ('1', 'true', 'yes')

    if debug:
        app.run(host=host, port=port, debug=True, threaded=True)
    else:
        server = WSGIServer((host, port), app, spawn=Pool(1000))
        server.serve_forever()
