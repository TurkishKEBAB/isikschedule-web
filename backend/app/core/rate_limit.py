"""Shared slowapi rate limiter.

Kept in its own module so route modules and ``main.py`` import the *same*
``Limiter`` instance without a circular dependency (``main`` imports routes,
routes would otherwise import ``main``).

Rate limiting is keyed by client IP. It can be turned off wholesale via
``settings.RATE_LIMIT_ENABLED`` — the smoke suite disables it so the
process-wide limiter state never bleeds across tests.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from ..config import settings

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.RATE_LIMIT_ENABLED,
)
