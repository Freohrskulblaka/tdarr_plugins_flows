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

try:
    from filename_tags import install as install_filename_tags

    install_filename_tags()
except Exception as error:
    print("[radarr-filename-tags] Optional startup failed (%s)" % type(error).__name__,
          file=sys.stderr)
