// --- CONSTANTES Y VARIABLES GLOBALES ---
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

// --- Font Awesome v6 normalizer for legacy classes/names ---
const __FA_STYLE_MAP__ = { fas: 'fa-solid', far: 'fa-regular', fab: 'fa-brands' };
const __FA_NAME_MAP__ = {
    'fa-exclamation-triangle': 'fa-triangle-exclamation',
    'fa-info-circle': 'fa-circle-info',
    'fa-exclamation-circle': 'fa-circle-exclamation',
    'fa-check-circle': 'fa-circle-check',
    'fa-trash-alt': 'fa-trash-can',
    'fa-map-marker-alt': 'fa-location-dot',
    'fa-list-alt': 'fa-rectangle-list',
    'fa-sticky-note': 'fa-note-sticky',
    'fa-plus-circle': 'fa-circle-plus',
    'fa-angle-double-left': 'fa-angles-left',
    'fa-angle-double-right': 'fa-angles-right',
    'fa-expand-arrows-alt': 'fa-up-right-and-down-left-from-center',
    'fa-compress-arrows-alt': 'fa-down-left-and-up-right-to-center',
    'fa-edit': 'fa-pen-to-square',
    'fa-tasks': 'fa-list-check',
    'fa-sync-alt': 'fa-arrows-rotate'
};

function normalizeFAIconElement(el) {
    if (!el || !el.classList) return;
    // Style prefix
    Object.keys(__FA_STYLE_MAP__).forEach(old => {
        if (el.classList.contains(old)) {
            el.classList.remove(old);
            el.classList.add(__FA_STYLE_MAP__[old]);
        }
    });
    // Icon name remap
    Object.keys(__FA_NAME_MAP__).forEach(oldName => {
        if (el.classList.contains(oldName)) {
            el.classList.remove(oldName);
            el.classList.add(__FA_NAME_MAP__[oldName]);
        }
    });
}

function normalizeFontAwesome() {
    document.querySelectorAll('i').forEach(normalizeFAIconElement);
}

function installFANormalizer() {
    try {
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                m.addedNodes.forEach(node => {
                    if (!(node instanceof Element)) return;
                    if (node.matches('i')) normalizeFAIconElement(node);
                    node.querySelectorAll && node.querySelectorAll('i').forEach(normalizeFAIconElement);
                });
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        // Initial pass
        normalizeFontAwesome();
    } catch (_) {
        // No-op if MutationObserver is unavailable
        normalizeFontAwesome();
    }
}

const LOCAL_STORAGE_KEY = 'aiPrompts_v3';
const AUTOSAVE_KEY = 'aiPrompts_autosave';
const BACKUP_REMINDER_DAYS = 14;
const LAST_EXPORT_KEY = 'aiPrompts_lastExport';
const THEME_KEY = 'aiPrompts_theme';
const MUNICIPIOS_KEY = 'aiPrompts_municipios';
const TEMPLATES_KEY = 'aiPrompts_templates_v1';

// Lista de municipios por defecto
const MUNICIPIOS_DEFAULT = [
    'ARBOLEDAS', 'BOCHALEMA', 'CACHIRA', 'CHINACOTA', 'CHITAGA', 'CONVENCION', 
    'CUCUTA', 'EL TARRA', 'HACARI', 'HERRAN', 'LABATECA', 'LA ESPERANZA', 
    'LOURDES', 'MUTISCUA', 'OCAÑA', 'PUERTO SANTANDER', 'RAGONVALIA', 
    'TOLEDO', 'VILLA CARO', 'VILLA DEL ROSARIO'
];

// Estado Global
let prompts = [];
let templates = [];
let municipios = [];
let isDarkMode = false;
let currentPage = 1;
const promptsPerPage = 9; // Reducir para mejor visualización
let selectedPromptIds = new Set();
let autosaveTimeout = null;
let currentPlaceholders = {};
let originalPlaceholderText = "";

// --- FUNCIONES DE UTILIDAD ---

function formatDate(isoString) {
    if (!isoString) return 'N/A';
    try {
        return new Date(isoString).toLocaleString('es-ES', { 
            dateStyle: 'short', 
            timeStyle: 'short' 
        });
    } catch (e) {
        return 'Fecha inválida';
    }
}

/* MIGRATED: use ui.js */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <i class="icon fa-solid fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 400);
    }, 3000);
}

function copyToClipboard(text, successMessage = 'Copiado al portapapeles') {
    if (!navigator.clipboard) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast(successMessage, 'success');
        } catch (err) {
            console.error('Fallback: No se pudo copiar', err);
            showToast('No se pudo copiar el texto.', 'error');
        }
        document.body.removeChild(textArea);
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMessage, 'success');
    }).catch(err => {
        console.error('No se pudo copiar:', err);
        showToast('No se pudo copiar. Revisa permisos del navegador.', 'error');
    });
}

// --- GESTIÓN DEL TEMA ---

/* MIGRATED: use ui.js */
function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    isDarkMode = savedTheme === 'dark';
    applyTheme();
}

/* MIGRATED: use ui.js */
function toggleTheme() {
    isDarkMode = !isDarkMode;
    localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
    applyTheme();
}

/* MIGRATED: use ui.js */
function applyTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const icon = themeToggle?.querySelector('i');
    
    if (isDarkMode) {
        body.classList.add('dark');
        if (icon) {
            icon.className = 'fa-solid fa-sun';
            themeToggle.title = 'Cambiar a modo claro';
        }
    } else {
        body.classList.remove('dark');
        if (icon) {
            icon.className = 'fa-solid fa-moon';
            themeToggle.title = 'Cambiar a modo oscuro';
        }
    }
}

// --- GESTIÓN DE PLANTILLAS ---

