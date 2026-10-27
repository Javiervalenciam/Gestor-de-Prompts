import os

file_path = r"c:\Users\djjav\Documents\Gestor de Prompts v2\app.js"
card_css_path = r"c:\Users\djjav\Documents\Gestor de Prompts v2\estilos.css_append_z.css"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the old handler if present (simple check for the comment)
old_handler_start = "// Global Dropdown Handler"
if old_handler_start in content:
    content = content.split(old_handler_start)[0]  # Truncate at the old handler

# Append the new handler
new_handler_path = r"c:\Users\djjav\Documents\Gestor de Prompts v2\app_handler_v2.js"
with open(new_handler_path, 'r', encoding='utf-8') as f:
    new_handler = f.read()

content = content + "\n" + new_handler

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
