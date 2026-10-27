import os

app_js = r"c:\Users\djjav\Documents\Gestor de Prompts v2\app.js"
with open(app_js, 'r', encoding='utf-8') as f:
    f.seek(0, 2)
    fsize = f.tell()
    f.seek(max(fsize - 2000, 0))
    tail = f.read()
    print("--- TAIL START ---")
    print(repr(tail))
    print("--- TAIL END ---")