function loadTemplates() {
    const saved = localStorage.getItem(TEMPLATES_KEY);
    try {
        const parsed = saved ? JSON.parse(saved) : [];
        // Migración/normalización
        templates = Array.isArray(parsed) ? parsed.map(t => ({
            id: t.id || `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            category: ['role','tone','constraint'].includes(t.category) ? t.category : 'role',
            name: typeof t.name === 'string' ? t.name : '',
            text: typeof t.text === 'string' ? t.text : '',
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString(),
            usageCount: Number.isFinite(t.usageCount) ? t.usageCount : 0
        })) : [];
    } catch (e) {
        console.error('Error al cargar plantillas:', e);
        templates = [];
    }
}

function saveTemplates() {
    try {
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    } catch (e) {
        console.error('Error al guardar plantillas:', e);
        showToast('Error al guardar las plantillas.', 'error');
    }
}

// --- AUTOCOMPLETADO DE PLANTILLAS EN CAMPOS DEL FORMULARIO ---

function createOrUpdateTemplatesAutocompleteMenu(category, anchorElement, matchedTemplates, onSelect) {
    const menuId = `acTpl-${category}`;
    let menu = document.getElementById(menuId);
    if (!menu) {
        menu = document.createElement('div');
        menu.id = menuId;
        menu.style.position = 'absolute';
        menu.style.zIndex = '1002';
        menu.style.background = 'var(--bg-card)';
        menu.style.border = '1px solid var(--border-light)';
        menu.style.borderRadius = '12px';
        menu.style.boxShadow = 'var(--shadow-lg)';
        menu.style.padding = '6px';
        menu.style.maxWidth = '520px';
        menu.style.maxHeight = '300px';
        menu.style.overflow = 'auto';
        document.body.appendChild(menu);
    }

    menu.innerHTML = '';
    const listContainer = document.createElement('div');
    listContainer.style.display = 'grid';
    listContainer.style.gap = '4px';

    if (matchedTemplates.length > 0) {
        matchedTemplates.forEach((tpl, index) => {
            const item = document.createElement('div');
            item.className = 'ac-item';
            item.style.cssText = 'padding:8px; border-radius:8px; cursor:pointer;';
            const title = escapeHTML(tpl.name || (tpl.text.substring(0, 60) + (tpl.text.length > 60 ? '…' : '')));
            const preview = escapeHTML(tpl.text);
            item.innerHTML = `<div style="font-weight:600; color: var(--primary-dark);">${title}</div><div style="font-size:0.875rem; color: var(--text-secondary); max-height:3.0em; overflow:hidden;">${preview}</div>`;
            item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-secondary)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');
            item.addEventListener('click', () => onSelect(tpl));
            item.dataset.index = String(index);
            listContainer.appendChild(item);
        });
    }

    menu.appendChild(listContainer);

    const rect = anchorElement.getBoundingClientRect();
    menu.style.top = `${window.scrollY + rect.bottom + 6}px`;
    menu.style.left = `${window.scrollX + rect.left}px`;

    const onClickOutside = (ev) => {
        if (!menu.contains(ev.target) && ev.target !== anchorElement) {
            menu.remove();
            document.removeEventListener('click', onClickOutside);
        }
    };
    setTimeout(() => document.addEventListener('click', onClickOutside), 0);

    return menu;
}

function closeTemplatesAutocompleteMenu(category) {
    const menu = document.getElementById(`acTpl-${category}`);
    if (menu) menu.remove();
}

function filterTemplatesForAutocomplete(category, query) {
    const norm = (query || '').toLowerCase().trim();
    const source = templates.filter(t => t.category === category);
    if (!norm) {
        return source
            .slice()
            .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 8);
    }
    const filtered = source.filter(t =>
        (t.name && t.name.toLowerCase().includes(norm)) || (t.text && t.text.toLowerCase().includes(norm))
    );
    return filtered
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 8);
}

/* MIGRATED: use ui.js */
function setupTemplateAutocomplete() {
    const bindings = [
        { id: 'promptRole', category: 'role' },
        { id: 'promptTone', category: 'tone' },
        { id: 'promptConstraints', category: 'constraint' }
    ];

    const categoryToActiveIndex = {};

    bindings.forEach(({ id, category }) => {
        const field = document.getElementById(id);
        if (!field) return;

        const openMenu = () => {
            const q = field.value;
            const matches = filterTemplatesForAutocomplete(category, q);
            // No mostrar el menú si hay menos de 2 caracteres o no hay coincidencias
            if (q.trim().length < 2 || matches.length === 0) {
                closeTemplatesAutocompleteMenu(category);
                return;
            }
            const menu = createOrUpdateTemplatesAutocompleteMenu(category, field, matches, (tpl) => {
                applyTemplateToForm(tpl);
                closeTemplatesAutocompleteMenu(category);
                field.focus();
            });
            categoryToActiveIndex[category] = 0;
            highlightActiveItem(menu, categoryToActiveIndex[category]);
        };

        const highlightActiveItem = (menuEl, activeIndex) => {
            if (!menuEl) return;
            menuEl.querySelectorAll('.ac-item').forEach((node) => {
                node.style.background = 'transparent';
            });
            const active = menuEl.querySelector(`.ac-item[data-index="${activeIndex}"]`);
            if (active) {
                active.style.background = 'var(--bg-secondary)';
                active.scrollIntoView({ block: 'nearest' });
            }
        };

        field.addEventListener('input', () => {
            // Sólo abrir si hay plantillas en esa categoría
            if (!templates.some(t => t.category === category)) {
                closeTemplatesAutocompleteMenu(category);
                return;
            }
            openMenu();
        });

        field.addEventListener('focus', () => {
            if (!templates.some(t => t.category === category)) return;
            openMenu();
        });

        field.addEventListener('keydown', (e) => {
            const menu = document.getElementById(`acTpl-${category}`);
            if (!menu) return;
            const items = menu.querySelectorAll('.ac-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!items.length) return;
                categoryToActiveIndex[category] = Math.min((categoryToActiveIndex[category] || 0) + 1, items.length - 1);
                highlightActiveItem(menu, categoryToActiveIndex[category]);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!items.length) return;
                categoryToActiveIndex[category] = Math.max((categoryToActiveIndex[category] || 0) - 1, 0);
                highlightActiveItem(menu, categoryToActiveIndex[category]);
            } else if (e.key === 'Enter') {
                const activeIdx = categoryToActiveIndex[category] || 0;
                const activeEl = menu.querySelector(`.ac-item[data-index="${activeIdx}"]`);
                if (activeEl) {
                    e.preventDefault();
                    const idx = parseInt(activeEl.dataset.index, 10);
                    const q = field.value;
                    const matches = filterTemplatesForAutocomplete(category, q);
                    const selected = matches[idx];
                    if (selected) {
                        applyTemplateToForm(selected);
                        closeTemplatesAutocompleteMenu(category);
                        field.focus();
                    }
                }
            } else if (e.key === 'Escape') {
                closeTemplatesAutocompleteMenu(category);
            }
        });

        window.addEventListener('scroll', () => {
            const menu = document.getElementById(`acTpl-${category}`);
            if (menu && field === document.activeElement) {
                const rect = field.getBoundingClientRect();
                menu.style.top = `${window.scrollY + rect.bottom + 6}px`;
                menu.style.left = `${window.scrollX + rect.left}px`;
            }
        }, { passive: true });
        window.addEventListener('resize', () => {
            const menu = document.getElementById(`acTpl-${category}`);
            if (menu && field === document.activeElement) {
                const rect = field.getBoundingClientRect();
                menu.style.top = `${window.scrollY + rect.bottom + 6}px`;
                menu.style.left = `${window.scrollX + rect.left}px`;
            }
        });
    });
}

function normalizeTextForKey(text) {
    return (text || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function templateExists(category, text) {
    const key = normalizeTextForKey(text);
    return templates.some(t => t.category === category && normalizeTextForKey(t.text) === key);
}

/* MIGRATED: use templates.js */
function addTemplate(category, name, text) {
    const cleanText = (text || '').trim();
    if (!cleanText) {
        showToast('El texto de la plantilla no puede estar vacío.', 'error');
        return false;
    }
    if (templateExists(category, cleanText)) {
        showToast('Esta plantilla ya existe.', 'warning');
        return false;
    }
    const now = new Date().toISOString();
    const tpl = {
        id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        category,
        name: (name || '').trim(),
        text: cleanText,
        createdAt: now,
        updatedAt: now,
        usageCount: 0
    };
    templates.push(tpl);
    saveTemplates();
    renderTemplates();
    showToast('Plantilla añadida.', 'success');
    return true;
}

/* MIGRATED: use templates.js */
function updateTemplate(id, name, text) {
    const idx = templates.findIndex(t => t.id === id);
    if (idx === -1) return;
    const cleanText = (text || '').trim();
    if (!cleanText) {
        showToast('El texto de la plantilla no puede estar vacío.', 'error');
        return;
    }
    // Evitar duplicados con otros ids
    const category = templates[idx].category;
    const key = normalizeTextForKey(cleanText);
    if (templates.some(t => t.category === category && t.id !== id && normalizeTextForKey(t.text) === key)) {
        showToast('Otra plantilla con el mismo texto ya existe.', 'warning');
        return;
    }
    templates[idx].name = (name || '').trim();
    templates[idx].text = cleanText;
    templates[idx].updatedAt = new Date().toISOString();
    saveTemplates();
    renderTemplates();
    showToast('Plantilla actualizada.', 'success');
}

/* MIGRATED: use templates.js */
function deleteTemplate(id) {
    const idx = templates.findIndex(t => t.id === id);
    if (idx === -1) return;
    const name = templates[idx].name || templates[idx].text.substring(0, 40) + (templates[idx].text.length > 40 ? '…' : '');
    if (!confirm(`¿Eliminar la plantilla "${name}"?`)) return;
    templates.splice(idx, 1);
    saveTemplates();
    renderTemplates();
    showToast('Plantilla eliminada.', 'info');
}

/* MIGRATED: use templates.js */
function applyTemplateToForm(template) {
    const modeReplace = document.getElementById('templateApplyModeReplace')?.checked ?? true;
    let targetId = null;
    if (template.category === 'role') targetId = 'promptRole';
    if (template.category === 'tone') targetId = 'promptTone';
    if (template.category === 'constraint') targetId = 'promptConstraints';
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) {
        showToast('No se encontró el campo de destino en el formulario.', 'error');
        return;
    }
    if (modeReplace || !target.value) {
        target.value = template.text;
    } else {
        const joiner = target.value.endsWith('\n') ? '' : '\n';
        target.value = target.value + joiner + template.text;
    }
    // Pequeña UX: ir a la pestaña de crear para ver el resultado
    showSection('createPromptSection');
    // Reajustar auto-resize
    target.dispatchEvent(new Event('input'));
    // Incrementar uso de plantilla
    const idx = templates.findIndex(t => t.id === template.id);
    if (idx > -1) {
        templates[idx].usageCount = (templates[idx].usageCount || 0) + 1;
        templates[idx].updatedAt = new Date().toISOString();
        saveTemplates();
        renderTemplates();
    }
    showToast('Plantilla aplicada al formulario.', 'success');
}

/* MIGRATED: use templates.js */
function renderTemplates() {
    const rolesList = document.getElementById('rolesTemplatesList');
    const tonesList = document.getElementById('tonesTemplatesList');
    const constraintsList = document.getElementById('constraintsTemplatesList');
    if (!rolesList || !tonesList || !constraintsList) return;

    const createItem = (tpl) => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center';
        div.style.cssText = `padding: var(--spacing-md); border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--bg-card); margin-bottom: var(--spacing-sm);`;
        const safeName = escapeHTML(tpl.name || '');
        const safeText = escapeHTML(tpl.text);
        const title = safeName ? `${safeName}` : `${safeText.substring(0, 40)}${tpl.text.length > 40 ? '…' : ''}`;
        div.innerHTML = `
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; color: var(--primary-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
                <div style="color: var(--text-secondary); font-size: 0.875rem; max-height: 3.6em; overflow: hidden;">${safeText}</div>
                <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">Usos: ${tpl.usageCount || 0}</div>
            </div>
            <div class="flex gap-sm" style="margin-left: var(--spacing-md);">
                <button class="btn btn-success btn-sm" title="Aplicar al formulario"><i class="fas fa-check"></i></button>
                <button class="btn btn-info btn-sm" title="Previsualizar"><i class="fas fa-eye"></i></button>
                <button class="btn btn-secondary btn-sm" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" title="Eliminar"><i class="fas fa-trash"></i></button>
            </div>`;
        const [applyBtn, previewBtn, editBtn, delBtn] = div.querySelectorAll('button');
        applyBtn.addEventListener('click', () => applyTemplateToForm(tpl));
        previewBtn.addEventListener('click', () => openPreviewTemplateModal(tpl));
        editBtn.addEventListener('click', () => openEditTemplateModal(tpl));
        delBtn.addEventListener('click', () => deleteTemplate(tpl.id));
        return div;
    };

    const renderList = (container, category) => {
        container.innerHTML = '';
        const list = templates.filter(t => t.category === category);
        if (list.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: var(--spacing-md);">No hay plantillas.</p>';
            return;
        }
        // Orden: más usadas y más recientes
        list.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || new Date(b.updatedAt) - new Date(a.updatedAt));
        list.forEach(t => container.appendChild(createItem(t)));
    };

    renderList(rolesList, 'role');
    renderList(tonesList, 'tone');
    renderList(constraintsList, 'constraint');
}

function openEditTemplateModal(tpl) {
    const idInput = document.getElementById('editTemplateId');
    const catInput = document.getElementById('editTemplateCategory');
    const catLabel = document.getElementById('editTemplateCategoryLabel');
    const nameInput = document.getElementById('editTemplateName');
    const textInput = document.getElementById('editTemplateText');
    if (!idInput || !catInput || !catLabel || !nameInput || !textInput) return;
    idInput.value = tpl.id;
    catInput.value = tpl.category;
    catLabel.textContent = tpl.category === 'role' ? 'Rol/Perspectiva' : tpl.category === 'tone' ? 'Tono/Estilo' : 'Restricciones/Limitaciones';
    nameInput.value = tpl.name || '';
    textInput.value = tpl.text || '';
    openModal('editTemplateModal');
}

/* MIGRATED: use templates.js */
function openPreviewTemplateModal(tpl) {
    const catDiv = document.getElementById('previewTemplateCategory');
    const nameDiv = document.getElementById('previewTemplateName');
    const textDiv = document.getElementById('previewTemplateText');
    const applyBtn = document.getElementById('previewApplyBtn');
    const goBtn = document.getElementById('previewGoTemplatesBtn');
    if (!catDiv || !nameDiv || !textDiv || !applyBtn || !goBtn) return;
    const catLabel = tpl.category === 'role' ? 'Rol/Perspectiva' : tpl.category === 'tone' ? 'Tono/Estilo' : 'Restricciones/Limitaciones';
    catDiv.textContent = catLabel;
    nameDiv.textContent = tpl.name || '(sin nombre)';
    textDiv.textContent = tpl.text || '';
    applyBtn.onclick = () => { applyTemplateToForm(tpl); closeModal('previewTemplateModal'); };
    goBtn.onclick = () => { closeModal('previewTemplateModal'); showSection('templatesSection'); };
    openModal('previewTemplateModal');
}

/* MIGRATED: use templates.js */
function extractTemplatesFromDataset(dataset) {
    if (!Array.isArray(dataset)) return { role: 0, tone: 0, constraint: 0 };
    const counters = { role: {}, tone: {}, constraint: {} };
    const add = (cat, text) => {
        const clean = (text || '').trim();
        if (!clean) return;
        const key = normalizeTextForKey(clean);
        counters[cat][key] = counters[cat][key] ? { text: clean, count: counters[cat][key].count + 1 } : { text: clean, count: 1 };
    };
    dataset.forEach(p => {
        if (!p || typeof p !== 'object') return;
        add('role', p.rol || p.role || '');
        add('tone', p.tono || p.tone || '');
        add('constraint', p.restricciones || p.constraints || '');
    });
    const summary = { role: 0, tone: 0, constraint: 0 };
    ['role','tone','constraint'].forEach(cat => {
        const entries = Object.values(counters[cat]);
        // Orden por frecuencia desc, luego por longitud asc
        entries.sort((a, b) => b.count - a.count || a.text.length - b.text.length);
        entries.forEach(({ text }) => {
            if (!templateExists(cat, text)) {
                const ok = addTemplate(cat, '', text);
                if (ok) summary[cat]++;
            }
        });
    });
    return summary;
}

/* MIGRATED: use templates.js */
async function maybeBootstrapTemplatesFromBundledJson() {
    if (templates.length > 0) return;
    // Intentar cargar un JSON exportado incluido junto a la app
    const candidate = 'prompts_ai_export_all_2025-07-30.json';
    try {
        const resp = await fetch(candidate, { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json();
        const summary = extractTemplatesFromDataset(Array.isArray(data) ? data : []);
        if (summary.role + summary.tone + summary.constraint > 0) {
            renderTemplates();
            showToast(`Plantillas iniciales: ${summary.role} roles, ${summary.tone} tonos, ${summary.constraint} restricciones.`, 'success');
        }
    } catch (_) {
        // Silencio: puede fallar en file:// o si no existe el archivo
    }
}

// --- GESTIÓN DE MUNICIPIOS ---

function initMunicipios() {
    const savedMunicipios = localStorage.getItem(MUNICIPIOS_KEY);
    municipios = savedMunicipios ? JSON.parse(savedMunicipios) : [...MUNICIPIOS_DEFAULT];
    updateMunicipiosSelects();
}

function updateMunicipiosSelects() {
    // Actualizar select del formulario
    const promptMunicipioInput = document.getElementById('promptMunicipio');
    if (promptMunicipioInput) {
        const currentValue = promptMunicipioInput.value;
        promptMunicipioInput.innerHTML = '<option value="">Selecciona un municipio</option>';
        municipios.forEach(municipio => {
            const option = document.createElement('option');
            option.value = municipio;
            option.textContent = municipio;
            promptMunicipioInput.appendChild(option);
        });
        if (municipios.includes(currentValue)) {
            promptMunicipioInput.value = currentValue;
        }
    }

    // Actualizar select del filtro
    const filterMunicipio = document.getElementById('filterMunicipio');
    if (filterMunicipio) {
        const currentValue = filterMunicipio.value;
        filterMunicipio.innerHTML = '<option value="">Todos los municipios</option>';
        municipios.forEach(municipio => {
            const option = document.createElement('option');
            option.value = municipio;
            option.textContent = municipio;
            filterMunicipio.appendChild(option);
        });
        if (municipios.includes(currentValue)) {
            filterMunicipio.value = currentValue;
        }
    }
}

function addMunicipio() {
    const newMunicipioInput = document.getElementById('newMunicipioInput');
    const nombre = newMunicipioInput.value.trim().toUpperCase();
    if (!nombre) {
        showToast('Por favor, introduce un nombre para el municipio.', 'error');
        return;
    }
    
    if (municipios.includes(nombre)) {
        showToast('Este municipio ya existe.', 'error');
        return;
    }
    
    municipios.push(nombre);
    municipios.sort();
    localStorage.setItem(MUNICIPIOS_KEY, JSON.stringify(municipios));
    updateMunicipiosSelects();
    renderManageMunicipios();
    newMunicipioInput.value = '';
    showToast(`Municipio "${nombre}" agregado correctamente.`, 'success');
}

function deleteMunicipio(municipio) {
    if (!confirm(`¿Estás seguro de eliminar el municipio "${municipio}"? Se quitará de todos los prompts donde se use.`)) {
        return;
    }
    
    // Remover de prompts existentes
    prompts.forEach(prompt => {
        if (prompt.municipio === municipio) {
            prompt.municipio = '';
            prompt.fechaModificacion = new Date().toISOString();
        }
    });
    
    // Remover de la lista
    municipios = municipios.filter(m => m !== municipio);
    localStorage.setItem(MUNICIPIOS_KEY, JSON.stringify(municipios));
    updateMunicipiosSelects();
    renderManageMunicipios();
    savePrompts();
    showToast(`Municipio "${municipio}" eliminado.`, 'info');
}

function renderManageMunicipios() {
    const manageMunicipiosList = document.getElementById('manageMunicipiosList');
    if (!manageMunicipiosList) return;
    
    manageMunicipiosList.innerHTML = '';
    if (municipios.length === 0) {
        manageMunicipiosList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: var(--spacing-lg);">No hay municipios definidos.</p>';
        return;
    }
    
    municipios.forEach((municipio, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center';
        itemDiv.style.cssText = `
            padding: var(--spacing-md);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-md);
            background: var(--bg-card);
            margin-bottom: var(--spacing-sm);
            transition: var(--transition-all);
        `;
        
        itemDiv.innerHTML = `
            <span style="font-weight: 500;">${escapeHTML(municipio)}</span>
            <div class="flex gap-sm">
                <button onclick="openEditTagCatModal('${escapeHTML(municipio)}', false, true)" class="btn btn-icon btn-sm" title="Renombrar Municipio">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteMunicipio('${escapeHTML(municipio)}')" class="btn btn-icon btn-sm" title="Eliminar Municipio" style="color: #f56565;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        
        manageMunicipiosList.appendChild(itemDiv);
    });
}

// --- AUTO-RESIZE PARA TEXTAREAS ---

/* MIGRATED: use ui.js */
function setupAutoResize() {
    const textareas = document.querySelectorAll('.auto-resize');
    const resize = (el) => {
        // Optimizar: limitar repaints y evitar bloquear con textos largos
        el.style.height = 'auto';
        const newHeight = Math.min(600, el.scrollHeight); // limite 600px por rendimiento
        el.style.height = newHeight + 'px';
        // Si excede, activar scroll interno
        if (el.scrollHeight > 600) {
            el.style.overflowY = 'auto';
        } else {
            el.style.overflowY = 'hidden';
        }
    };
    let rafId = null;
    textareas.forEach(textarea => {
        const onInput = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => resize(textarea));
        };
        textarea.addEventListener('input', onInput, { passive: true });
        // Trigger inicial
        resize(textarea);
    });
}

