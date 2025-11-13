import os
from app import app

if __name__ == "__main__":
    host = os.environ.get("HOST", app.config.get("HOST", "0.0.0.0"))
    port = int(os.environ.get("PORT", app.config.get("PORT", 5000)))
    # Ensure production defaults
    debug = False
    app.run(host=host, port=port, debug=debug)
