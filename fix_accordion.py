import os

file_path = r"c:\Users\djjav\Documents\Gestor de Prompts v2\app.js"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Disable setupAccordion content to avoid duplicate listeners if called
# Find the function definition
setup_acc_signature = "function setupAccordion() {"
if setup_acc_signature in content:
    # We replace the body with empty or just return
    # This is a bit risky with simple replace if there are braces inside, but setupAccordion is simple
    # logic: replace the whole function block if we can identify it.
    # Alternatively, we can just replace the logic inside setupEventListeners.
    pass

# Better approach: We will APPEND the new listeners to setupEventListeners by finding where it ends?
# No, setupEventListeners is a big function.
# Let's replace the whole setupEventListeners function? No, it's huge.

# Let's REPLACE 'function setupAccordion() { ... }' with code that does NOTHING,
# because we will implement the logic via delegation in a new block we append to setupEventListeners
# or just append a new init function.

# Actually, the user's issue is likely that setupAccordion IS called, but multiple times.
# If I change setupAccordion to use DELEGATION on the container, it doesn't matter if called multiple times
# IF I make sure I don't attach multiple listeners to the container.

# Let's rewrite setupAccordion to be robust.
new_setup_accordion = """function setupAccordion() {
    // Idempotent: check if already setup
    if (window._accordionSetupDone) return;
    window._accordionSetupDone = true;

    const guideAccordion = document.getElementById('guideAccordion');
    if (guideAccordion) {
        guideAccordion.addEventListener('click', (e) => {
            const header = e.target.closest('.accordion-header');
            if (header) {
                const item = header.closest('.accordion-item');
                const content = item.querySelector('.accordion-content');
                if (item && content) {
                    const isOpen = item.classList.contains('open');
                    item.classList.toggle('open', !isOpen);
                    content.style.display = isOpen ? 'none' : 'block';
                }
            }
        });
    }

    const expandBtn = document.getElementById('expandAllAccordion');
    if (expandBtn) expandBtn.addEventListener('click', expandAllAccordion);

    const collapseBtn = document.getElementById('collapseAllAccordion');
    if (collapseBtn) collapseBtn.addEventListener('click', collapseAllAccordion);
}"""

# We need to find the old setupAccordion and replace it.
# It starts at line 359 approx.
import re
# Regex to match function setupAccordion() { ... } including nested braces is hard.
# But we know the content from previous `view_file`.

old_setup_accordion_start = "function setupAccordion() {"
# We'll assume the old function ends before 'function expandAllAccordion() {'
end_marker = "function expandAllAccordion() {"

if old_setup_accordion_start in content and end_marker in content:
    parts = content.split(old_setup_accordion_start)
    pre = parts[0]
    post = parts[1].split(end_marker)[1]
    # We reconstruct: Pre + New Function + End Marker + Post
    # But wait, we need to keep expandAllAccordion definition.
    
    # Let's use string replacement for the known body if possible.
    # The body was:
    # document.querySelectorAll('.accordion-item').forEach(item => {
    #    ...
    # });
    
    # Let's just append the listener logic to the end of the file and make setupAccordion empty.
    
    content = content.replace("function setupAccordion() {", "function setupAccordion() { return; // Disabled old logic \n function old_setupAccordion() {")
    # This comments out the old logic effectively? No.
    
    # Let's try to match the specific string we saw in view_file.
    old_block = """function setupAccordion() {
    document.querySelectorAll('.accordion-item').forEach(item => {
        const header = item.querySelector('.accordion-header');
        const content = item.querySelector('.accordion-content');
        if (header && content) {
            header.addEventListener('click', () => {
                const isOpen = item.classList.contains('open');
                item.classList.toggle('open', !isOpen);
                content.style.display = isOpen ? 'none' : 'block';
            });
        }
    });
}"""
    
    if old_block in content:
        content = content.replace(old_block, new_setup_accordion)
        print("Replaced setupAccordion successfully.")
    else:
        print("Could not exact match setupAccordion. Appending fix.")
        # If we can't replace, we can append a script that runs on load to fix it.
        # override the function globally?
        content += "\n" + new_setup_accordion

else:
    print("Could not find setupAccordion markers.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