// --- GESTIÓN DE PROMPTS ---

function loadPrompts() {
    const storedPrompts = localStorage.getItem(LOCAL_STORAGE_KEY);
    try {
        prompts = storedPrompts ? JSON.parse(storedPrompts) : [];
        
        // Migrar prompts antiguos para incluir campo municipio
        prompts = prompts.map(p => ({
            id: p.id || `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nombre: p.nombre || "Prompt sin nombre",
            categoria: p.categoria || "",
            tags: Array.isArray(p.tags) ? p.tags : [],
            municipio: p.municipio || "", // Campo nuevo para compatibilidad
            rating: typeof p.rating === 'number' ? p.rating : 0,
            isFavorite: typeof p.isFavorite === 'boolean' ? p.isFavorite : false,
            usageCount: typeof p.usageCount === 'number' ? p.usageCount : 0,
            fechaCreacion: p.fechaCreacion || new Date().toISOString(),
            fechaModificacion: p.fechaModificacion || new Date().toISOString(),
            rol: p.rol || "",
            contexto: p.contexto || "",
            tarea: p.tarea || "",
            formato: p.formato || "",
            tono: p.tono || "",
            restricciones: p.restricciones || "",
            ejemplo: p.ejemplo || "",
            promptFinal: p.promptFinal || "",
            variations: Array.isArray(p.variations) ? p.variations : [],
            notas: p.notas || ""
        }));
        
    } catch (e) {
        console.error("Error parsing prompts from localStorage:", e);
        prompts = [];
        showToast('Error al cargar los prompts. Se ha creado una nueva biblioteca.', 'error');
    }
}

function savePrompts() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prompts));
    } catch (e) {
        console.error("Error saving prompts to localStorage:", e);
        showToast("Error al guardar los prompts. El almacenamiento podría estar lleno.", "error");
    }
}

// --- GESTIÓN DE FILTROS ---

/* MIGRATED: use ui.js */
function getFilteredPrompts() {
    const searchLibraryInput = document.getElementById('searchLibraryInput');
    const filterFavorite = document.getElementById('filterFavorite');
    const filterCategory = document.getElementById('filterCategory');
    const filterTag = document.getElementById('filterTag');
    const filterMunicipio = document.getElementById('filterMunicipio');
    
    if (!searchLibraryInput) return prompts;
    
    const searchTerm = searchLibraryInput.value.toLowerCase().trim();
    const showOnlyFavorites = filterFavorite?.checked || false;
    const selectedCategory = filterCategory?.value || '';
    const selectedTag = filterTag?.value || '';
    const selectedMunicipio = filterMunicipio?.value || '';

    return prompts.filter(prompt => {
        if (showOnlyFavorites && !prompt.isFavorite) return false;
        if (selectedCategory && prompt.categoria !== selectedCategory) return false;
        if (selectedTag && !(prompt.tags || []).includes(selectedTag)) return false;
        if (selectedMunicipio && prompt.municipio !== selectedMunicipio) return false;
        
        if (searchTerm) {
            const nameMatch = (prompt.nombre || '').toLowerCase().includes(searchTerm);
            const categoryMatch = (prompt.categoria || '').toLowerCase().includes(searchTerm);
            const tagsMatch = (prompt.tags || []).some(tag => tag.toLowerCase().includes(searchTerm));
            const municipioMatch = (prompt.municipio || '').toLowerCase().includes(searchTerm);
            const contentMatch = (
                (prompt.rol || '').toLowerCase().includes(searchTerm) ||
                (prompt.contexto || '').toLowerCase().includes(searchTerm) ||
                (prompt.tarea || '').toLowerCase().includes(searchTerm) ||
                (prompt.promptFinal || '').toLowerCase().includes(searchTerm) ||
                (prompt.notas || '').toLowerCase().includes(searchTerm)
            );
            if (!(nameMatch || categoryMatch || tagsMatch || municipioMatch || contentMatch)) {
                return false;
            }
        }
        
        return true;
    });
}

/* MIGRATED: use ui.js */
function updateFilterOptions() {
    updateCategoryFilter();
    updateTagFilter();
}

/* MIGRATED: use ui.js */
function updateCategoryFilter() {
    const filterCategory = document.getElementById('filterCategory');
    if (!filterCategory) return;
    
    const categories = new Set();
    prompts.forEach(p => {
        if (p.categoria) categories.add(p.categoria);
    });
    
    const originalValue = filterCategory.value;
    filterCategory.innerHTML = '<option value="">Todas las categorías</option>';
    
    [...categories].sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        filterCategory.appendChild(option);
    });
    
    if ([...filterCategory.options].some(opt => opt.value === originalValue)) {
        filterCategory.value = originalValue;
    }
}

/* MIGRATED: use ui.js */
function updateTagFilter() {
    const filterCategory = document.getElementById('filterCategory');
    const filterTag = document.getElementById('filterTag');
    if (!filterCategory || !filterTag) return;
    
    const selectedCategory = filterCategory.value;
    const tags = new Set();
    
    if (selectedCategory) {
        prompts.filter(p => p.categoria === selectedCategory)
               .forEach(p => (p.tags || []).forEach(tag => tags.add(tag)));
    }
    
    const originalValue = filterTag.value;
    filterTag.innerHTML = '';
    
    if (!selectedCategory) {
        filterTag.innerHTML = '<option value="">Selecciona una categoría primero</option>';
        filterTag.disabled = true;
        return;
    }
    
    const sortedTags = [...tags].sort();
    filterTag.disabled = sortedTags.length === 0;
    
    if (sortedTags.length === 0) {
        filterTag.innerHTML = '<option value="">No hay etiquetas en esta categoría</option>';
    } else {
        filterTag.innerHTML = '<option value="">Todas las etiquetas de esta categoría</option>';
        sortedTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            filterTag.appendChild(option);
        });
    }
    
    if ([...filterTag.options].some(opt => opt.value === originalValue)) {
        filterTag.value = originalValue;
    } else {
        filterTag.value = "";
    }
}

// --- RENDERIZADO DE BIBLIOTECA ---

/* MIGRATED: use ui.js */
function renderLibrary(page = 1) {
    const libraryList = document.getElementById('libraryList');
    if (!libraryList) return;
    
    currentPage = page;
    
    // Mostrar spinner
    libraryList.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: var(--spacing-xl);"><div class="spinner"></div></div>';
    
    setTimeout(() => {
        libraryList.innerHTML = '';
        selectedPromptIds.clear();
        
        const filteredPrompts = getFilteredPrompts();
        
        if (filteredPrompts.length === 0) {
            const searchLibraryInput = document.getElementById('searchLibraryInput');
            const filterFavorite = document.getElementById('filterFavorite');
            const filterCategory = document.getElementById('filterCategory');
            const filterTag = document.getElementById('filterTag');
            
            const hasFilters = (searchLibraryInput?.value || filterFavorite?.checked || filterCategory?.value || filterTag?.value);
            const message = hasFilters
                ? 'No hay prompts que coincidan con los filtros aplicados.'
                : 'No has guardado ningún prompt todavía. ¡Crea uno nuevo!';
            
            libraryList.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: var(--spacing-2xl); color: var(--text-muted);">
                    <i class="fas fa-search" style="font-size: 3rem; margin-bottom: var(--spacing-md); opacity: 0.5;"></i>
                    <p style="font-size: 1.125rem; margin: 0;">${message}</p>
                </div>
            `;
            renderPagination(0, 1, 0);
            return;
        }
        
        // Aplicar ordenación
        const sortLibrarySelect = document.getElementById('sortLibrarySelect');
        const sortValue = sortLibrarySelect?.value || 'date_desc';
        let sortedPrompts = [...filteredPrompts];
        
        switch (sortValue) {
            case 'date_asc':
                sortedPrompts.sort((a, b) => new Date(a.fechaModificacion) - new Date(b.fechaModificacion));
                break;
            case 'rating_desc':
                sortedPrompts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            case 'rating_asc':
                sortedPrompts.sort((a, b) => (a.rating || 0) - (b.rating || 0));
                break;
            case 'name_asc':
                sortedPrompts.sort((a, b) => (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase()));
                break;
            case 'name_desc':
                sortedPrompts.sort((a, b) => (b.nombre || '').toLowerCase().localeCompare((a.nombre || '').toLowerCase()));
                break;
            case 'date_desc':
            default:
                sortedPrompts.sort((a, b) => new Date(b.fechaModificacion) - new Date(a.fechaModificacion));
                break;
        }
        
        // Paginación
        const totalPages = Math.ceil(sortedPrompts.length / promptsPerPage);
        if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        
        const startIndex = (currentPage - 1) * promptsPerPage;
        const endIndex = startIndex + promptsPerPage;
        const promptsToRender = sortedPrompts.slice(startIndex, endIndex);
        
        // Renderizar prompts
        promptsToRender.forEach((prompt, index) => {
            const card = createPromptCard(prompt, index);
            libraryList.appendChild(card);
        });
        
        renderPagination(totalPages, currentPage, sortedPrompts.length);
        updateExportSelectedButton();
        
    }, 200);
}

/* MIGRATED: use ui.js */
function createPromptCard(prompt, index) {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.dataset.promptId = prompt.id;
    
    // Agregar animación mejorada
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'all 0.3s ease-out';
    setTimeout(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, Math.min(50 + (index * 100), 1000)); // Limitar el delay máximo
    
    // Crear contenido de la tarjeta
    const tagsHtml = (prompt.tags || []).length > 0
        ? prompt.tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('')
        : '<span style="color: var(--text-muted); font-style: italic;">Sin etiquetas</span>';
    
    const starsHtml = Array.from({length: 5}, (_, i) => {
        const filled = i < (prompt.rating || 0);
        return `<i class="fa-solid fa-star" style="color: ${filled ? 'var(--accent)' : 'var(--border-medium)'}; font-size: 0.875rem;"></i>`;
    }).join('');
    
    card.innerHTML = `
        <div class="prompt-card-header">
            <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-xs);">
                    <input type="checkbox" class="prompt-select-checkbox" data-prompt-id="${prompt.id}" onchange="handlePromptSelection(this)" style="margin: 0;">
                    <h3 class="prompt-card-title" style="margin: 0; flex: 1; min-width: 0;">${escapeHTML(prompt.nombre)}</h3>
                    <i class="favorite-toggle fas fa-heart ${prompt.isFavorite ? 'active' : ''}" 
                       onclick="toggleFavorite('${prompt.id}', event)" 
                       title="${prompt.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}"
                       style="color: ${prompt.isFavorite ? '#ef4444' : 'var(--text-muted)'}; cursor: pointer; font-size: 1.125rem;"></i>
                </div>
                <div class="rating" style="margin-bottom: var(--spacing-sm);">${starsHtml}</div>
            </div>
        </div>
        
        <div class="prompt-card-meta">
            ${prompt.categoria ? `<span><i class="fas fa-folder" style="margin-right: 4px;"></i>${escapeHTML(prompt.categoria)}</span>` : ''}
            ${prompt.municipio ? `<span><i class="fas fa-map-marker-alt" style="margin-right: 4px;"></i>${escapeHTML(prompt.municipio)}</span>` : ''}
            <span><i class="fas fa-calendar" style="margin-right: 4px;"></i>${formatDate(prompt.fechaModificacion)}</span>
            <span><i class="fas fa-copy" style="margin-right: 4px;"></i>Usado ${prompt.usageCount || 0} veces</span>
        </div>
        
        <div style="margin: var(--spacing-md) 0;">
            <div style="margin-bottom: var(--spacing-sm);">
                <strong style="color: var(--text-secondary); font-size: 0.875rem;">Etiquetas:</strong>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-xs);">
                ${tagsHtml}
            </div>
        </div>
        
        ${prompt.promptFinal ? `
            <div style="margin: var(--spacing-md) 0;">
                <div style="background: var(--bg-secondary); padding: var(--spacing-sm); border-radius: var(--radius-sm); font-size: 0.875rem; color: var(--text-secondary); max-height: 60px; overflow: hidden; position: relative;">
                    ${escapeHTML(prompt.promptFinal.substring(0, 150))}${prompt.promptFinal.length > 150 ? '...' : ''}
                </div>
            </div>
        ` : ''}
        
        <div class="prompt-card-actions">
            <button onclick="viewPrompt('${prompt.id}')" class="btn btn-primary btn-sm">
                <i class="fas fa-edit"></i> Editar
            </button>
            <button onclick="openPreviewPromptModal('${prompt.id}')" class="btn btn-secondary btn-sm">
                <i class="fas fa-eye"></i> Previsualizar
            </button>
            <button onclick="duplicatePrompt('${prompt.id}')" class="btn btn-warning btn-sm">
                <i class="fas fa-clone"></i> Duplicar
            </button>
            <button onclick="openDeleteModal('${prompt.id}')" class="btn btn-danger btn-sm">
                <i class="fas fa-trash-alt"></i> Eliminar
            </button>
        </div>
    `;
    
    return card;
}

function openPreviewPromptModal(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;

    const title = document.getElementById('previewPromptTitle');
    const meta = document.getElementById('previewPromptMeta');
    const content = document.getElementById('previewPromptContent');
    const copyBtn = document.getElementById('previewPromptCopyBtn');
    const fillBtn = document.getElementById('previewPromptFillBtn');
    const editBtn = document.getElementById('previewPromptEditBtn');

    if (title) title.textContent = prompt.nombre || 'Prompt sin nombre';
    if (meta) {
        const parts = [];
        if (prompt.categoria) parts.push(`<i class='fas fa-folder'></i> ${escapeHTML(prompt.categoria)}`);
        if ((prompt.tags || []).length) parts.push(`<i class='fas fa-tags'></i> ${escapeHTML(prompt.tags.join(', '))}`);
        if (prompt.municipio) parts.push(`<i class='fas fa-map-marker-alt'></i> ${escapeHTML(prompt.municipio)}`);
        parts.push(`<i class='fas fa-star'></i> ${prompt.rating || 0}/5`);
        parts.push(`<i class='fas fa-copy'></i> Usado ${prompt.usageCount || 0} veces`);
        meta.innerHTML = parts.join(' • ');
    }
    if (content) {
        const full = prompt.promptFinal || generateFinalPromptFromObject(prompt);
        content.textContent = full || '';
    }
    if (copyBtn) copyBtn.onclick = () => copyFinalPromptWrapper(id);
    if (fillBtn) fillBtn.onclick = () => openPlaceholderModal(prompt.promptFinal || '', id);
    if (editBtn) editBtn.onclick = () => { closeModal('previewPromptModal'); viewPrompt(id); };

    openModal('previewPromptModal');
}

function generateFinalPromptFromObject(p) {
    const elements = {
        role: p.rol || '',
        context: p.contexto || '',
        task: p.tarea || '',
        format: p.formato || '',
        tone: p.tono || '',
        constraints: p.restricciones || '',
        example: p.ejemplo || ''
    };
    let promptText = '';
    if (elements.role) promptText += `${elements.role}\n\n`;
    if (elements.context) promptText += `Contexto: ${elements.context}\n\n`;
    if (elements.task) promptText += `Tarea: ${elements.task}\n\n`;
    if (elements.format) promptText += `Formato de salida: ${elements.format}\n`;
    if (elements.tone) promptText += `Tono: ${elements.tone}\n`;
    if (elements.constraints) promptText += `Restricciones: ${elements.constraints}\n`;
    if (elements.example) promptText += `Ejemplo: ${elements.example}\n`;
    return promptText.trim();
}

function renderPagination(totalPages, currentPage, totalItems) {
    const paginationContainer = document.getElementById('libraryPagination');
    if (!paginationContainer) {
        console.error('No se encontró el contenedor de paginación');
        return;
    }
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = totalItems > 0 ? 
            `<div class="pagination-info" style="text-align: center; color: var(--text-muted);">Mostrando todos los ${totalItems} prompts</div>` : '';
        return;
    }
    
    let paginationHTML = `
        <button class="pagination-btn" onclick="renderLibrary(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} title="Página anterior">
            <i class="fas fa-chevron-left"></i>
        </button>
        
        <button class="pagination-btn" onclick="renderLibrary(1)" ${currentPage === 1 ? 'disabled' : ''} title="Primera página">
            <i class="fas fa-angle-double-left"></i>
        </button>
    `;
    
    // Mostrar páginas cercanas
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        paginationHTML += `<span class="pagination-info">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="renderLibrary(${i})" title="Página ${i}">
                ${i}
            </button>
        `;
    }
    
    if (endPage < totalPages) {
        paginationHTML += `<span class="pagination-info">...</span>`;
    }
    
    paginationHTML += `
        <button class="pagination-btn" onclick="renderLibrary(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''} title="Última página">
            <i class="fas fa-angle-double-right"></i>
        </button>
        
        <button class="pagination-btn" onclick="renderLibrary(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} title="Página siguiente">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    paginationHTML += `<div class="pagination-info" style="margin-left: auto;">Página ${currentPage} de ${totalPages} (${totalItems} prompts)</div>`;
    
    paginationContainer.innerHTML = paginationHTML;
}

// --- GESTIÓN DEL FORMULARIO ---

/* MIGRATED: use prompts.js */
function clearForm() {
    const form = document.getElementById('promptBuilderForm');
    if (form) form.reset();
    
    const elements = {
        promptId: document.getElementById('promptId'),
        promptRatingValue: document.getElementById('promptRatingValue'),
        promptFavoriteCheckbox: document.getElementById('promptFavorite'),
        promptFavoriteIcon: document.getElementById('promptFavoriteIcon'),
        promptFinalDisplay: document.getElementById('promptFinalDisplay'),
        variationsList: document.getElementById('variationsList'),
        formMetaInfo: document.getElementById('form-meta-info'),
        savePromptBtn: document.getElementById('savePromptBtn'),
        autosaveStatus: document.getElementById('autosave-status')
    };
    
    if (elements.promptId) elements.promptId.value = '';
    if (elements.promptRatingValue) elements.promptRatingValue.value = '0';
    if (elements.promptFavoriteCheckbox) elements.promptFavoriteCheckbox.checked = false;
    if (elements.promptFavoriteIcon) {
        elements.promptFavoriteIcon.className = 'fa-regular fa-heart favorite-toggle';
        elements.promptFavoriteIcon.style.color = 'var(--text-muted)';
    }
    if (elements.promptFinalDisplay) {
        elements.promptFinalDisplay.innerHTML = 'El prompt generado aparecerá aquí...';
    }
    if (elements.variationsList) elements.variationsList.innerHTML = '';
    if (elements.formMetaInfo) elements.formMetaInfo.classList.add('hidden');
    if (elements.savePromptBtn) {
        elements.savePromptBtn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar en Biblioteca';
    }
    if (elements.autosaveStatus) elements.autosaveStatus.innerHTML = '';
    
    // Reset rating stars
    setupRating(0);
    
    clearAutosave();
}

/* MIGRATED: use prompts.js */
function generateFinalPrompt() {
    const elements = {
        role: document.getElementById('promptRole')?.value || '',
        context: document.getElementById('promptContext')?.value || '',
        task: document.getElementById('promptTask')?.value || '',
        format: document.getElementById('promptFormat')?.value || '',
        tone: document.getElementById('promptTone')?.value || '',
        constraints: document.getElementById('promptConstraints')?.value || '',
        example: document.getElementById('promptExample')?.value || ''
    };

    let promptText = "";
    if (elements.role) promptText += `${elements.role}\n\n`;
    if (elements.context) promptText += `Contexto: ${elements.context}\n\n`;
    if (elements.task) promptText += `Tarea: ${elements.task}\n\n`;
    if (elements.format) promptText += `Formato de salida: ${elements.format}\n`;
    if (elements.tone) promptText += `Tono: ${elements.tone}\n`;
    if (elements.constraints) promptText += `Restricciones: ${elements.constraints}\n`;
    if (elements.example) promptText += `Ejemplo: ${elements.example}\n`;

    return promptText.trim();
}

/* MIGRATED: use prompts.js */
function generateFinalPromptUI() {
    const finalPrompt = generateFinalPrompt();
    const promptFinalDisplay = document.getElementById('promptFinalDisplay');
    if (promptFinalDisplay) {
        promptFinalDisplay.innerHTML = escapeHTML(finalPrompt);
    }
}

function setupRating(rating = 0) {
    const ratingContainer = document.getElementById('promptRating');
    const ratingValue = document.getElementById('promptRatingValue');
    
    if (!ratingContainer || !ratingValue) return;
    
    ratingValue.value = rating;
    
    const stars = ratingContainer.querySelectorAll('.fa-star');
    stars.forEach((star, index) => {
        star.classList.toggle('selected', index < rating);
        star.style.color = index < rating ? '#fbbf24' : 'var(--border-medium)';
    });
}

// --- NAVEGACIÓN ---

function showSection(sectionId) {
    console.log('Cambiando a sección:', sectionId);
    
    // Ocultar todas las secciones con animación
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    
    // Mostrar la sección seleccionada con animación
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        // Pequeño delay para permitir que el display se aplique antes de la animación
        setTimeout(() => {
            targetSection.classList.add('active');
        }, 10);
    }
    
    // Actualizar pestañas
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const activeTab = document.querySelector(`[data-section="${sectionId}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Acciones específicas por sección
    setTimeout(() => {
        if (sectionId === 'manageTagsCategoriesSection') {
            renderManageTagsCategories();
        } else if (sectionId === 'promptLibrarySection') {
            renderLibrary(currentPage);
        } else if (sectionId === 'exampleGuideSection') {
            // Asegurar que el acordeón esté configurado
            setupAccordion();
        } else if (sectionId === 'templatesSection') {
            renderTemplates();
        }
    }, 100);
}

