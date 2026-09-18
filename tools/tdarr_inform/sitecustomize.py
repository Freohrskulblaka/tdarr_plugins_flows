"""Enable the scoped Tdarr Inform routing override at Python startup."""

import os
import sys

try:
    from explicit_routing import install

    install()
except Exception as error:
    print("[tdarr-inform-routing] Startup failed: %s" % error, file=sys.stderr)
    # Python normally ignores sitecustomize errors; never silently use old routing.
    os._exit(78)

print("[tdarr-inform-routing] Explicit library routing enabled", file=sys.stderr)
