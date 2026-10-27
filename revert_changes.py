import os

app_js = r"c:\Users\djjav\Documents\Gestor de Prompts v2\app.js"
css_file = r"c:\Users\djjav\Documents\Gestor de Prompts v2\estilos.css"

# Revert app.js
if os.path.exists(app_js):
    with open(app_js, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Marker for the accordion fix
    marker = "function setupAccordion() {\n    // Idempotent: check if already setup"
    if marker in content:
        split_content = content.split(marker)
        if len(split_content) > 1:
            # Keep the part before the marker
            restored_content = split_content[0].rstrip()
            # We might have appended it with a newline
            with open(app_js, 'w', encoding='utf-8') as f:
                f.write(restored_content)
            print("Reverted app.js")
    else:
        print("Marker not found in app.js - maybe already reverted or different format")

# Revert estilos.css
if os.path.exists(css_file):
    with open(css_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    marker_css = "/* Accordion Chevron Rotation */"
    if marker_css in content:
        split_content = content.split(marker_css)
        if len(split_content) > 1:
            restored_content = split_content[0].rstrip()
            with open(css_file, 'w', encoding='utf-8') as f:
                f.write(restored_content)
            print("Reverted estilos.css")
    else:
        print("Marker not found in estilos.css")