// --- GESTIÓN DE ETIQUETAS Y CATEGORÍAS ---

function renderManageTagsCategories() {
    renderManageTags();
    renderManageCategories();
    renderManageMunicipios();
}

function renderManageTags() {
    const manageTagsList = document.getElementById('manageTagsList');
    if (!manageTagsList) {
        console.error('No se encontró el elemento manageTagsList');
        return;
    }
    
    const tags = new Set();
    prompts.forEach(p => {
        if (p.tags && Array.isArray(p.tags)) {
            p.tags.forEach(tag => {
                if (tag && tag.trim()) {
                    tags.add(tag.trim());
                }
            });
        }
    });
    const allTags = [...tags].sort();
    
    console.log('Etiquetas encontradas:', allTags);
    
    if (allTags.length === 0) {
        manageTagsList.innerHTML = '<div class="card" style="text-align: center; padding: var(--spacing-lg);"><p style="color: var(--text-muted);">No hay etiquetas definidas.</p><p style="color: var(--text-muted); font-size: 0.875rem;">Las etiquetas aparecerán aquí cuando crees prompts con etiquetas.</p></div>';
        return;
    }
    
    manageTagsList.innerHTML = '';
    allTags.forEach(tag => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center';
        itemDiv.style.cssText = `
            padding: var(--spacing-md);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-md);
            background: var(--bg-card);
            margin-bottom: var(--spacing-sm);
            transition: var(--transition-all);
        `;
        
        itemDiv.innerHTML = `
            <span style="font-weight: 500;">${escapeHTML(tag)}</span>
            <button onclick="openEditTagCatModal('${escapeHTML(tag)}', false, false)" class="btn btn-icon btn-sm" title="Renombrar Etiqueta">
                <i class="fas fa-edit"></i>
            </button>
        `;
        
        manageTagsList.appendChild(itemDiv);
    });
}

function renderManageCategories() {
    const manageCategoriesList = document.getElementById('manageCategoriesList');
    if (!manageCategoriesList) {
        console.error('No se encontró el elemento manageCategoriesList');
        return;
    }
    
    const categories = new Set();
    prompts.forEach(p => {
        if (p.categoria && p.categoria.trim()) {
            categories.add(p.categoria.trim());
        }
    });
    const allCategories = [...categories].sort();
    
    console.log('Categorías encontradas:', allCategories);
    
    if (allCategories.length === 0) {
        manageCategoriesList.innerHTML = '<div class="card" style="text-align: center; padding: var(--spacing-lg);"><p style="color: var(--text-muted);">No hay categorías definidas.</p><p style="color: var(--text-muted); font-size: 0.875rem;">Las categorías aparecerán aquí cuando crees prompts con categorías.</p></div>';
        return;
    }
    
    manageCategoriesList.innerHTML = '';
    allCategories.forEach(category => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center';
        itemDiv.style.cssText = `
            padding: var(--spacing-md);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-md);
            background: var(--bg-card);
            margin-bottom: var(--spacing-sm);
            transition: var(--transition-all);
        `;
        
        itemDiv.innerHTML = `
            <span style="font-weight: 500;">${escapeHTML(category)}</span>
            <button onclick="openEditTagCatModal('${escapeHTML(category)}', true, false)" class="btn btn-icon btn-sm" title="Renombrar Categoría">
                <i class="fas fa-edit"></i>
            </button>
        `;
        
        manageCategoriesList.appendChild(itemDiv);
    });
}

// --- MODALES ---

