"""Password hashing and per-IP failed-attempt rate limiting."""

import hashlib
import hmac
import os
import threading
import time

_ALGO = 'pbkdf2_sha256'
_ITERATIONS = 200_000
_SALT_BYTES = 16


def hash_password(password: str) -> str:
    """Hash a plaintext password into pbkdf2_sha256$iterations$salt$digest."""
    salt = os.urandom(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, _ITERATIONS)
    return f'{_ALGO}${_ITERATIONS}${salt.hex()}${digest.hex()}'


def verify_password(attempt: str, stored: str) -> bool:
    """Constant-time verification of an attempt against a stored hash string."""
    try:
        algo, iterations, salt_hex, digest_hex = stored.split('$')
        if algo != _ALGO:
            return False
        digest = hashlib.pbkdf2_hmac(
            'sha256', attempt.encode('utf-8'), bytes.fromhex(salt_hex), int(iterations))
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


class RateLimiter:
    """In-memory per-IP failed-attempt limiter with lockout window.

    Attempts are counted in a fixed window starting from the first failure;
    once the window expires without reaching the threshold, the count resets.
    """

    def __init__(self, max_attempts: int, lockout_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.lockout_seconds = lockout_seconds
        self._records = {}
        self._lock = threading.Lock()

    def is_locked(self, ip: str) -> bool:
        with self._lock:
            self._prune()
            rec = self._records.get(ip)
            return bool(rec and rec['locked_until'] > time.time())

    def register_failure(self, ip: str) -> tuple:
        """Record a failed attempt.

        Returns (locked_now, attempts_left): locked_now is True when this
        failure triggered the lockout; attempts_left counts remaining tries
        before lockout (0 when locked).
        """
        now = time.time()
        with self._lock:
            self._prune()
            rec = self._records.get(ip)
            if not rec or now - rec['first'] > self.lockout_seconds:
                rec = {'first': now, 'count': 0, 'locked_until': 0}
                self._records[ip] = rec
            rec['count'] += 1
            if rec['count'] >= self.max_attempts:
                rec['locked_until'] = now + self.lockout_seconds
                return True, 0
            return False, self.max_attempts - rec['count']

    def reset(self, ip: str) -> None:
        with self._lock:
            self._records.pop(ip, None)

    def _prune(self) -> None:
        """Drop records whose lockout expired long ago to bound memory."""
        if len(self._records) < 1024:
            return
        cutoff = time.time() - self.lockout_seconds * 2
        for ip, rec in list(self._records.items()):
            if rec['locked_until'] < cutoff and rec['first'] < cutoff:
                del self._records[ip]
