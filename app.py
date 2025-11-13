import os
import logging

try:
    from flask import Flask, render_template, jsonify
    from flask_cors import CORS
    from werkzeug.middleware.proxy_fix import ProxyFix
    from config import config
except ImportError as e:
    print("Missing dependency:", e.name if hasattr(e, 'name') else e)
    print()
    print("This project requires some Python packages that are not installed.")
    print("On Windows PowerShell you can run:")
    print("  .\\install_deps.ps1")
    print("or manually create a venv and install requirements:")
    print("  python -m venv .venv")
    print("  .\\.venv\\Scripts\\Activate.ps1")
    print("  python -m pip install -r requirements.txt")
    import sys
    sys.exit(1)

def create_app(config_name=None):
    """Application factory pattern"""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)
    
    # Configure logging
    if not app.config['DEBUG']:
        logging.basicConfig(level=logging.INFO)
    else:
        logging.basicConfig(level=logging.DEBUG)
    
    # Set up proxy fix for production
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
    
    # Enable CORS with configuration
    CORS(app, origins=app.config['CORS_ORIGINS'])
    
    return app

# Create app instance
app = create_app()

# Create necessary directories
os.makedirs('data', exist_ok=True)
os.makedirs('exports', exist_ok=True)

# Register API blueprints
from api.projects import projects_bp
from api.images import images_bp
from api.processing import processing_bp
from api.annotations import annotations_bp
from api.exports import exports_bp
from api.augment import augment_bp
from api.synthetic import synthetic_bp
from api.segmentation import segmentation_bp
from api.validate import validate_bp

app.register_blueprint(projects_bp, url_prefix='/api/projects')
app.register_blueprint(images_bp, url_prefix='/api/images')
app.register_blueprint(processing_bp, url_prefix='/api/processing')
app.register_blueprint(annotations_bp, url_prefix='/api/annotations')
app.register_blueprint(exports_bp, url_prefix='/api/exports')
app.register_blueprint(augment_bp, url_prefix='/api/augment')
app.register_blueprint(synthetic_bp, url_prefix='/api/synthetic')
app.register_blueprint(segmentation_bp, url_prefix='/api/segmentation')
app.register_blueprint(validate_bp, url_prefix='/api/validate')

@app.route('/')
def index():
    """Main application page"""
    return render_template('index.html')

@app.route('/api/musnad/characters')
def musnad_characters():
    """Get Musnad characters for virtual keyboard"""
    characters = []
    
    # Generate Musnad characters from Unicode range
    for codepoint in range(0x10A60, 0x10A80):
        characters.append({
            'character': chr(codepoint),
            'unicode': f'U+{codepoint:04X}',
            'code_point': codepoint,
            'category': 'letter' if codepoint <= 0x10A7D else 'symbol'
        })
    
    # Add some common Arabic characters
    arabic_chars = [
        (0x0627, 'alif'), (0x0628, 'beh'), (0x062A, 'teh'), (0x062B, 'theh'),
        (0x062C, 'jeem'), (0x062D, 'hah'), (0x062E, 'khah'), (0x062F, 'dal'),
        (0x0630, 'thal'), (0x0631, 'reh'), (0x0632, 'zain'), (0x0633, 'seen'),
        (0x0634, 'sheen'), (0x0635, 'sad'), (0x0636, 'dad'), (0x0637, 'tah'),
        (0x0638, 'zah'), (0x0639, 'ain'), (0x063A, 'ghain'), (0x0641, 'feh'),
        (0x0642, 'qaf'), (0x0643, 'kaf'), (0x0644, 'lam'), (0x0645, 'meem'),
        (0x0646, 'noon'), (0x0647, 'heh'), (0x0648, 'waw'), (0x064A, 'yeh')
    ]
    
    for codepoint, name in arabic_chars:
        characters.append({
            'character': chr(codepoint),
            'unicode': f'U+{codepoint:04X}',
            'code_point': codepoint,
            'category': 'arabic',
            'name': name
        })
    
    return jsonify({'characters': characters})

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Resource not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Get configuration from environment or use defaults
    host = app.config.get('HOST', '127.0.0.1')
    port = app.config.get('PORT', 5000)
    debug = app.config.get('DEBUG', False)
    
    app.run(host=host, port=port, debug=debug)