/* MIGRATED: use ui.js */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
}

/* MIGRATED: use ui.js */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// --- FUNCIONES DE PROMPTS ---

/* MIGRATED: use prompts.js */
function viewPrompt(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;
    
    populateForm(prompt);
    showSection('createPromptSection');
}

/* MIGRATED: use prompts.js */
function populateForm(prompt) {
    const elements = {
        promptId: document.getElementById('promptId'),
        promptName: document.getElementById('promptName'),
        promptCategory: document.getElementById('promptCategory'),
        promptTags: document.getElementById('promptTags'),
        promptMunicipio: document.getElementById('promptMunicipio'),
        promptFavorite: document.getElementById('promptFavorite'),
        promptFavoriteIcon: document.getElementById('promptFavoriteIcon'),
        promptRole: document.getElementById('promptRole'),
        promptContext: document.getElementById('promptContext'),
        promptTask: document.getElementById('promptTask'),
        promptFormat: document.getElementById('promptFormat'),
        promptTone: document.getElementById('promptTone'),
        promptConstraints: document.getElementById('promptConstraints'),
        promptExample: document.getElementById('promptExample'),
        promptNotes: document.getElementById('promptNotes'),
        promptFinalDisplay: document.getElementById('promptFinalDisplay'),
        promptIdDisplay: document.getElementById('promptIdDisplay'),
        promptCreatedDate: document.getElementById('promptCreatedDate'),
        promptModifiedDate: document.getElementById('promptModifiedDate'),
        promptUsageCount: document.getElementById('promptUsageCount'),
        formMetaInfo: document.getElementById('form-meta-info'),
        savePromptBtn: document.getElementById('savePromptBtn')
    };
    
    if (elements.promptId) elements.promptId.value = prompt.id;
    if (elements.promptName) elements.promptName.value = prompt.nombre || '';
    if (elements.promptCategory) elements.promptCategory.value = prompt.categoria || '';
    if (elements.promptTags) elements.promptTags.value = (prompt.tags || []).join(', ');
    if (elements.promptMunicipio) elements.promptMunicipio.value = prompt.municipio || '';
    if (elements.promptFavorite) elements.promptFavorite.checked = prompt.isFavorite || false;
    if (elements.promptFavoriteIcon) {
        elements.promptFavoriteIcon.className = prompt.isFavorite ? 'fa-solid fa-heart favorite-toggle active' : 'fa-regular fa-heart favorite-toggle';
        elements.promptFavoriteIcon.style.color = prompt.isFavorite ? '#ef4444' : 'var(--text-muted)';
    }
    if (elements.promptRole) elements.promptRole.value = prompt.rol || '';
    if (elements.promptContext) elements.promptContext.value = prompt.contexto || '';
    if (elements.promptTask) elements.promptTask.value = prompt.tarea || '';
    if (elements.promptFormat) elements.promptFormat.value = prompt.formato || '';
    if (elements.promptTone) elements.promptTone.value = prompt.tono || '';
    if (elements.promptConstraints) elements.promptConstraints.value = prompt.restricciones || '';
    if (elements.promptExample) elements.promptExample.value = prompt.ejemplo || '';
    if (elements.promptNotes) elements.promptNotes.value = prompt.notas || '';
    if (elements.promptFinalDisplay) elements.promptFinalDisplay.innerHTML = escapeHTML(prompt.promptFinal || '');
    
    if (elements.promptIdDisplay) elements.promptIdDisplay.textContent = prompt.id;
    if (elements.promptCreatedDate) elements.promptCreatedDate.textContent = formatDate(prompt.fechaCreacion);
    if (elements.promptModifiedDate) elements.promptModifiedDate.textContent = formatDate(prompt.fechaModificacion);
    if (elements.promptUsageCount) elements.promptUsageCount.textContent = prompt.usageCount || 0;
    if (elements.formMetaInfo) elements.formMetaInfo.classList.remove('hidden');
    if (elements.savePromptBtn) {
        elements.savePromptBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Actualizar Prompt';
    }
    
    setupRating(prompt.rating || 0);
    renderVariations(prompt.variations || []);
}

/* MIGRATED: use prompts.js */
function openDeleteModal(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;
    
    const deletePromptNameSpan = document.getElementById('deletePromptName');
    if (deletePromptNameSpan) {
        deletePromptNameSpan.textContent = prompt.nombre;
        deletePromptNameSpan.dataset.promptId = id;
    }
    openModal('deleteConfirmModal');
}

/* MIGRATED: use prompts.js */
function confirmDelete() {
    const deletePromptNameSpan = document.getElementById('deletePromptName');
    if (!deletePromptNameSpan) return;
    
    const promptId = deletePromptNameSpan.dataset.promptId;
    const index = prompts.findIndex(p => p.id === promptId);
    
    if (index !== -1) {
        const promptName = prompts[index].nombre;
        prompts.splice(index, 1);
        savePrompts();
        renderLibrary(currentPage);
        updateFilterOptions();
        showToast(`Prompt "${promptName}" eliminado correctamente.`, 'success');
    }
    
    closeModal('deleteConfirmModal');
}

/* MIGRATED: use prompts.js */
function duplicatePrompt(id) {
    const originalPrompt = prompts.find(p => p.id === id);
    if (!originalPrompt) return;

    const newPrompt = JSON.parse(JSON.stringify(originalPrompt));
    newPrompt.id = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    newPrompt.nombre = `${originalPrompt.nombre} (Copia)`;
    const now = new Date().toISOString();
    newPrompt.fechaCreacion = now;
    newPrompt.fechaModificacion = now;
    newPrompt.usageCount = 0;

    prompts.push(newPrompt);
    savePrompts();
    renderLibrary(currentPage);
    updateFilterOptions();
    showToast(`Prompt duplicado como "${newPrompt.nombre}".`, 'success');
}

/* MIGRATED: use prompts.js */
function toggleFavorite(id, event) {
    event.stopPropagation();
    const index = prompts.findIndex(p => p.id === id);
    if (index > -1) {
        prompts[index].isFavorite = !prompts[index].isFavorite;
        prompts[index].fechaModificacion = new Date().toISOString();
        savePrompts();
        
        const icon = event.target;
        const isFavorite = prompts[index].isFavorite;
        // Use solid heart always to avoid Pro-only outline failures on some setups
        icon.className = isFavorite ? 'fa-solid fa-heart favorite-toggle active' : 'fa-solid fa-heart favorite-toggle';
        icon.style.color = isFavorite ? '#ef4444' : 'var(--text-muted)';
        icon.title = isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito';
        
        const filterFavorite = document.getElementById('filterFavorite');
        if (filterFavorite?.checked) {
            renderLibrary(currentPage);
        }
    }
}

// --- FUNCIONES DE VARIACIONES ---

