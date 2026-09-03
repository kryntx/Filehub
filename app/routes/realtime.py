"""Realtime collaboration bus (SSE fan-out)."""

import json
import queue
import threading
import uuid

from flask import Blueprint, Response, jsonify, request

bp = Blueprint('realtime', __name__)

_clients: dict[str, queue.Queue] = {}
_lock = threading.Lock()
HEARTBEAT_INTERVAL = 30
QUEUE_MAX = 1024
ALLOWED_TYPES = {
    'drag.start', 'drag.move', 'drag.end', 'order',
    'player.open', 'player.state', 'player.close',
}


def _broadcast(payload, exclude=None):
    text = 'data: ' + json.dumps(payload, ensure_ascii=False) + '\n\n'
    dead = []
    with _lock:
        for cid, q in _clients.items():
            if cid == exclude:
                continue
            try:
                q.put_nowait(text)
            except queue.Full:
                dead.append(cid)
        for cid in dead:
            _clients.pop(cid, None)


def _presence():
    with _lock:
        online = len(_clients)
    _broadcast({'type': 'presence', 'data': {'online': online}})


def _event_stream(cid):
    q = queue.Queue(maxsize=QUEUE_MAX)
    try:
        with _lock:
            _clients[cid] = q
        _presence()
        yield 'data: ' + json.dumps(
            {'type': 'welcome', 'data': {'clientId': cid, 'online': len(_clients)}},
            ensure_ascii=False) + '\n\n'
        while True:
            try:
                msg = q.get(timeout=HEARTBEAT_INTERVAL)
                yield msg
            except queue.Empty:
                yield ': hb\n\n'
    finally:
        with _lock:
            if _clients.get(cid) is q:
                del _clients[cid]
        _presence()


@bp.route('/api/events')
def events():
    cid = (request.args.get('clientId') or '').strip() or uuid.uuid4().hex
    return Response(_event_stream(cid), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
    })


@bp.route('/api/events/send', methods=['POST'])
def send():
    data = request.get_json(silent=True) or {}
    etype = data.get('type')
    if etype not in ALLOWED_TYPES:
        return jsonify({'error': '非法事件类型'}), 400
    payload = data.get('data')
    if not isinstance(payload, dict):
        payload = {}
    sender = (request.args.get('clientId') or data.get('sender') or '').strip()
    _broadcast({'type': etype, 'data': payload, 'sender': sender}, exclude=sender)
    return jsonify({'ok': True})
