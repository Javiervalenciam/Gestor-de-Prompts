import os

app_js = r"c:\Users\djjav\Documents\Gestor de Prompts v2\app.js"
css_file = r"c:\Users\djjav\Documents\Gestor de Prompts v2\estilos.css"

# Revert app.js
if os.path.exists(app_js):
    with open(app_js, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We look for the function we added
    # It contains "window._accordionSetupDone"
    
    unique_string = "window._accordionSetupDone"
    
    if unique_string in content:
        # Find the start of the function containing this string
        # We know it starts with 'function setupAccordion() {' just before it
        # Searching backwards from the unique string position
        
        idx = content.rfind("function setupAccordion() {")
        # Check if unique_string is after this index
        if idx != -1 and content.find(unique_string, idx) != -1:
             # This is our targeted function.
             # We truncate the file at 'idx' (minus the newline before it if possible)
             restored_content = content[:idx].rstrip()
             with open(app_js, 'w', encoding='utf-8') as f:
                 f.write(restored_content)
             print("Reverted app.js (removed last setupAccordion)")
        else:
             print("Found unique string but couldn't backtrack to function start properly.")
    else:
        print("Unique string not found in app.js - already reverted?")

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