/* MIGRATED: use prompts.js */
function renderVariations(variations) {
    const variationsList = document.getElementById('variationsList');
    if (!variationsList) return;
    
    if (!variations || variations.length === 0) {
        variationsList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: var(--spacing-md);">No hay variaciones guardadas.</p>';
        return;
    }
    
    variationsList.innerHTML = '';
    variations.forEach((variation, index) => {
        const variationDiv = document.createElement('div');
        variationDiv.className = 'flex justify-between items-center';
        variationDiv.style.cssText = `
            padding: var(--spacing-md);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-md);
            background: var(--bg-secondary);
            margin-bottom: var(--spacing-sm);
        `;
        
        variationDiv.innerHTML = `
            <span style="font-weight: 500; color: var(--primary-dark);">${escapeHTML(variation.name)}</span>
            <div class="flex gap-sm">
                <button type="button" onclick="loadVariation(${index})" class="btn btn-success btn-sm" title="Cargar esta variación">
                    <i class="fa-solid fa-check"></i>
                </button>
                <button type="button" onclick="copyVariationText(${index})" class="btn btn-info btn-sm" title="Copiar texto">
                    <i class="fa-solid fa-copy"></i>
                </button>
                <button type="button" onclick="deleteVariation(${index})" class="btn btn-danger btn-sm" title="Eliminar variación">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        
        variationsList.appendChild(variationDiv);
    });
}

/* MIGRATED: use prompts.js */
function addVariation() {
    const newVariationNameInput = document.getElementById('newVariationName');
    const promptIdInput = document.getElementById('promptId');
    const promptFinalDisplay = document.getElementById('promptFinalDisplay');
    
    if (!newVariationNameInput || !promptIdInput || !promptFinalDisplay) return;
    
    const name = newVariationNameInput.value.trim();
    const promptId = promptIdInput.value;
    const variationText = promptFinalDisplay.textContent.trim();
    
    if (!name) {
        showToast('Por favor, introduce un nombre para la variación.', 'error');
        return;
    }
    
    if (!promptId) {
        showToast('Guarda el prompt principal antes de añadir variaciones.', 'error');
        return;
    }
    
    if (!variationText) {
        showToast('El prompt final está vacío. Genera un prompt antes de guardarlo como variación.', 'error');
        return;
    }
    
    const promptIndex = prompts.findIndex(p => p.id === promptId);
    if (promptIndex > -1) {
        if (!prompts[promptIndex].variations) prompts[promptIndex].variations = [];
        
        // Verificar si ya existe una variación con ese nombre
        const existingIndex = prompts[promptIndex].variations.findIndex(v => v.name.toLowerCase() === name.toLowerCase());
        if (existingIndex > -1) {
            if (!confirm(`Ya existe una variación llamada "${name}". ¿Deseas sobrescribirla?`)) {
                return;
            }
            prompts[promptIndex].variations[existingIndex].promptFinal = variationText;
        } else {
            prompts[promptIndex].variations.push({ name: name, promptFinal: variationText });
        }
        
        prompts[promptIndex].fechaModificacion = new Date().toISOString();
        savePrompts();
        renderVariations(prompts[promptIndex].variations);
        newVariationNameInput.value = '';
        showToast(`Variación "${name}" guardada.`, 'success');
    }
}

/* MIGRATED: use prompts.js */
function loadVariation(index) {
    const promptIdInput = document.getElementById('promptId');
    const promptFinalDisplay = document.getElementById('promptFinalDisplay');
    
    if (!promptIdInput || !promptFinalDisplay) return;
    
    const promptId = promptIdInput.value;
    const promptIndex = prompts.findIndex(p => p.id === promptId);
    
    if (promptIndex > -1 && prompts[promptIndex].variations && prompts[promptIndex].variations[index]) {
        const variation = prompts[promptIndex].variations[index];
        promptFinalDisplay.innerHTML = escapeHTML(variation.promptFinal);
        showToast(`Variación "${variation.name}" cargada en el editor.`, 'info');
    }
}

/* MIGRATED: use prompts.js */
function copyVariationText(index) {
    const promptIdInput = document.getElementById('promptId');
    if (!promptIdInput) return;
    
    const promptId = promptIdInput.value;
    const promptIndex = prompts.findIndex(p => p.id === promptId);
    
    if (promptIndex > -1 && prompts[promptIndex].variations && prompts[promptIndex].variations[index]) {
        const variation = prompts[promptIndex].variations[index];
        copyToClipboard(variation.promptFinal, `Texto de la variación "${variation.name}" copiado.`);
    }
}

/* MIGRATED: use prompts.js */
function deleteVariation(index) {
    const promptIdInput = document.getElementById('promptId');
    if (!promptIdInput) return;
    
    const promptId = promptIdInput.value;
    const promptIndex = prompts.findIndex(p => p.id === promptId);
    
    if (promptIndex > -1 && prompts[promptIndex].variations && prompts[promptIndex].variations[index]) {
        const variationName = prompts[promptIndex].variations[index].name;
        if (confirm(`¿Estás seguro de eliminar la variación "${variationName}"?`)) {
            prompts[promptIndex].variations.splice(index, 1);
            prompts[promptIndex].fechaModificacion = new Date().toISOString();
            savePrompts();
            renderVariations(prompts[promptIndex].variations);
            showToast(`Variación "${variationName}" eliminada.`, 'info');
        }
    }
}

// --- FUNCIONES DE COPIA Y PLACEHOLDERS ---

/* MIGRATED: use prompts.js */
function copyFinalPromptWrapper(id) {
    let textToCopy;
    let promptIdForUsage = id;

    if (id) {
        const prompt = prompts.find(p => p.id === id);
        if (!prompt) {
            console.error(`Prompt con id ${id} no encontrado.`);
            return;
        }
        textToCopy = prompt.promptFinal || '';
        openPlaceholderModal(textToCopy, id);
    } else {
        const promptFinalDisplay = document.getElementById('promptFinalDisplay');
        const promptIdInput = document.getElementById('promptId');
        if (promptFinalDisplay) {
            textToCopy = promptFinalDisplay.textContent.trim();
            promptIdForUsage = promptIdInput?.value;
            openPlaceholderModal(textToCopy, promptIdForUsage);
        }
    }
}

/* MIGRATED: use prompts.js */
function detectPlaceholders(text) {
    const regex = /\[([^\]]+)\]/g;
    let match;
    const foundPlaceholders = new Set();
    while ((match = regex.exec(text)) !== null) {
        foundPlaceholders.add(match[1].trim());
    }
    return Array.from(foundPlaceholders);
}

/* MIGRATED: use prompts.js */
function openPlaceholderModal(text, promptId = null) {
    originalPlaceholderText = text;
    const placeholderModal = document.getElementById('placeholderModal');
    if (placeholderModal) {
        placeholderModal.dataset.promptId = promptId || '';
    }

    const placeholders = detectPlaceholders(text);

    if (placeholders.length === 0) {
        copyToClipboard(text, "¡Prompt final copiado!");
        if (promptId) {
            incrementUsageCount(promptId);
        }
        return;
    }

    const placeholderForm = document.getElementById('placeholderForm');
    if (placeholderForm) {
        placeholderForm.innerHTML = '';
        placeholders.forEach(ph => {
            const phId = `ph-${ph.replace(/\s+/g, '-')}`;
            const div = document.createElement('div');
            div.className = 'form-group';
            div.innerHTML = `
                <label for="${phId}" class="form-label">${escapeHTML(ph)}:</label>
                <input type="text" id="${phId}" name="${escapeHTML(ph)}" class="form-input placeholder-input">
            `;
            placeholderForm.appendChild(div);
            div.querySelector('input').addEventListener('input', updatePlaceholderPreview);
        });
    }

    updatePlaceholderPreview();
    openModal('placeholderModal');
    setTimeout(() => {
        const firstInput = placeholderForm?.querySelector('input');
        if (firstInput) firstInput.focus();
    }, 300);
}

/* MIGRATED: use prompts.js */
function updatePlaceholderPreview() {
    let previewText = originalPlaceholderText;
    const placeholderForm = document.getElementById('placeholderForm');
    const inputs = placeholderForm?.querySelectorAll('.placeholder-input') || [];
    
    inputs.forEach(input => {
        const phName = input.name;
        const phValue = input.value;
        const regex = new RegExp(`\\[${phName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\]`, 'g');
        previewText = previewText.replace(regex, phValue || `[${phName}]`);
    });
    
    const finalPlaceholderTextPreview = document.getElementById('finalPlaceholderTextPreview');
    if (finalPlaceholderTextPreview) {
        finalPlaceholderTextPreview.textContent = previewText;
    }
}

/* MIGRATED: use prompts.js */
function fillAndCopyPlaceholders() {
    const finalPlaceholderTextPreview = document.getElementById('finalPlaceholderTextPreview');
    const placeholderModal = document.getElementById('placeholderModal');
    
    if (!finalPlaceholderTextPreview || !placeholderModal) return;
    
    const finalText = finalPlaceholderTextPreview.textContent;
    const promptId = placeholderModal.dataset.promptId;

    copyToClipboard(finalText, "¡Prompt rellenado y copiado!");

    if (promptId) {
        incrementUsageCount(promptId);
    }
    closeModal('placeholderModal');
}

function incrementUsageCount(id) {
    if (!id) return;
    const index = prompts.findIndex(p => p.id === id);
    if (index > -1) {
        prompts[index].usageCount = (prompts[index].usageCount || 0) + 1;
        prompts[index].fechaModificacion = new Date().toISOString();
        savePrompts();

        const promptIdInput = document.getElementById('promptId');
        const promptUsageCount = document.getElementById('promptUsageCount');
        const promptModifiedDate = document.getElementById('promptModifiedDate');
        
        if (promptIdInput?.value === id) {
            if (promptUsageCount) promptUsageCount.textContent = prompts[index].usageCount;
            if (promptModifiedDate) promptModifiedDate.textContent = formatDate(prompts[index].fechaModificacion);
        }
        
        const librarySection = document.getElementById('promptLibrarySection');
        if (librarySection?.classList.contains('active')) {
            renderLibrary(currentPage);
        }
    }
}

// --- FUNCIONES DE SELECCIÓN MÚLTIPLE ---

function handlePromptSelection(checkbox) {
    const promptId = checkbox.dataset.promptId;
    if (checkbox.checked) {
        selectedPromptIds.add(promptId);
    } else {
        selectedPromptIds.delete(promptId);
    }
    updateExportSelectedButton();
}

function updateExportSelectedButton() {
    const exportSelectedBtn = document.getElementById('exportSelectedBtn');
    if (exportSelectedBtn) {
        exportSelectedBtn.disabled = selectedPromptIds.size === 0;
        exportSelectedBtn.title = selectedPromptIds.size === 0 
            ? "Selecciona prompts para exportar" 
            : `Exportar ${selectedPromptIds.size} prompts seleccionados`;
    }
}

// --- FUNCIONES DE IMPORTACIÓN/EXPORTACIÓN ---

function openExportModal(exportAll = true) {
    let promptsToExport = [];
    let filename = "";

    if (exportAll) {
        promptsToExport = prompts;
        filename = `prompts_ai_export_all_${new Date().toISOString().split('T')[0]}.json`;
    } else {
        if (selectedPromptIds.size === 0) {
            showToast("Selecciona al menos un prompt para exportar.", "info");
            return;
        }
        promptsToExport = prompts.filter(p => selectedPromptIds.has(p.id));
        filename = `prompts_ai_export_selected_${new Date().toISOString().split('T')[0]}.json`;
    }

    if (promptsToExport.length === 0 && exportAll) {
        showToast("No hay prompts guardados para exportar.", "info");
        return;
    }

    try {
        const jsonString = JSON.stringify(promptsToExport, null, 2);
        const exportTextArea = document.getElementById('exportTextArea');
        const downloadExportBtn = document.getElementById('downloadExportBtn');
        
        if (exportTextArea) exportTextArea.value = jsonString;
        if (downloadExportBtn) {
            downloadExportBtn.onclick = () => downloadJson(jsonString, filename);
        }
        
        openModal('exportModal');
        
        localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
        checkBackupReminder();
    } catch (e) {
        console.error("Error creating JSON for export:", e);
        showToast("Error al generar el archivo de exportación.", "error");
    }
}

function downloadJson(jsonString, filename) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function openImportModal() {
    const importTextArea = document.getElementById('importTextArea');
    const importFile = document.getElementById('importFile');
    const importError = document.getElementById('importError');
    
    if (importTextArea) importTextArea.value = '';
    if (importFile) importFile.value = '';
    if (importError) {
        importError.textContent = '';
        importError.classList.add('hidden');
    }
    openModal('importModal');
}

function handleImport() {
    const importMerge = document.getElementById('importMerge');
    const importTextArea = document.getElementById('importTextArea');
    const importFile = document.getElementById('importFile');
    const importError = document.getElementById('importError');
    
    const merge = importMerge?.checked ?? true;
    let jsonString = importTextArea?.value.trim() || '';
    const file = importFile?.files[0];
    
    if (importError) {
        importError.textContent = '';
        importError.classList.add('hidden');
    }

    if (!jsonString && !file) {
        if (importError) {
            importError.textContent = "Por favor, pega el JSON o selecciona un archivo.";
            importError.classList.remove('hidden');
        }
        return;
    }

    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const fileContent = event.target.result;
                processImport(fileContent, merge);
            } catch (e) {
                console.error("Error reading file:", e);
                if (importError) {
                    importError.textContent = `Error al leer el archivo: ${e.message}`;
                    importError.classList.remove('hidden');
                }
            }
        };
        reader.onerror = function() {
            if (importError) {
                importError.textContent = "Ocurrió un error al leer el archivo.";
                importError.classList.remove('hidden');
            }
        };
        reader.readAsText(file);
    } else {
        processImport(jsonString, merge);
    }
}

function processImport(jsonString, merge) {
    const importError = document.getElementById('importError');
    
    try {
        const importedData = JSON.parse(jsonString);

        if (!Array.isArray(importedData)) {
            throw new Error("El JSON no es un array válido. La importación fue cancelada.");
        }

            // Migrar prompts para incluir campo municipio si no lo tienen y normalizar datos
    const validPrompts = importedData.filter(p => p && typeof p === 'object' && (p.id || p.nombre || p.promptFinal)).map(p => ({
        id: p.id || `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        nombre: p.nombre || "Prompt importado",
        categoria: p.categoria || "",
        tags: Array.isArray(p.tags) ? p.tags.filter(tag => tag && tag.trim()) : [],
        municipio: p.municipio || "", // Campo migrado para compatibilidad
        rating: typeof p.rating === 'number' && p.rating >= 0 && p.rating <= 5 ? p.rating : 0,
        isFavorite: typeof p.isFavorite === 'boolean' ? p.isFavorite : false,
        usageCount: typeof p.usageCount === 'number' && p.usageCount >= 0 ? p.usageCount : 0,
        fechaCreacion: p.fechaCreacion || new Date().toISOString(),
        fechaModificacion: p.fechaModificacion || new Date().toISOString(),
        rol: p.rol || "",
        contexto: p.contexto || "",
        tarea: p.tarea || "",
        formato: p.formato || "",
        tono: p.tono || "",
        restricciones: p.restricciones || "",
        ejemplo: p.ejemplo || "",
        promptFinal: p.promptFinal || "",
        variations: Array.isArray(p.variations) ? p.variations : [],
        notas: p.notas || ""
    }));

    console.log(`Procesando ${validPrompts.length} prompts válidos de ${importedData.length} totales`);

        if (validPrompts.length !== importedData.length) {
            showToast("Algunos prompts en el JSON tenían formato inválido y fueron omitidos.", "warning");
        }

        let addedCount = 0;
        let updatedCount = 0;

        if (merge) {
            validPrompts.forEach(importedPrompt => {
                const existingIndex = prompts.findIndex(p => p.id === importedPrompt.id);
                if (existingIndex > -1) {
                    if (new Date(importedPrompt.fechaModificacion) > new Date(prompts[existingIndex].fechaModificacion)) {
                        prompts[existingIndex] = importedPrompt;
                        updatedCount++;
                    }
                } else {
                    prompts.push(importedPrompt);
                    addedCount++;
                }
            });
        } else {
            prompts = validPrompts;
            addedCount = validPrompts.length;
        }

        savePrompts();
        updateFilterOptions();
        renderLibrary(1);
        closeModal('importModal');
        showToast(`Importación completa: ${addedCount} añadidos, ${updatedCount} actualizados.`, 'success');

    } catch (e) {
        console.error("Error processing import:", e);
        if (importError) {
            importError.textContent = `Error al procesar el JSON: ${e.message}`;
            importError.classList.remove('hidden');
        }
    }
}

// --- FUNCIONES DE EDICIÓN DE ETIQUETAS/CATEGORÍAS ---

function openEditTagCatModal(oldValue, isCategory, isMunicipio = false) {
    const editTagCatTypeSpan = document.getElementById('editTagCatType');
    const editTagCatOldValueSpan = document.getElementById('editTagCatOldValue');
    const editTagCatNewValueInput = document.getElementById('editTagCatNewValue');
    const editTagCatIsCategoryInput = document.getElementById('editTagCatIsCategory');
    const editTagCatIsMunicipioInput = document.getElementById('editTagCatIsMunicipio');
    
    if (editTagCatTypeSpan) editTagCatTypeSpan.textContent = isMunicipio ? 'Municipio' : (isCategory ? 'Categoría' : 'Etiqueta');
    if (editTagCatOldValueSpan) editTagCatOldValueSpan.textContent = oldValue;
    if (editTagCatNewValueInput) editTagCatNewValueInput.value = oldValue;
    if (editTagCatIsCategoryInput) editTagCatIsCategoryInput.value = isCategory;
    if (editTagCatIsMunicipioInput) editTagCatIsMunicipioInput.value = isMunicipio;
    
    openModal('editTagCatModal');
}

function confirmEditTagOrCat() {
    const editTagCatOldValueSpan = document.getElementById('editTagCatOldValue');
    const editTagCatNewValueInput = document.getElementById('editTagCatNewValue');
    const editTagCatIsCategoryInput = document.getElementById('editTagCatIsCategory');
    const editTagCatIsMunicipioInput = document.getElementById('editTagCatIsMunicipio');
    
    if (!editTagCatOldValueSpan || !editTagCatNewValueInput || !editTagCatIsCategoryInput) return;
    
    const oldValue = editTagCatOldValueSpan.textContent;
    const newValue = editTagCatNewValueInput.value.trim();
    const isCategory = editTagCatIsCategoryInput.value === 'true';
    const isMunicipio = editTagCatIsMunicipioInput?.value === 'true';

    if (!newValue) {
        showToast('El nuevo valor no puede estar vacío.', 'error');
        return;
    }

    if (isMunicipio) {
        // Actualizar municipio
        const index = municipios.indexOf(oldValue);
        if (index > -1) {
            municipios[index] = newValue.toUpperCase();
            municipios.sort();
            localStorage.setItem(MUNICIPIOS_KEY, JSON.stringify(municipios));
            updateMunicipiosSelects();
            
            // Actualizar prompts que usen este municipio
            prompts.forEach(p => {
                if (p.municipio === oldValue) {
                    p.municipio = newValue.toUpperCase();
                    p.fechaModificacion = new Date().toISOString();
                }
            });
            savePrompts();
            renderManageMunicipios();
        }
    } else {
        // Actualizar etiqueta o categoría
        let modifiedCount = 0;
        prompts.forEach(p => {
            let updated = false;
            if (isCategory) {
                if (p.categoria === oldValue) {
                    p.categoria = newValue;
                    updated = true;
                }
            } else {
                const tagIndex = p.tags.indexOf(oldValue);
                if (tagIndex > -1) {
                    p.tags[tagIndex] = newValue;
                    p.tags = [...new Set(p.tags)];
                    updated = true;
                }
            }
            if (updated) {
                p.fechaModificacion = new Date().toISOString();
                modifiedCount++;
            }
        });

        savePrompts();
        updateFilterOptions();
        renderLibrary(currentPage);
        renderManageTagsCategories();
        
        showToast(`${isCategory ? 'Categoría' : 'Etiqueta'} actualizada en ${modifiedCount} prompts.`, 'success');
    }

    closeModal('editTagCatModal');
}

// --- FUNCIONES DE AUTOSAVE ---

function triggerAutosave() {
    clearTimeout(autosaveTimeout);
    const autosaveStatus = document.getElementById('autosave-status');
    if (autosaveStatus) autosaveStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    
    autosaveTimeout = setTimeout(() => {
        saveAutosave();
        if (autosaveStatus) autosaveStatus.innerHTML = '<i class="fa-solid fa-check"></i> Guardado automático';
        setTimeout(() => {
            if (autosaveStatus) autosaveStatus.innerHTML = '';
        }, 2000);
    }, 1000);
}

function saveAutosave() {
    const data = {
        nombre: document.getElementById('promptName')?.value || '',
        categoria: document.getElementById('promptCategory')?.value || '',
        tags: document.getElementById('promptTags')?.value || '',
        municipio: document.getElementById('promptMunicipio')?.value || '',
        rating: document.getElementById('promptRatingValue')?.value || 0,
        isFavorite: document.getElementById('promptFavorite')?.checked || false,
        rol: document.getElementById('promptRole')?.value || '',
        contexto: document.getElementById('promptContext')?.value || '',
        tarea: document.getElementById('promptTask')?.value || '',
        formato: document.getElementById('promptFormat')?.value || '',
        tono: document.getElementById('promptTone')?.value || '',
        restricciones: document.getElementById('promptConstraints')?.value || '',
        ejemplo: document.getElementById('promptExample')?.value || '',
        notas: document.getElementById('promptNotes')?.value || ''
    };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
}

function loadAutosave() {
    const savedData = localStorage.getItem(AUTOSAVE_KEY);
    if (savedData) {
        const data = JSON.parse(savedData);
        if (Object.values(data).some(val => val && (!Array.isArray(val) || val.length > 0))) {
            if (confirm("Se encontró un borrador guardado. ¿Deseas cargarlo?")) {
                const elements = {
                    promptName: document.getElementById('promptName'),
                    promptCategory: document.getElementById('promptCategory'),
                    promptTags: document.getElementById('promptTags'),
                    promptMunicipio: document.getElementById('promptMunicipio'),
                    promptRatingValue: document.getElementById('promptRatingValue'),
                    promptFavorite: document.getElementById('promptFavorite'),
                    promptFavoriteIcon: document.getElementById('promptFavoriteIcon'),
                    promptRole: document.getElementById('promptRole'),
                    promptContext: document.getElementById('promptContext'),
                    promptTask: document.getElementById('promptTask'),
                    promptFormat: document.getElementById('promptFormat'),
                    promptTone: document.getElementById('promptTone'),
                    promptConstraints: document.getElementById('promptConstraints'),
                    promptExample: document.getElementById('promptExample'),
                    promptNotes: document.getElementById('promptNotes')
                };
                
                if (elements.promptName) elements.promptName.value = data.nombre || '';
                if (elements.promptCategory) elements.promptCategory.value = data.categoria || '';
                if (elements.promptTags) elements.promptTags.value = data.tags || '';
                if (elements.promptMunicipio) elements.promptMunicipio.value = data.municipio || '';
                if (elements.promptRatingValue) elements.promptRatingValue.value = data.rating || 0;
                if (elements.promptFavorite) elements.promptFavorite.checked = data.isFavorite || false;
                if (elements.promptFavoriteIcon) {
                    const isFavorite = data.isFavorite || false;
                    elements.promptFavoriteIcon.className = isFavorite ? 'fa-solid fa-heart favorite-toggle active' : 'fa-regular fa-heart favorite-toggle';
                    elements.promptFavoriteIcon.style.color = isFavorite ? '#ef4444' : 'var(--text-muted)';
                }
                if (elements.promptRole) elements.promptRole.value = data.rol || '';
                if (elements.promptContext) elements.promptContext.value = data.contexto || '';
                if (elements.promptTask) elements.promptTask.value = data.tarea || '';
                if (elements.promptFormat) elements.promptFormat.value = data.formato || '';
                if (elements.promptTone) elements.promptTone.value = data.tono || '';
                if (elements.promptConstraints) elements.promptConstraints.value = data.restricciones || '';
                if (elements.promptExample) elements.promptExample.value = data.ejemplo || '';
                if (elements.promptNotes) elements.promptNotes.value = data.notas || '';
                
                setupRating(data.rating || 0);
                showToast('Borrador restaurado.', 'info');
            }
        }
    }
}

function clearAutosave() {
    localStorage.removeItem(AUTOSAVE_KEY);
    const autosaveStatus = document.getElementById('autosave-status');
    if (autosaveStatus) autosaveStatus.innerHTML = '';
}

// --- FUNCIONES DE BACKUP ---

function checkBackupReminder() {
    const backupReminder = document.getElementById('backupReminder');
    if (!backupReminder) return;
    
    const lastExport = localStorage.getItem(LAST_EXPORT_KEY);
    if (!lastExport) {
        backupReminder.style.display = 'block';
        return;
    }
    const daysSinceExport = (new Date() - new Date(lastExport)) / (1000 * 60 * 60 * 24);
    if (daysSinceExport > BACKUP_REMINDER_DAYS) {
        backupReminder.style.display = 'block';
    } else {
        backupReminder.style.display = 'none';
    }
}

// --- FUNCIONES DE ACORDEÓN ---

/* MIGRATED: use ui.js */
function setupAccordion() {
    const accordionItems = document.querySelectorAll('.accordion-item');
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const content = item.querySelector('.accordion-content');
        
        if (header && content) {
            header.addEventListener('click', () => {
                const isOpen = item.classList.contains('open');
                
                if (isOpen) {
                    item.classList.remove('open');
                    content.style.display = 'none';
                } else {
                    item.classList.add('open');
                    content.style.display = 'block';
                }
            });
        }
    });
}

/* MIGRATED: use ui.js */
function expandAllAccordion() {
    const accordionItems = document.querySelectorAll('.accordion-item');
    accordionItems.forEach(item => {
        const content = item.querySelector('.accordion-content');
        if (content) {
            item.classList.add('open');
            content.style.display = 'block';
        }
    });
}

/* MIGRATED: use ui.js */
function collapseAllAccordion() {
    const accordionItems = document.querySelectorAll('.accordion-item');
    accordionItems.forEach(item => {
        const content = item.querySelector('.accordion-content');
        if (content) {
            item.classList.remove('open');
            content.style.display = 'none';
        }
    });
}

// --- FUNCIÓN PARA MANEJAR ENVÍO DEL FORMULARIO ---

/* MIGRATED: use prompts.js */
function handleFormSubmit() {
    const promptIdInput = document.getElementById('promptId');
    const promptNameInput = document.getElementById('promptName');
    const promptCategoryInput = document.getElementById('promptCategory');
    const promptTagsInput = document.getElementById('promptTags');
    const promptMunicipioInput = document.getElementById('promptMunicipio');
    const promptRatingValueInput = document.getElementById('promptRatingValue');
    const promptFavoriteCheckbox = document.getElementById('promptFavorite');
    const promptRoleInput = document.getElementById('promptRole');
    const promptContextInput = document.getElementById('promptContext');
    const promptTaskInput = document.getElementById('promptTask');
    const promptFormatInput = document.getElementById('promptFormat');
    const promptToneInput = document.getElementById('promptTone');
    const promptConstraintsInput = document.getElementById('promptConstraints');
    const promptExampleInput = document.getElementById('promptExample');
    const promptNotesInput = document.getElementById('promptNotes');
    const promptFinalDisplay = document.getElementById('promptFinalDisplay');

    const promptId = promptIdInput?.value;
    const isUpdating = !!promptId;
    const now = new Date().toISOString();
    
    const finalPromptText = promptFinalDisplay?.textContent.trim() || '';
    const taskText = promptTaskInput?.value.trim() || '';

    if (!taskText && !finalPromptText) {
        showToast("Define la 'Tarea' o escribe un 'Prompt Final'.", "error");
        if (promptTaskInput) promptTaskInput.focus();
        return;
    }

    // Generar prompt final si está vacío pero hay tarea
    let finalPrompt = finalPromptText;
    if (!finalPromptText && taskText) {
        finalPrompt = generateFinalPrompt();
        if (promptFinalDisplay) {
            promptFinalDisplay.innerHTML = escapeHTML(finalPrompt);
        }
    }

    if (!finalPrompt) {
        showToast("El prompt final no puede estar vacío.", "error");
        if (promptFinalDisplay) promptFinalDisplay.focus();
        return;
    }

    const currentPromptData = isUpdating ? prompts.find(p => p.id === promptId) : {};

    const promptData = {
        id: promptId || `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        nombre: promptNameInput?.value.trim() || "Prompt sin nombre",
        categoria: promptCategoryInput?.value.trim() || "",
        tags: promptTagsInput?.value.split(',').map(tag => tag.trim()).filter(tag => tag) || [],
        municipio: promptMunicipioInput?.value.trim() || "",
        rating: parseInt(promptRatingValueInput?.value) || 0,
        isFavorite: promptFavoriteCheckbox?.checked || false,
        usageCount: currentPromptData?.usageCount || 0,
        fechaCreacion: currentPromptData?.fechaCreacion || now,
        fechaModificacion: now,
        rol: promptRoleInput?.value.trim() || "",
        contexto: promptContextInput?.value.trim() || "",
        tarea: taskText,
        formato: promptFormatInput?.value.trim() || "",
        tono: promptToneInput?.value.trim() || "",
        restricciones: promptConstraintsInput?.value.trim() || "",
        ejemplo: promptExampleInput?.value.trim() || "",
        promptFinal: finalPrompt,
        variations: currentPromptData?.variations || [],
        notas: promptNotesInput?.value.trim() || ""
    };

    if (isUpdating) {
        const index = prompts.findIndex(p => p.id === promptId);
        if (index > -1) {
            prompts[index] = promptData;
        } else {
            prompts.push(promptData);
        }
    } else {
        prompts.push(promptData);
    }

    savePrompts();
    updateFilterOptions();
    renderLibrary(currentPage);
    showSection('promptLibrarySection');
    
    const action = isUpdating ? 'actualizado' : 'guardado';
    showToast(`Prompt "${promptData.nombre}" ${action} correctamente.`, 'success');
    
    clearForm();
}

// --- INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    if (window && window.__ESM_BOOTSTRAP__) {
        return;
    }
    // Inicializar tema, municipios y auto-resize
    initTheme();
    initMunicipios();
    setupAutoResize();
    
    // Cargar datos
    loadPrompts();
    loadTemplates();
    updateFilterOptions();
    renderLibrary();
    loadAutosave();
    checkBackupReminder();
    // Intento de bootstrap de plantillas desde JSON incluido si no hay plantillas guardadas
    maybeBootstrapTemplatesFromBundledJson();
    // Autocompletado de plantillas en campos del formulario
    setupTemplateAutocomplete();
    
    // Setup accordion
    setupAccordion();

    // Event listeners para navegación
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = tab.getAttribute('data-section');
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });

    // Event listeners para tema
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Event listeners para municipios
    const addMunicipioBtn = document.getElementById('addMunicipioBtn');
    if (addMunicipioBtn) {
        addMunicipioBtn.addEventListener('click', addMunicipio);
    }

    // Event listeners para filtros
    const searchLibraryInput = document.getElementById('searchLibraryInput');
    const filterCategory = document.getElementById('filterCategory');
    const filterTag = document.getElementById('filterTag');
    const filterFavorite = document.getElementById('filterFavorite');
    const filterMunicipio = document.getElementById('filterMunicipio');
    const sortLibrarySelect = document.getElementById('sortLibrarySelect');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    if (searchLibraryInput) searchLibraryInput.addEventListener('input', () => renderLibrary(1));
    if (filterCategory) {
        filterCategory.addEventListener('change', () => {
            updateTagFilter();
            renderLibrary(1);
        });
    }
    if (filterTag) filterTag.addEventListener('change', () => renderLibrary(1));
    if (filterFavorite) filterFavorite.addEventListener('change', () => renderLibrary(1));
    if (filterMunicipio) filterMunicipio.addEventListener('change', () => renderLibrary(1));
    if (sortLibrarySelect) sortLibrarySelect.addEventListener('change', () => renderLibrary(1));
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchLibraryInput) searchLibraryInput.value = '';
            if (filterCategory) filterCategory.value = '';
            if (filterTag) filterTag.value = '';
            if (filterFavorite) filterFavorite.checked = false;
            if (filterMunicipio) filterMunicipio.value = '';
            if (sortLibrarySelect) sortLibrarySelect.value = 'date_desc';
            updateTagFilter();
            renderLibrary(1);
        });
    }

    // Event listeners para importar/exportar
    const importBtn = document.getElementById('importBtn');
    const exportSelectedBtn = document.getElementById('exportSelectedBtn');
    const exportAllBtn = document.getElementById('exportAllBtn');

    if (importBtn) importBtn.addEventListener('click', openImportModal);
    if (exportSelectedBtn) exportSelectedBtn.addEventListener('click', () => openExportModal(false));
    if (exportAllBtn) exportAllBtn.addEventListener('click', () => openExportModal(true));

    // Event listeners para formulario
    const promptBuilderForm = document.getElementById('promptBuilderForm');
    if (promptBuilderForm) {
        promptBuilderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleFormSubmit();
        });
    }

    const generatePromptBtn = document.getElementById('generatePromptBtn');
    const copyPromptBtn = document.getElementById('copyPromptBtn');
    const clearFormBtn = document.getElementById('clearFormBtn');

    if (generatePromptBtn) generatePromptBtn.addEventListener('click', generateFinalPromptUI);
    if (copyPromptBtn) {
        copyPromptBtn.addEventListener('click', () => {
            const promptFinalDisplay = document.getElementById('promptFinalDisplay');
            if (promptFinalDisplay) {
                const textToCopy = promptFinalDisplay.textContent;
                if (textToCopy && textToCopy !== 'El prompt generado aparecerá aquí...') {
                    copyFinalPromptWrapper();
                } else {
                    showToast('No hay nada que copiar.', 'info');
                }
            }
        });
    }
    if (clearFormBtn) clearFormBtn.addEventListener('click', clearForm);

    // Event listeners para rating
    const promptRating = document.getElementById('promptRating');
    if (promptRating) {
        promptRating.addEventListener('click', (e) => {
            if (e.target.matches('.fa-star')) {
                const rating = parseInt(e.target.dataset.value);
                setupRating(rating);
            }
        });
    }

    // Event listeners para favorito
    const promptFavoriteIcon = document.getElementById('promptFavoriteIcon');
    const promptFavoriteCheckbox = document.getElementById('promptFavorite');
    if (promptFavoriteIcon && promptFavoriteCheckbox) {
        promptFavoriteIcon.addEventListener('click', () => {
            const newState = !promptFavoriteCheckbox.checked;
            promptFavoriteCheckbox.checked = newState;
            promptFavoriteIcon.className = newState ? 'fa-solid fa-heart favorite-toggle active' : 'fa-regular fa-heart favorite-toggle';
            promptFavoriteIcon.style.color = newState ? '#ef4444' : 'var(--text-muted)';
        });
    }

    // Event listeners para variaciones
    const addVariationBtn = document.getElementById('addVariationBtn');
    if (addVariationBtn) addVariationBtn.addEventListener('click', addVariation);

    // Event listeners para Plantillas
    const addRoleTemplateBtn = document.getElementById('addRoleTemplateBtn');
    const addToneTemplateBtn = document.getElementById('addToneTemplateBtn');
    const addConstraintTemplateBtn = document.getElementById('addConstraintTemplateBtn');
    if (addRoleTemplateBtn) addRoleTemplateBtn.addEventListener('click', () => {
        const name = document.getElementById('newRoleName')?.value || '';
        const text = document.getElementById('newRoleText')?.value || '';
        if (addTemplate('role', name, text)) {
            if (document.getElementById('newRoleName')) document.getElementById('newRoleName').value = '';
            if (document.getElementById('newRoleText')) document.getElementById('newRoleText').value = '';
        }
    });
    if (addToneTemplateBtn) addToneTemplateBtn.addEventListener('click', () => {
        const name = document.getElementById('newToneName')?.value || '';
        const text = document.getElementById('newToneText')?.value || '';
        if (addTemplate('tone', name, text)) {
            if (document.getElementById('newToneName')) document.getElementById('newToneName').value = '';
            if (document.getElementById('newToneText')) document.getElementById('newToneText').value = '';
        }
    });
    if (addConstraintTemplateBtn) addConstraintTemplateBtn.addEventListener('click', () => {
        const name = document.getElementById('newConstraintName')?.value || '';
        const text = document.getElementById('newConstraintText')?.value || '';
        if (addTemplate('constraint', name, text)) {
            if (document.getElementById('newConstraintName')) document.getElementById('newConstraintName').value = '';
            if (document.getElementById('newConstraintText')) document.getElementById('newConstraintText').value = '';
        }
    });

    const confirmEditTemplateBtn = document.getElementById('confirmEditTemplateBtn');
    if (confirmEditTemplateBtn) confirmEditTemplateBtn.addEventListener('click', () => {
        const id = document.getElementById('editTemplateId')?.value;
        const name = document.getElementById('editTemplateName')?.value || '';
        const text = document.getElementById('editTemplateText')?.value || '';
        if (id) {
            updateTemplate(id, name, text);
            closeModal('editTemplateModal');
        }
    });

    const extractTemplatesFromLibraryBtn = document.getElementById('extractTemplatesFromLibraryBtn');
    if (extractTemplatesFromLibraryBtn) extractTemplatesFromLibraryBtn.addEventListener('click', () => {
        const summary = extractTemplatesFromDataset(prompts);
        renderTemplates();
        showToast(`Extraídas ${summary.role} roles, ${summary.tone} tonos, ${summary.constraint} restricciones.`, 'success');
    });

    const importTemplatesFromJsonBtn = document.getElementById('importTemplatesFromJsonBtn');
    const templateJsonFileInput = document.getElementById('templateJsonFileInput');
    if (importTemplatesFromJsonBtn && templateJsonFileInput) {
        importTemplatesFromJsonBtn.addEventListener('click', () => templateJsonFileInput.click());
        templateJsonFileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const content = String(ev.target.result || '');
                    const data = JSON.parse(content);
                    const summary = extractTemplatesFromDataset(Array.isArray(data) ? data : []);
                    renderTemplates();
                    showToast(`Extraídas ${summary.role} roles, ${summary.tone} tonos, ${summary.constraint} restricciones del JSON.`, 'success');
                } catch (err) {
                    console.error(err);
                    showToast('JSON inválido. No se pudo extraer plantillas.', 'error');
                }
            };
            reader.onerror = () => showToast('Error al leer el archivo JSON.', 'error');
            reader.readAsText(file);
            // limpiar input para permitir re-subir el mismo archivo si se desea
            e.target.value = '';
        });
    }

    // Mostrar pickers discretos en Crear Prompt solo si hay plantillas
    const rolePickerBtn = document.getElementById('roleTemplatePickerBtn');
    const tonePickerBtn = document.getElementById('toneTemplatePickerBtn');
    const constraintPickerBtn = document.getElementById('constraintTemplatePickerBtn');
    const hasRoleTpl = templates.some(t => t.category === 'role');
    const hasToneTpl = templates.some(t => t.category === 'tone');
    const hasConstraintTpl = templates.some(t => t.category === 'constraint');
    if (rolePickerBtn) rolePickerBtn.classList.toggle('hidden', !hasRoleTpl);
    if (tonePickerBtn) tonePickerBtn.classList.toggle('hidden', !hasToneTpl);
    if (constraintPickerBtn) constraintPickerBtn.classList.toggle('hidden', !hasConstraintTpl);

    const showQuickPicker = (category, anchorBtnId) => {
        const anchor = document.getElementById(anchorBtnId);
        if (!anchor) return;
        // Construir menú flotante liviano
        const existing = document.getElementById(`quickPicker-${category}`);
        if (existing) existing.remove();
        const menu = document.createElement('div');
        menu.id = `quickPicker-${category}`;
        menu.style.position = 'absolute';
        menu.style.zIndex = '1001';
        menu.style.background = 'var(--bg-card)';
        menu.style.border = '1px solid var(--border-light)';
        menu.style.borderRadius = '12px';
        menu.style.boxShadow = 'var(--shadow-lg)';
        menu.style.padding = '8px';
        menu.style.maxWidth = '360px';
        menu.style.maxHeight = '320px';
        menu.style.overflow = 'auto';

        const list = templates.filter(t => t.category === category)
            .sort((a,b)=> (b.usageCount||0) - (a.usageCount||0) || new Date(b.updatedAt)-new Date(a.updatedAt))
            .slice(0, 12);

        if (list.length === 0) {
            menu.innerHTML = '<div style="color: var(--text-muted); padding:8px;">No hay plantillas.</div>';
        } else {
            list.forEach(t => {
                const item = document.createElement('div');
                item.style.cssText = 'padding:8px; border-radius:8px; cursor:pointer;';
                item.innerHTML = `<div style="font-weight:600; color: var(--primary-dark);">${escapeHTML(t.name || (t.text.substring(0,40)+(t.text.length>40?'…':'')))}</div><div style="font-size:0.875rem; color: var(--text-secondary); max-height:3.2em; overflow:hidden;">${escapeHTML(t.text)}</div>`;
                item.addEventListener('mouseenter', ()=> item.style.background = 'var(--bg-secondary)');
                item.addEventListener('mouseleave', ()=> item.style.background = 'transparent');
                item.addEventListener('click', ()=> { applyTemplateToForm(t); menu.remove(); });
                // Botón de ojo pequeño
                const eye = document.createElement('button');
                eye.className = 'btn btn-icon btn-sm';
                eye.title = 'Previsualizar';
                eye.innerHTML = '<i class="fa-solid fa-eye"></i>';
                eye.style.marginTop = '6px';
                eye.addEventListener('click', (e)=> { e.stopPropagation(); openPreviewTemplateModal(t); });
                item.appendChild(eye);
                menu.appendChild(item);
            });
            const more = templates.filter(t => t.category === category).length > list.length;
            if (more) {
                const moreBtn = document.createElement('button');
                moreBtn.className = 'btn btn-secondary btn-sm';
                moreBtn.textContent = 'Ver todas';
                moreBtn.style.marginTop = '6px';
                moreBtn.onclick = () => { showSection('templatesSection'); menu.remove(); };
                menu.appendChild(moreBtn);
            }
        }

        document.body.appendChild(menu);
        const rect = anchor.getBoundingClientRect();
        menu.style.top = `${window.scrollY + rect.bottom + 6}px`;
        menu.style.left = `${window.scrollX + rect.left}px`;

        const onClickOutside = (e) => { if (!menu.contains(e.target) && e.target !== anchor) { menu.remove(); document.removeEventListener('click', onClickOutside); } };
        setTimeout(()=> document.addEventListener('click', onClickOutside), 0);
    };

    if (rolePickerBtn) rolePickerBtn.addEventListener('click', ()=> showQuickPicker('role','roleTemplatePickerBtn'));
    if (tonePickerBtn) tonePickerBtn.addEventListener('click', ()=> showQuickPicker('tone','toneTemplatePickerBtn'));
    if (constraintPickerBtn) constraintPickerBtn.addEventListener('click', ()=> showQuickPicker('constraint','constraintTemplatePickerBtn'));
    // Event listeners para autosave
    const autosaveInputs = [
        'promptName', 'promptCategory', 'promptTags', 'promptMunicipio', 
        'promptRole', 'promptContext', 'promptTask', 'promptFormat', 
        'promptTone', 'promptConstraints', 'promptExample', 'promptNotes'
    ];
    
    autosaveInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) input.addEventListener('input', triggerAutosave);
    });

    if (promptRating) promptRating.addEventListener('click', triggerAutosave);
    if (promptFavoriteIcon) promptFavoriteIcon.addEventListener('click', triggerAutosave);

    // Event listeners para modales
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const copyExportBtn = document.getElementById('copyExportBtn');
    const confirmImportBtn = document.getElementById('confirmImportBtn');
    const copyPlaceholderResultBtn = document.getElementById('copyPlaceholderResultBtn');
    const confirmEditTagCatBtn = document.getElementById('confirmEditTagCatBtn');

    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDelete);
    if (copyExportBtn) {
        copyExportBtn.addEventListener('click', () => {
            const exportTextArea = document.getElementById('exportTextArea');
            if (exportTextArea) {
                copyToClipboard(exportTextArea.value, 'Datos de exportación copiados.');
            }
        });
    }
    if (confirmImportBtn) confirmImportBtn.addEventListener('click', handleImport);
    if (copyPlaceholderResultBtn) copyPlaceholderResultBtn.addEventListener('click', fillAndCopyPlaceholders);
    if (confirmEditTagCatBtn) confirmEditTagCatBtn.addEventListener('click', confirmEditTagOrCat);

    // Event listener para importar archivo
    const importFile = document.getElementById('importFile');
    if (importFile) {
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const importTextArea = document.getElementById('importTextArea');
                    if (importTextArea) {
                        importTextArea.value = event.target.result;
                    }
                };
                reader.readAsText(file);
            }
        });
    }

    // Event listeners para cerrar modales
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-button')) {
                closeModal(modal.id);
            }
        });
    });

    // Event listeners para acordeón en guía
    const expandAllAccordionBtn = document.getElementById('expandAllAccordion');
    const collapseAllAccordionBtn = document.getElementById('collapseAllAccordion');
    
    if (expandAllAccordionBtn) expandAllAccordionBtn.addEventListener('click', expandAllAccordion);
    if (collapseAllAccordionBtn) collapseAllAccordionBtn.addEventListener('click', collapseAllAccordion);

    // Event listeners para placeholders
    const placeholderForm = document.getElementById('placeholderForm');
    if (placeholderForm) {
        placeholderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            fillAndCopyPlaceholders();
        });
    }
});