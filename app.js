
/* --- Start of state.js --- */

// Estado y persistencia

const LOCAL_STORAGE_KEY = 'aiPrompts_v3';
const AUTOSAVE_KEY = 'aiPrompts_autosave';
const BACKUP_REMINDER_DAYS = 14;
const LAST_EXPORT_KEY = 'aiPrompts_lastExport';
const THEME_KEY = 'aiPrompts_theme';
const MUNICIPIOS_KEY = 'aiPrompts_municipios';
const TEMPLATES_KEY = 'aiPrompts_templates_v1';

const MUNICIPIOS_DEFAULT = [
    'ARBOLEDAS', 'BOCHALEMA', 'CACHIRA', 'CHINACOTA', 'CHITAGA', 'CONVENCION',
    'CUCUTA', 'EL TARRA', 'HACARI', 'HERRAN', 'LABATECA', 'LA ESPERANZA',
    'LOURDES', 'MUTISCUA', 'OCAÑA', 'PUERTO SANTANDER', 'RAGONVALIA',
    'TOLEDO', 'VILLA CARO', 'VILLA DEL ROSARIO'
];

let prompts = [];
let templates = [];
let municipios = [];
let isDarkMode = false;
let currentPage = 1;
const promptsPerPage = 9;
let selectedPromptIds = new Set();

function setIsDarkMode(value) { isDarkMode = value; }
function setPrompts(value) { prompts = value; }
function setTemplates(value) { templates = value; }
function setMunicipios(value) { municipios = value; }
function setCurrentPage(value) { currentPage = value; }

function savePrompts() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prompts));
}

function loadPrompts() {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    try {
        const parsed = stored ? JSON.parse(stored) : [];
        // SECURITY: Validar que sea un array y sanitizar cada prompt
        if (!Array.isArray(parsed)) {
            console.warn('SECURITY: localStorage corrupto, reiniciando prompts');
            setPrompts([]);
            return;
        }
        // Validar estructura básica de cada prompt
        const validated = parsed.filter(p => p && typeof p === 'object' && (p.id || p.nombre || p.promptFinal));
        setPrompts(validated);
    } catch (e) {
        console.error('Error loading prompts:', e);
        setPrompts([]);
    }
}

function saveTemplates() {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

function loadTemplates() {
    const saved = localStorage.getItem(TEMPLATES_KEY);
    try {
        setTemplates(saved ? JSON.parse(saved) : []);
    } catch {
        setTemplates([]);
    }
}

function initMunicipios() {
    const saved = localStorage.getItem(MUNICIPIOS_KEY);
    setMunicipios(saved ? JSON.parse(saved) : [...MUNICIPIOS_DEFAULT]);
}

function loadInitialData() {
    loadPrompts();
    loadTemplates();
    initMunicipios();
}




/* --- Start of utils.js --- */

// Utilidades puras

function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

function formatDate(isoString) {
    if (!isoString) return 'N/A';
    try {
        return new Date(isoString).toLocaleString('es-ES', {
            dateStyle: 'short',
            timeStyle: 'short'
        });
    } catch (_) {
        return 'Fecha inválida';
    }
}

function debounce(func, wait = 20) {
    let timeoutId;
    return function debounced(...args) {
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), wait);
    };
}

// SECURITY: Generador de IDs criptográficamente seguros
function generateSecureId(prefix = 'id') {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj?.randomUUID) {
        return `${prefix}_${cryptoObj.randomUUID()}`;
    }
    // Fallback para navegadores sin crypto.randomUUID
    if (cryptoObj?.getRandomValues) {
        const array = new Uint8Array(16);
        cryptoObj.getRandomValues(array);
        return `${prefix}_${Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')}`;
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// SECURITY: Lista blanca de propiedades permitidas para prompts
const ALLOWED_PROMPT_KEYS = ['id', 'nombre', 'categoria', 'tags', 'municipio',
    'rating', 'isFavorite', 'usageCount', 'fechaCreacion',
    'fechaModificacion', 'rol', 'contexto', 'tarea',
    'formato', 'tono', 'restricciones', 'ejemplo',
    'promptFinal', 'variations', 'notas'];

// SECURITY: Validador de esquema para prompts
function validatePromptSchema(data) {
    if (!data || typeof data !== 'object') return false;
    // Verificar que rating esté en rango válido
    if (data.rating !== undefined && (typeof data.rating !== 'number' || data.rating < 0 || data.rating > 5)) {
        data.rating = Math.max(0, Math.min(5, Number(data.rating) || 0));
    }
    // Verificar que usageCount sea positivo
    if (data.usageCount !== undefined && (typeof data.usageCount !== 'number' || data.usageCount < 0)) {
        data.usageCount = Math.max(0, Number(data.usageCount) || 0);
    }
    return true;
}

// SECURITY: Sanitización profunda para prevenir Prototype Pollution
function sanitizeImportedPrompt(rawPrompt) {
    if (!rawPrompt || typeof rawPrompt !== 'object') return null;

    // Verificar claves peligrosas en cualquier nivel
    const hasDangerousKeys = (obj, depth = 0) => {
        if (depth > 10) return true; // Prevenir recursión infinita
        if (!obj || typeof obj !== 'object') return false;
        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
        for (const key of Object.keys(obj)) {
            if (dangerousKeys.includes(key)) return true;
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                if (hasDangerousKeys(obj[key], depth + 1)) return true;
            }
        }
        return false;
    };

    if (hasDangerousKeys(rawPrompt)) {
        console.warn('SECURITY: Detectado intento de Prototype Pollution, prompt rechazado');
        return null;
    }

    // Deep clone seguro para romper referencias al prototipo
    const cleaned = JSON.parse(JSON.stringify(rawPrompt));

    // Whitelist: solo permitir propiedades conocidas
    const sanitized = {};
    ALLOWED_PROMPT_KEYS.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(cleaned, key)) {
            sanitized[key] = cleaned[key];
        }
    });

    return sanitized;
}




/* --- Start of import_export.js --- */

// Importación y exportación de prompts



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

function openExportModal(exportAll = true) {
    let promptsToExport = [];
    let filename = '';
    if (exportAll) {
        promptsToExport = prompts;
        filename = `prompts_ai_export_all_${new Date().toISOString().split('T')[0]}.json`;
    } else {
        const selectedIds = window?.selectedPromptIds || new Set();
        if (selectedIds.size === 0) { showToast('Selecciona al menos un prompt para exportar.', 'info'); return; }
        promptsToExport = prompts.filter(p => selectedIds.has(p.id));
        filename = `prompts_ai_export_selected_${new Date().toISOString().split('T')[0]}.json`;
    }
    if (promptsToExport.length === 0 && exportAll) { showToast('No hay prompts guardados para exportar.', 'info'); return; }
    try {
        const jsonString = JSON.stringify(promptsToExport, null, 2);
        const exportTextArea = document.getElementById('exportTextArea');
        const downloadExportBtn = document.getElementById('downloadExportBtn');
        if (exportTextArea) exportTextArea.value = jsonString;
        if (downloadExportBtn) downloadExportBtn.onclick = () => downloadJson(jsonString, filename);
        openModal('exportModal');
        localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
        checkBackupReminder();
    } catch (e) {
        console.error('Error creating JSON for export:', e);
        showToast('Error al generar el archivo de exportación.', 'error');
    }
}

function openImportModal() {
    const importTextArea = document.getElementById('importTextArea');
    const importFile = document.getElementById('importFile');
    const importError = document.getElementById('importError');
    if (importTextArea) importTextArea.value = '';
    if (importFile) importFile.value = '';
    if (importError) { importError.textContent = ''; importError.classList.add('hidden'); }
    openModal('importModal');
}

function handleImport() {
    const importMerge = document.getElementById('importMerge');
    const importTextArea = document.getElementById('importTextArea');
    const importFile = document.getElementById('importFile');
    const importError = document.getElementById('importError');
    const merge = importMerge?.checked ?? true;
    let jsonString = importTextArea?.value.trim() || '';
    const file = importFile?.files?.[0];
    if (importError) { importError.textContent = ''; importError.classList.add('hidden'); }
    if (!jsonString && !file) {
        if (importError) { importError.textContent = 'Por favor, pega el JSON o selecciona un archivo.'; importError.classList.remove('hidden'); }
        return;
    }
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try { const fileContent = String(event.target.result || ''); processImport(fileContent, merge); }
            catch (e) { if (importError) { importError.textContent = `Error al leer el archivo: ${e.message}`; importError.classList.remove('hidden'); } }
        };
        reader.onerror = () => { if (importError) { importError.textContent = 'Ocurrió un error al leer el archivo.'; importError.classList.remove('hidden'); } };
        reader.readAsText(file);
    } else {
        processImport(jsonString, merge);
    }
}

function processImport(jsonString, merge) {
    const importError = document.getElementById('importError');
    try {
        const importedData = JSON.parse(jsonString);
        if (!Array.isArray(importedData)) throw new Error('El JSON no es un array válido. La importación fue cancelada.');

        // SECURITY: Sanitizar y validar cada prompt con whitelist
        const valid = importedData
            .map(p => sanitizeImportedPrompt(p))
            .filter(p => p !== null && (p.id || p.nombre || p.promptFinal))
            .map(p => {
                // Validar y normalizar valores
                validatePromptSchema(p);
                return {
                    id: p.id || generateSecureId('prompt'),
                    nombre: String(p.nombre || 'Prompt importado').substring(0, 500),
                    categoria: String(p.categoria || '').substring(0, 100),
                    tags: Array.isArray(p.tags) ? p.tags.filter(t => t && typeof t === 'string').map(t => t.trim().substring(0, 50)).slice(0, 20) : [],
                    municipio: String(p.municipio || '').substring(0, 100),
                    rating: Math.max(0, Math.min(5, Number(p.rating) || 0)),
                    isFavorite: Boolean(p.isFavorite),
                    usageCount: Math.max(0, Number(p.usageCount) || 0),
                    fechaCreacion: p.fechaCreacion || new Date().toISOString(),
                    fechaModificacion: p.fechaModificacion || new Date().toISOString(),
                    rol: String(p.rol || ''),
                    contexto: String(p.contexto || ''),
                    tarea: String(p.tarea || ''),
                    formato: String(p.formato || ''),
                    tono: String(p.tono || ''),
                    restricciones: String(p.restricciones || ''),
                    ejemplo: String(p.ejemplo || ''),
                    promptFinal: String(p.promptFinal || ''),
                    variations: Array.isArray(p.variations) ? p.variations.slice(0, 50) : [],
                    notas: String(p.notas || '')
                };
            });

        if (valid.length === 0) {
            throw new Error('No se encontraron prompts válidos en el JSON.');
        }

        if (valid.length !== importedData.length) {
            showToast(`${importedData.length - valid.length} prompts omitidos por formato inválido o problemas de seguridad.`, 'warning');
        }

        let addedCount = 0; let updatedCount = 0;
        if (merge) {
            valid.forEach(ip => {
                const idx = prompts.findIndex(p => p.id === ip.id);
                if (idx > -1) {
                    if (new Date(ip.fechaModificacion) > new Date(prompts[idx].fechaModificacion)) {
                        prompts[idx] = ip;
                        updatedCount++;
                    }
                } else {
                    prompts.push(ip);
                    addedCount++;
                }
            });
        } else {
            prompts.splice(0, prompts.length, ...valid);
            addedCount = valid.length;
        }

        if (window.savePrompts) window.savePrompts();
        if (window.updateFilterOptions) window.updateFilterOptions();
        if (window.renderLibrary) window.renderLibrary(1);
        closeModal('importModal');
        showToast(`Importación completa: ${addedCount} añadidos, ${updatedCount} actualizados.`, 'success');
    } catch (e) {
        console.error('Error processing import:', e);
        if (importError) { importError.textContent = `Error al procesar el JSON: ${e.message}`; importError.classList.remove('hidden'); }
    }
}




/* --- Start of manage.js --- */

// Gestión de etiquetas, categorías y municipios





function updateMunicipiosSelects() {
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
        if (municipios.includes(currentValue)) promptMunicipioInput.value = currentValue;
    }
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
        if (municipios.includes(currentValue)) filterMunicipio.value = currentValue;
    }
}

function addMunicipio() {
    const newMunicipioInput = document.getElementById('newMunicipioInput');
    const nombre = (newMunicipioInput?.value || '').trim().toUpperCase();
    if (!nombre) { showToast('Por favor, introduce un nombre para el municipio.', 'error'); return; }
    if (municipios.includes(nombre)) { showToast('Este municipio ya existe.', 'error'); return; }
    municipios.push(nombre);
    municipios.sort();
    localStorage.setItem(MUNICIPIOS_KEY, JSON.stringify(municipios));
    updateMunicipiosSelects();
    renderManageMunicipios();
    if (newMunicipioInput) newMunicipioInput.value = '';
    showToast(`Municipio "${nombre}" agregado correctamente.`, 'success');
}

function deleteMunicipio(name) {
    if (!confirm(`¿Estás seguro de eliminar el municipio "${name}"? Se quitará de todos los prompts donde se use.`)) return;
    prompts.forEach(p => { if (p.municipio === name) { p.municipio = ''; p.fechaModificacion = new Date().toISOString(); } });
    const idx = municipios.indexOf(name);
    if (idx > -1) municipios.splice(idx, 1);
    localStorage.setItem(MUNICIPIOS_KEY, JSON.stringify(municipios));
    updateMunicipiosSelects();
    renderManageMunicipios();
    savePrompts();
    showToast(`Municipio "${name}" eliminado.`, 'info');
}

function renderManageMunicipios() {
    const manageMunicipiosList = document.getElementById('manageMunicipiosList');
    if (!manageMunicipiosList) return;
    manageMunicipiosList.innerHTML = '';
    if (municipios.length === 0) {
        manageMunicipiosList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: var(--spacing-lg);">No hay municipios definidos.</p>';
        return;
    }
    const fragment = document.createDocumentFragment();
    municipios.forEach((municipio) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center';
        itemDiv.style.cssText = 'padding: var(--spacing-md); border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--bg-card); margin-bottom: var(--spacing-sm); transition: var(--transition-all);';
        const nameSpan = document.createElement('span');
        nameSpan.style.fontWeight = '500';
        nameSpan.textContent = municipio;
        const actions = document.createElement('div');
        actions.className = 'flex gap-sm';
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-icon btn-sm';
        editBtn.title = 'Renombrar Municipio';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.addEventListener('click', () => openEditTagCatModal(municipio, false, true));
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-icon btn-sm';
        delBtn.style.color = '#f56565';
        delBtn.title = 'Eliminar Municipio';
        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
        delBtn.addEventListener('click', () => deleteMunicipio(municipio));
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        itemDiv.appendChild(nameSpan);
        itemDiv.appendChild(actions);
        fragment.appendChild(itemDiv);
    });
    manageMunicipiosList.appendChild(fragment);
}

function renderManageTagsCategories() {
    renderManageTags();
    renderManageCategories();
    renderManageMunicipios();
}

function renderManageTags() {
    const manageTagsList = document.getElementById('manageTagsList');
    if (!manageTagsList) return;
    const tags = new Set();
    prompts.forEach(p => (p.tags || []).forEach(tag => { if (tag && tag.trim()) tags.add(tag.trim()); }));
    const all = [...tags].sort();
    if (all.length === 0) {
        manageTagsList.innerHTML = '<div class="card" style="text-align: center; padding: var(--spacing-lg);"><p style="color: var(--text-muted);">No hay etiquetas definidas.</p><p style="color: var(--text-muted); font-size: 0.875rem;">Las etiquetas aparecerán aquí cuando crees prompts con etiquetas.</p></div>';
        return;
    }
    manageTagsList.innerHTML = '';
    const fragment = document.createDocumentFragment();
    all.forEach(tag => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center';
        item.style.cssText = 'padding: var(--spacing-md); border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--bg-card); margin-bottom: var(--spacing-sm); transition: var(--transition-all);';
        const nameSpan = document.createElement('span');
        nameSpan.style.fontWeight = '500';
        nameSpan.textContent = tag;
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-icon btn-sm';
        editBtn.title = 'Renombrar Etiqueta';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.addEventListener('click', () => openEditTagCatModal(tag, false, false));
        const actions = document.createElement('div');
        actions.appendChild(editBtn);
        item.appendChild(nameSpan);
        item.appendChild(actions);
        fragment.appendChild(item);
    });
    manageTagsList.appendChild(fragment);
}

function renderManageCategories() {
    const manageCategoriesList = document.getElementById('manageCategoriesList');
    if (!manageCategoriesList) return;
    const categories = new Set();
    prompts.forEach(p => { if (p.categoria && p.categoria.trim()) categories.add(p.categoria.trim()); });
    const all = [...categories].sort();
    if (all.length === 0) {
        manageCategoriesList.innerHTML = '<div class="card" style="text-align: center; padding: var(--spacing-lg);"><p style="color: var(--text-muted);">No hay categorías definidas.</p><p style="color: var(--text-muted); font-size: 0.875rem;">Las categorías aparecerán aquí cuando crees prompts con categorías.</p></div>';
        return;
    }
    manageCategoriesList.innerHTML = '';
    const fragment = document.createDocumentFragment();
    all.forEach(category => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center';
        item.style.cssText = 'padding: var(--spacing-md); border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--bg-card); margin-bottom: var(--spacing-sm); transition: var(--transition-all);';
        const nameSpan = document.createElement('span');
        nameSpan.style.fontWeight = '500';
        nameSpan.textContent = category;
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-icon btn-sm';
        editBtn.title = 'Renombrar Categoría';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.addEventListener('click', () => openEditTagCatModal(category, true, false));
        const actions = document.createElement('div');
        actions.appendChild(editBtn);
        item.appendChild(nameSpan);
        item.appendChild(actions);
        fragment.appendChild(item);
    });
    manageCategoriesList.appendChild(fragment);
}

function openEditTagCatModal(oldValue, isCategory, isMunicipio = false) {
    const editTagCatTypeSpan = document.getElementById('editTagCatType');
    const editTagCatOldValueSpan = document.getElementById('editTagCatOldValue');
    const editTagCatNewValueInput = document.getElementById('editTagCatNewValue');
    const editTagCatIsCategoryInput = document.getElementById('editTagCatIsCategory');
    const editTagCatIsMunicipioInput = document.getElementById('editTagCatIsMunicipio');
    if (editTagCatTypeSpan) editTagCatTypeSpan.textContent = isMunicipio ? 'Municipio' : (isCategory ? 'Categoría' : 'Etiqueta');
    if (editTagCatOldValueSpan) editTagCatOldValueSpan.textContent = oldValue;
    if (editTagCatNewValueInput) editTagCatNewValueInput.value = oldValue;
    if (editTagCatIsCategoryInput) editTagCatIsCategoryInput.value = String(!!isCategory);
    if (editTagCatIsMunicipioInput) editTagCatIsMunicipioInput.value = String(!!isMunicipio);
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
    if (!newValue) { showToast('El nuevo valor no puede estar vacío.', 'error'); return; }
    if (isMunicipio) {
        const index = municipios.indexOf(oldValue);
        if (index > -1) {
            municipios[index] = newValue.toUpperCase();
            municipios.sort();
            localStorage.setItem(MUNICIPIOS_KEY, JSON.stringify(municipios));
            updateMunicipiosSelects();
            prompts.forEach(p => { if (p.municipio === oldValue) { p.municipio = newValue.toUpperCase(); p.fechaModificacion = new Date().toISOString(); } });
            savePrompts();
            renderManageMunicipios();
        }
    } else {
        let modifiedCount = 0;
        prompts.forEach(p => {
            let updated = false;
            if (isCategory) {
                if (p.categoria === oldValue) { p.categoria = newValue; updated = true; }
            } else {
                const tagIndex = (p.tags || []).indexOf(oldValue);
                if (tagIndex > -1) {
                    p.tags[tagIndex] = newValue;
                    p.tags = [...new Set(p.tags)];
                    updated = true;
                }
            }
            if (updated) { p.fechaModificacion = new Date().toISOString(); modifiedCount++; }
        });
        savePrompts();
        if (window.updateFilterOptions) window.updateFilterOptions();
        if (window.renderLibrary) window.renderLibrary(window.currentPage || 1);
        renderManageTagsCategories();
        showToast(`${isCategory ? 'Categoría' : 'Etiqueta'} actualizada en ${modifiedCount} prompts.`, 'success');
    }
    closeModal('editTagCatModal');
}




/* --- Start of ui.js --- */

// UI y renderizado


function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        setTimeout(() => targetSection.classList.add('active'), 10);
    }
    document.querySelectorAll('.nav-tab').forEach(tab => { tab.classList.remove('active'); });
    const activeTab = document.querySelector(`[data-section="${sectionId}"]`);
    if (activeTab) activeTab.classList.add('active');
    setTimeout(() => {
        if (sectionId === 'manageTagsCategoriesSection') { if (window.renderManageTagsCategories) window.renderManageTagsCategories(); }
        else if (sectionId === 'promptLibrarySection') { renderLibrary(currentPage); }
        else if (sectionId === 'exampleGuideSection') { setupAccordion(); }
        else if (sectionId === 'templatesSection') { if (window.renderTemplates) window.renderTemplates(); }
    }, 100);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    // SECURITY: Escapar mensaje para prevenir XSS
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    toast.innerHTML = `
        <i class="icon fas fa-${icon}" aria-hidden="true"></i>
        <span>${escapeHTML(message)}</span>
    `;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    const status = document.getElementById('appStatus');
    if (status) status.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(savedTheme ? savedTheme === 'dark' : !!prefersDark);
    applyTheme();
}

function toggleTheme() {
    setIsDarkMode(!isDarkMode);
    localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
    applyTheme();
}

function applyTheme() {
    const body = document.body;
    const root = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    const themeColor = document.querySelector('meta[name="theme-color"]');
    const icon = themeToggle?.querySelector('i');
    root.dataset.theme = isDarkMode ? 'dark' : 'light';
    root.style.colorScheme = isDarkMode ? 'dark' : 'light';
    if (themeColor) themeColor.setAttribute('content', isDarkMode ? '#1f1f1f' : '#F8FAFC');
    if (isDarkMode) {
        body.classList.add('dark');
        if (icon && themeToggle) {
            icon.className = 'fas fa-sun';
            themeToggle.title = 'Cambiar a modo claro';
            themeToggle.setAttribute('aria-label', 'Cambiar a modo claro');
            themeToggle.setAttribute('aria-pressed', 'true');
        }
    } else {
        body.classList.remove('dark');
        if (icon && themeToggle) {
            icon.className = 'fas fa-moon';
            themeToggle.title = 'Cambiar a modo oscuro';
            themeToggle.setAttribute('aria-label', 'Cambiar a modo oscuro');
            themeToggle.setAttribute('aria-pressed', 'false');
        }
    }
}

function renderLibrary(page = 1) {
    const libraryList = document.getElementById('libraryList');
    if (!libraryList) return;
    // cálculo previo para clamp
    const totalItemsForClamp = getFilteredPrompts().length;
    const totalPagesForClamp = Math.max(1, Math.ceil(totalItemsForClamp / promptsPerPage));
    const clampedPage = Math.max(1, Math.min(page, totalPagesForClamp));
    setCurrentPage(clampedPage);
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
            const message = hasFilters ? 'No hay prompts que coincidan con los filtros aplicados.' : 'No has guardado ningún prompt todavía. ¡Crea uno nuevo!';
            const emptyAction = hasFilters ? '<button type="button" class="btn btn-secondary btn-sm action-clear-empty-filters">Limpiar filtros</button>' : '<button type="button" class="btn btn-primary btn-sm action-empty-create"><i class="fas fa-plus-circle" aria-hidden="true"></i> Crear primer prompt</button>';
            libraryList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search" aria-hidden="true"></i>
                    <p>${message}</p>
                    ${emptyAction}
                </div>`;
            renderPagination(0, 1, 0);
            return;
        }
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
        const totalPages = Math.ceil(sortedPrompts.length / promptsPerPage);
        const startIndex = (clampedPage - 1) * promptsPerPage;
        const endIndex = startIndex + promptsPerPage;
        const promptsToRender = sortedPrompts.slice(startIndex, endIndex);
        const fragment = document.createDocumentFragment();
        promptsToRender.forEach((prompt, index) => {
            const card = createPromptCard(prompt, index);
            fragment.appendChild(card);
        });
        libraryList.appendChild(fragment);
        renderPagination(totalPages, clampedPage, sortedPrompts.length);
        updateExportSelectedButton();
    }, 200);
}

function createPromptCard(prompt, index) {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.dataset.promptId = prompt.id;
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
    requestAnimationFrame(() => { card.style.opacity = '1'; card.style.transform = 'translateY(0)'; });

    const tagsHtml = (prompt.tags || []).length > 0
        ? prompt.tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('')
        : '<span class="text-muted" style="font-style: italic;">Sin etiquetas</span>';

    const starsHtml = Array.from({ length: 5 }, (_, i) => {
        const filled = i < (prompt.rating || 0);
        const color = filled ? '#f4b400' : 'var(--md-sys-color-outline-variant)';
        return `<i class="fas fa-star" style="color: ${color}; font-size: 0.875rem;"></i>`;
    }).join('');

    card.innerHTML = `
        <div class="prompt-card-header">
            <div style="flex: 1; min-width: 0;">
                <div class="flex items-center gap-sm mb-sm">
                    <input type="checkbox" class="prompt-select-checkbox" data-prompt-id="${prompt.id}" aria-label="Seleccionar prompt ${escapeHTML(prompt.nombre)}" style="margin: 0;">
                    <h3 class="prompt-card-title" style="flex: 1; min-width: 0;">${escapeHTML(prompt.nombre)}</h3>
                    <button type="button" class="btn btn-icon btn-sm favorite-toggle" aria-label="${prompt.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}" title="${prompt.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}" style="color: ${prompt.isFavorite ? '#ef4444' : 'var(--md-sys-color-on-surface-variant)'}; width: 32px; height: 32px;">
                        <i class="fas fa-heart ${prompt.isFavorite ? 'active' : ''}" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="rating" style="margin-bottom: 8px;">${starsHtml}</div>
            </div>
        </div>
        <div class="prompt-card-meta">
            ${prompt.categoria ? `<span><i class="fas fa-folder" style="margin-right: 4px;"></i>${escapeHTML(prompt.categoria)}</span>` : ''}
            ${prompt.municipio ? `<span><i class="fas fa-map-marker-alt" style="margin-right: 4px;"></i>${escapeHTML(prompt.municipio)}</span>` : ''}
            <span><i class="fas fa-calendar" style="margin-right: 4px;"></i>${formatDate(prompt.fechaModificacion)}</span>
            <span><i class="fas fa-copy" style="margin-right: 4px;"></i>Usado ${prompt.usageCount || 0} veces</span>
        </div>
        ${prompt.promptFinal ? `
            <div style="margin: 16px 0;">
                <div class="bg-secondary-container text-muted" style="max-height: 60px; overflow: hidden; position: relative; font-size: 0.875rem;">
                    ${escapeHTML(prompt.promptFinal.substring(0, 150))}${prompt.promptFinal.length > 150 ? '…' : ''}
                </div>
            </div>` : ''}
        <div class="prompt-card-actions" style="display: flex; justify-content: space-between; gap: 8px; align-items: center;">
            <button class="btn btn-primary btn-sm action-copy-text" title="Copiar al portapapeles"><i class="fas fa-copy" aria-hidden="true"></i> Copiar</button>
            <div class="dropdown">
                <!-- A11Y: ARIA labels para accesibilidad -->
                <button class="btn btn-icon dropdown-toggle" title="Más opciones del prompt" 
                        aria-label="Más opciones del prompt" aria-haspopup="true" aria-expanded="false"
                        style="width: 32px; height: 32px;"><i class="fas fa-ellipsis-v" aria-hidden="true"></i></button>
                <div class="dropdown-menu">
                    <button class="dropdown-item action-edit"><i class="fas fa-edit" aria-hidden="true"></i> Editar</button>
                    <button class="dropdown-item action-preview"><i class="fas fa-eye" aria-hidden="true"></i> Previsualizar</button>
                    <button class="dropdown-item action-duplicate"><i class="fas fa-clone" aria-hidden="true"></i> Duplicar</button>
                    <div style="border-top: 1px solid var(--md-sys-color-outline-variant); margin: 4px 0;"></div>
                    <button class="dropdown-item action-delete text-danger"><i class="fas fa-trash-alt" aria-hidden="true"></i> Eliminar</button>
                </div>
            </div>
        </div>`;
    return card;
}

function renderPagination(totalPages, currentPage, totalItems) {
    const paginationContainer = document.getElementById('libraryPagination');
    if (!paginationContainer) return;
    if (totalPages <= 1) {
        paginationContainer.innerHTML = totalItems > 0 ? `<div class="pagination-info" style="text-align: center; color: var(--text-muted);">Mostrando todos los ${totalItems} prompts</div>` : '';
        return;
    }
    let html = `
        <button class="pagination-btn action-prev" ${currentPage <= 1 ? 'disabled' : ''} title="Página anterior" aria-label="Página anterior"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
        <button class="pagination-btn action-first" ${currentPage === 1 ? 'disabled' : ''} title="Primera página" aria-label="Primera página"><i class="fas fa-angle-double-left" aria-hidden="true"></i></button>`;
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    if (startPage > 1) html += `<span class="pagination-info">…</span>`;
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn page-link ${i === currentPage ? 'active' : ''}" data-page="${i}" title="Página ${i}" aria-label="Ir a página ${i}">${i}</button>`;
    }
    if (endPage < totalPages) html += `<span class="pagination-info">…</span>`;
    html += `
        <button class="pagination-btn action-last" ${currentPage === totalPages ? 'disabled' : ''} title="Última página" aria-label="Última página"><i class="fas fa-angle-double-right" aria-hidden="true"></i></button>
        <button class="pagination-btn action-next" ${currentPage >= totalPages ? 'disabled' : ''} title="Página siguiente" aria-label="Página siguiente"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
        <div class="pagination-info" style="margin-left: auto;">Página ${currentPage} de ${totalPages} (${totalItems} prompts)</div>`;
    paginationContainer.innerHTML = html;
}

function updateExportSelectedButton() {
    const exportSelectedBtn = document.getElementById('exportSelectedBtn');
    if (exportSelectedBtn) {
        exportSelectedBtn.disabled = selectedPromptIds.size === 0;
        exportSelectedBtn.title = selectedPromptIds.size === 0 ? 'Selecciona prompts para exportar' : `Exportar ${selectedPromptIds.size} prompts seleccionados`;
    }
}

function checkBackupReminder() {
    const backupReminder = document.getElementById('backupReminder');
    if (!backupReminder) return;
    const lastExport = localStorage.getItem(LAST_EXPORT_KEY);
    const REMINDER_SHOWN_KEY = 'gestor_backup_reminder_shown';

    const showReminderFocus = () => {
        // IMPROVEMENT: Usar localStorage con timestamp en lugar de sessionStorage
        const lastShown = localStorage.getItem(REMINDER_SHOWN_KEY);
        const now = Date.now();
        // Solo mostrar foco si no se mostró en las últimas 24 horas
        const showAgainAfter = 24 * 60 * 60 * 1000; // 24 horas
        if (!lastShown || (now - parseInt(lastShown, 10)) > showAgainAfter) {
            setTimeout(() => {
                const btn = document.getElementById('backupExportBtn');
                if (btn) btn.focus();
                localStorage.setItem(REMINDER_SHOWN_KEY, String(now));
            }, 300);
        }
    };

    if (!lastExport) {
        backupReminder.style.display = 'block';
        showReminderFocus();
        return;
    }
    const daysSince = (new Date() - new Date(lastExport)) / (1000 * 60 * 60 * 24);
    const shouldShow = daysSince > BACKUP_REMINDER_DAYS;
    backupReminder.style.display = shouldShow ? 'block' : 'none';
    if (shouldShow) {
        showReminderFocus();
    }
}

function toggleAccordionItem(item, forceOpen) {
    const content = item?.querySelector('.accordion-content');
    const header = item?.querySelector('.accordion-header');
    if (!item || !content || !header) return;
    const isOpen = typeof forceOpen === 'boolean' ? forceOpen : !item.classList.contains('open');
    item.classList.toggle('open', isOpen);
    content.style.display = isOpen ? 'block' : 'none';
    header.setAttribute('aria-expanded', String(isOpen));
}

function setupAccordion() {
    document.querySelectorAll('.accordion-item').forEach((item, index) => {
        const header = item.querySelector('.accordion-header');
        const content = item.querySelector('.accordion-content');
        if (!header || !content) return;
        const contentId = content.id || `guideAccordionPanel${index + 1}`;
        content.id = contentId;
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-controls', contentId);
        header.setAttribute('aria-expanded', String(item.classList.contains('open')));
    });
}

function expandAllAccordion() {
    document.querySelectorAll('.accordion-item').forEach(item => toggleAccordionItem(item, true));
}

function collapseAllAccordion() {
    document.querySelectorAll('.accordion-item').forEach(item => toggleAccordionItem(item, false));
}

function setupAutoResize() {
    const textareas = document.querySelectorAll('.auto-resize');
    const resize = (el) => {
        el.style.height = 'auto';
        const newHeight = Math.min(600, el.scrollHeight);
        el.style.height = newHeight + 'px';
        el.style.overflowY = el.scrollHeight > 600 ? 'auto' : 'hidden';
    };
    let rafId = null;
    textareas.forEach(textarea => {
        const onInput = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => resize(textarea));
        };
        textarea.addEventListener('input', onInput, { passive: true });
        resize(textarea);
    });
}

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
            if (!(nameMatch || categoryMatch || tagsMatch || municipioMatch || contentMatch)) return false;
        }
        return true;
    });
}

function updateFilterOptions() {
    updateCategoryFilter();
    updateTagFilter();
}

function updateCategoryFilter() {
    const filterCategory = document.getElementById('filterCategory');
    if (!filterCategory) return;
    const categories = new Set();
    prompts.forEach(p => { if (p.categoria) categories.add(p.categoria); });
    const originalValue = filterCategory.value;
    filterCategory.innerHTML = '<option value="">Todas las categorías</option>';
    [...categories].sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category; option.textContent = category; filterCategory.appendChild(option);
    });
    if ([...filterCategory.options].some(opt => opt.value === originalValue)) filterCategory.value = originalValue;
}

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
            option.value = tag; option.textContent = tag; filterTag.appendChild(option);
        });
    }
    if ([...filterTag.options].some(opt => opt.value === originalValue)) filterTag.value = originalValue; else filterTag.value = '';
}

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
            if (q.trim().length < 2 || matches.length === 0) { closeTemplatesAutocompleteMenu(category); return; }
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
            menuEl.querySelectorAll('.ac-item').forEach((node) => { node.classList.remove('ac-active'); });
            const active = menuEl.querySelector(`.ac-item[data-index="${activeIndex}"]`);
            if (active) { active.classList.add('ac-active'); active.scrollIntoView({ block: 'nearest' }); }
        };
        // PERFORMANCE: Usar debounce para evitar llamadas excesivas
        const debouncedOpenMenu = debounce(() => {
            if (!templates.some(t => t.category === category)) { closeTemplatesAutocompleteMenu(category); return; }
            openMenu();
        }, 150);
        field.addEventListener('input', debouncedOpenMenu);
        field.addEventListener('focus', () => { if (templates.some(t => t.category === category)) openMenu(); });
        field.addEventListener('keydown', (e) => {
            const menu = document.getElementById(`acTpl-${category}`);
            if (!menu) return;
            const items = menu.querySelectorAll('.ac-item');
            if (e.key === 'ArrowDown') { e.preventDefault(); if (!items.length) return; categoryToActiveIndex[category] = Math.min((categoryToActiveIndex[category] || 0) + 1, items.length - 1); highlightActiveItem(menu, categoryToActiveIndex[category]); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); if (!items.length) return; categoryToActiveIndex[category] = Math.max((categoryToActiveIndex[category] || 0) - 1, 0); highlightActiveItem(menu, categoryToActiveIndex[category]); }
            else if (e.key === 'Enter') { const activeIdx = categoryToActiveIndex[category] || 0; const activeEl = menu.querySelector(`.ac-item[data-index="${activeIdx}"]`); if (activeEl) { e.preventDefault(); const idx = parseInt(activeEl.dataset.index, 10); const q = field.value; const matches = filterTemplatesForAutocomplete(category, q); const selected = matches[idx]; if (selected) { applyTemplateToForm(selected); closeTemplatesAutocompleteMenu(category); field.focus(); } } }
            else if (e.key === 'Escape') { closeTemplatesAutocompleteMenu(category); }
        });
        const repositionMenu = () => {
            const menu = document.getElementById(`acTpl-${category}`);
            if (menu && field === document.activeElement) {
                const rect = field.getBoundingClientRect();
                menu.style.top = `${window.scrollY + rect.bottom + 6}px`;
                menu.style.left = `${window.scrollX + rect.left}px`;
            }
        };
        window.addEventListener('scroll', debounce(repositionMenu), { passive: true });
        window.addEventListener('resize', debounce(repositionMenu));
    });
}

function createOrUpdateTemplatesAutocompleteMenu(category, anchorElement, matchedTemplates, onSelect) {
    const menuId = `acTpl-${category}`;
    let menu = document.getElementById(menuId);
    if (!menu) {
        menu = document.createElement('div');
        menu.id = menuId;
        menu.className = 'template-autocomplete-menu';
        document.body.appendChild(menu);
    }
    menu.innerHTML = '';

    // Header section
    const header = document.createElement('div');
    header.className = 'template-autocomplete-header';
    const categoryLabel = category === 'role' ? 'Roles' : category === 'tone' ? 'Tonos' : 'Restricciones';
    header.innerHTML = `<i class="fas fa-magic"></i><span>Sugerencias de ${categoryLabel}</span>`;
    menu.appendChild(header);

    // List container
    const listContainer = document.createElement('div');
    listContainer.className = 'template-autocomplete-list';

    if (matchedTemplates.length > 0) {
        matchedTemplates.forEach((tpl, index) => {
            const item = document.createElement('div');
            item.className = 'template-autocomplete-item ac-item';
            item.dataset.index = String(index);
            const title = escapeHTML(tpl.name || (tpl.text.substring(0, 50) + (tpl.text.length > 50 ? '…' : '')));
            const preview = escapeHTML(tpl.text);
            const usageCount = tpl.usageCount || 0;
            item.innerHTML = `
                <div class="template-autocomplete-item-content">
                    <div class="template-autocomplete-item-title">${title}</div>
                    <div class="template-autocomplete-item-text">${preview}</div>
                </div>
                <div class="template-autocomplete-item-meta">
                    <span class="template-autocomplete-item-usage">${usageCount} usos</span>
                </div>`;
            item.addEventListener('click', () => onSelect(tpl));
            listContainer.appendChild(item);
        });
    }
    menu.appendChild(listContainer);

    // Position the menu
    const rect = anchorElement.getBoundingClientRect();
    const menuWidth = Math.min(rect.width, 480);
    menu.style.top = `${window.scrollY + rect.bottom + 8}px`;
    menu.style.left = `${window.scrollX + rect.left}px`;
    menu.style.width = `${menuWidth}px`;

    // Close on click outside
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
        return source.slice().sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 8);
    }
    const filtered = source.filter(t => (t.name && t.name.toLowerCase().includes(norm)) || (t.text && t.text.toLowerCase().includes(norm)));
    return filtered.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 8);
}

let lastModalTrigger = null;

function getFocusableElements(container) {
    return [...container.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(el => el.offsetParent !== null || el === document.activeElement);
}

function openModal(modalId) {
    const m = document.getElementById(modalId);
    if (!m) return;
    lastModalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const content = m.querySelector('.modal-content');
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-hidden', 'false');
    if (content) content.setAttribute('tabindex', '-1');
    m.style.display = 'flex';
    setTimeout(() => {
        m.classList.add('show');
        const firstFocusable = getFocusableElements(m)[0];
        (firstFocusable || content || m).focus?.();
    }, 10);
}

function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (!m) return;
    m.classList.remove('show');
    m.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
        m.style.display = 'none';
        if (lastModalTrigger?.isConnected) lastModalTrigger.focus();
    }, 300);
}

function maybeBootstrapTemplatesFromBundledJson() { if (window && window.maybeBootstrapTemplatesFromBundledJson) { window.maybeBootstrapTemplatesFromBundledJson(); } }




/* --- Start of templates.js --- */

// Lógica específica de plantillas






function addTemplate(category, name, text) {
    const cleanText = (text || '').trim();
    if (!cleanText) { showToast('El texto de la plantilla no puede estar vacío.', 'error'); return false; }
    if (templateExists(category, cleanText)) { showToast('Esta plantilla ya existe.', 'warning'); return false; }
    const now = new Date().toISOString();
    // SECURITY: Usar ID criptográficamente seguro
    const tpl = { id: generateSecureId('tpl'), category, name: (name || '').trim(), text: cleanText, createdAt: now, updatedAt: now, usageCount: 0 };
    templates.push(tpl);
    showToast('Plantilla añadida.', 'success');
    return true;
}

function templateExists(category, text) {
    const key = normalizeTextForKey(text);
    return templates.some(t => t.category === category && normalizeTextForKey(t.text) === key);
}

function normalizeTextForKey(text) { return (text || '').toLowerCase().trim().replace(/\s+/g, ' '); }

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

function updateTemplate(id, name, text) {
    const idx = templates.findIndex(t => t.id === id);
    if (idx === -1) return;
    const cleanText = (text || '').trim();
    if (!cleanText) { showToast('El texto de la plantilla no puede estar vacío.', 'error'); return; }
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

function applyTemplateToForm(template) {
    const modeReplace = document.getElementById('templateApplyModeReplace')?.checked ?? true;
    let targetId = null;
    if (template.category === 'role') targetId = 'promptRole';
    if (template.category === 'tone') targetId = 'promptTone';
    if (template.category === 'constraint') targetId = 'promptConstraints';
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) { showToast('No se encontró el campo de destino en el formulario.', 'error'); return; }
    if (modeReplace || !target.value) {
        target.value = template.text;
    } else {
        const joiner = target.value.endsWith('\n') ? '' : '\n';
        target.value = target.value + joiner + template.text;
    }
    showSection('createPromptSection');
    target.dispatchEvent(new Event('input'));
    const idx = templates.findIndex(t => t.id === template.id);
    if (idx > -1) {
        templates[idx].usageCount = (templates[idx].usageCount || 0) + 1;
        templates[idx].updatedAt = new Date().toISOString();
        saveTemplates();
        renderTemplates();
    }
    showToast('Plantilla aplicada al formulario.', 'success');
}

function renderTemplates() {
    const rolesList = document.getElementById('rolesTemplatesList');
    const tonesList = document.getElementById('tonesTemplatesList');
    const constraintsList = document.getElementById('constraintsTemplatesList');
    if (!rolesList || !tonesList || !constraintsList) return;
    const createItem = (tpl) => {
        const div = document.createElement('div');
        div.className = 'template-item';
        const safeName = escapeHTML(tpl.name || '');
        const safeText = escapeHTML(tpl.text);
        const title = safeName ? `${safeName}` : `${safeText.substring(0, 40)}${tpl.text.length > 40 ? '…' : ''}`;
        div.innerHTML = `
            <div style="flex:1; min-width:0;">
                <div class="template-title">${title}</div>
                <div class="template-text">${safeText}</div>
                <div class="text-muted" style="font-size: 0.75rem; margin-top: 4px;">Usos: ${tpl.usageCount || 0}</div>
            </div>
            <div class="flex gap-sm" style="margin-left: 16px; align-items: center;">
                <button class="btn btn-success btn-sm action-apply" title="Aplicar al formulario" aria-label="Aplicar plantilla al formulario"><i class="fas fa-check" aria-hidden="true"></i></button>
                <button class="btn btn-secondary btn-sm action-copy" title="Copiar texto" aria-label="Copiar texto de plantilla"><i class="fas fa-copy" aria-hidden="true"></i></button>
                <div class="dropdown">
                    <!-- A11Y: ARIA labels para accesibilidad -->
                    <button class="btn btn-icon dropdown-toggle" title="Opciones de plantilla" 
                            aria-label="Opciones de plantilla" aria-haspopup="true" aria-expanded="false"
                            style="width: 32px; height: 32px;"><i class="fas fa-ellipsis-v" aria-hidden="true"></i></button>
                    <div class="dropdown-menu">
                         <button class="dropdown-item action-preview"><i class="fas fa-eye"></i> Previsualizar</button>
                         <button class="dropdown-item action-edit"><i class="fas fa-edit"></i> Editar</button>
                         <div style="border-top: 1px solid var(--md-sys-color-outline-variant); margin: 4px 0;"></div>
                         <button class="dropdown-item action-delete text-danger"><i class="fas fa-trash-alt"></i> Eliminar</button>
                    </div>
                </div>
            </div>`;
        const applyBtn = div.querySelector('.action-apply');
        const copyBtn = div.querySelector('.action-copy');
        const previewBtn = div.querySelector('.action-preview');
        const editBtn = div.querySelector('.action-edit');
        const delBtn = div.querySelector('.action-delete');

        applyBtn.addEventListener('click', () => applyTemplateToForm(tpl));
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(tpl.text).then(() => showToast('Texto de plantilla copiado', 'success'));
        });
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
        list.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || new Date(b.updatedAt) - new Date(a.updatedAt));
        const fragment = document.createDocumentFragment();
        list.forEach(t => fragment.appendChild(createItem(t)));
        container.appendChild(fragment);
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
    ['role', 'tone', 'constraint'].forEach(cat => {
        const entries = Object.values(counters[cat]);
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

async function maybeBootstrapTemplatesFromBundledJson() {
    if (templates.length > 0) return;
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
        // ignore
    }
}




/* --- Start of prompts.js --- */

// Lógica de prompts (CRUD, preview, formulario)





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

function generateFinalPromptUI() {
    const finalPrompt = generateFinalPrompt();
    const promptFinalDisplay = document.getElementById('promptFinalDisplay');
    if (promptFinalDisplay) promptFinalDisplay.innerHTML = escapeHTML(finalPrompt);
    updatePromptQualityMetrics();
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
        elements.promptFavoriteIcon.className = 'far fa-heart favorite-toggle';
        elements.promptFavoriteIcon.style.color = 'var(--text-muted)';
    }
    if (elements.promptFinalDisplay) elements.promptFinalDisplay.innerHTML = 'El prompt generado aparecerá aquí…';
    if (elements.variationsList) elements.variationsList.innerHTML = '';
    if (elements.formMetaInfo) elements.formMetaInfo.classList.add('hidden');
    if (elements.savePromptBtn) elements.savePromptBtn.innerHTML = '<i class="fas fa-save"></i> Guardar en Biblioteca';
    if (elements.autosaveStatus) elements.autosaveStatus.innerHTML = '';
    setupRating(0);
    updatePromptQualityMetrics();
}

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
    if (elements.promptFavorite) elements.promptFavorite.checked = !!prompt.isFavorite;
    if (elements.promptFavoriteIcon) {
        elements.promptFavoriteIcon.className = prompt.isFavorite ? 'fas fa-heart favorite-toggle active' : 'far fa-heart favorite-toggle';
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
    if (elements.promptUsageCount) elements.promptUsageCount.textContent = String(prompt.usageCount || 0);
    if (elements.formMetaInfo) elements.formMetaInfo.classList.remove('hidden');
    if (elements.savePromptBtn) elements.savePromptBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar en Biblioteca';
    setupRating(prompt.rating || 0);
    updatePromptQualityMetrics();

    // Populate variations
    const variationsList = document.getElementById('variationsList');
    if (variationsList) {
        variationsList.innerHTML = '';
        if (prompt.variations && Array.isArray(prompt.variations)) {
            prompt.variations.forEach(v => addVariationToDom(v));
        }
    }
}

function viewPrompt(id) { const prompt = prompts.find(p => p.id === id); if (!prompt) return; populateForm(prompt); showSection('createPromptSection'); }

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
    if (copyBtn) { copyBtn.onclick = () => copyFinalPromptWrapper(id); }
    if (fillBtn) { fillBtn.onclick = () => openPlaceholderModal(prompt.promptFinal || '', id); }
    if (editBtn) { editBtn.onclick = () => { closeModal('previewPromptModal'); viewPrompt(id); }; }
    openModal('previewPromptModal');
}

function openDeleteModal(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;
    const nameSpan = document.getElementById('deletePromptName');
    if (nameSpan) { nameSpan.textContent = prompt.nombre || ''; nameSpan.dataset.promptId = id; }
    openModal('deleteConfirmModal');
}

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

function copyFinalPromptWrapper(id) {
    let textToCopy; let promptIdForUsage = id;
    if (id) {
        const prompt = prompts.find(p => p.id === id);
        if (!prompt) return;
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

let originalPlaceholderText = '';

function detectPlaceholders(text) { const regex = /\[([^\]]+)\]/g; let match; const found = new Set(); while ((match = regex.exec(text)) !== null) found.add(match[1].trim()); return Array.from(found); }

function openPlaceholderModal(text, promptId = null) {
    originalPlaceholderText = text;
    const placeholderModal = document.getElementById('placeholderModal');
    if (placeholderModal) { placeholderModal.dataset.promptId = promptId || ''; }
    const placeholders = detectPlaceholders(text);
    if (placeholders.length === 0) {
        navigator.clipboard.writeText(text || '');
        if (promptId) incrementUsageCount(promptId);
        showToast('¡Prompt final copiado!', 'success');
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
                <input type="text" id="${phId}" name="${escapeHTML(ph)}" class="form-input placeholder-input">`;
            placeholderForm.appendChild(div);
            div.querySelector('input').addEventListener('input', updatePlaceholderPreview);
        });
    }
    updatePlaceholderPreview();
    openModal('placeholderModal');
    setTimeout(() => { const firstInput = placeholderForm?.querySelector('input'); if (firstInput) firstInput.focus(); }, 300);
}

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
    const finalPreview = document.getElementById('finalPlaceholderTextPreview');
    if (finalPreview) finalPreview.textContent = previewText;
}

function fillAndCopyPlaceholders() {
    const finalPreview = document.getElementById('finalPlaceholderTextPreview');
    const placeholderModal = document.getElementById('placeholderModal');
    if (!finalPreview || !placeholderModal) return;
    const finalText = finalPreview.textContent;
    const promptId = placeholderModal.dataset.promptId;
    navigator.clipboard.writeText(finalText || '');
    showToast('¡Prompt rellenado y copiado!', 'success');
    if (promptId) incrementUsageCount(promptId);
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
        if (librarySection?.classList.contains('active')) renderLibrary(currentPage);
    }
}

function toggleFavoriteById(id, iconEl) {
    const index = prompts.findIndex(p => p.id === id);
    if (index > -1) {
        prompts[index].isFavorite = !prompts[index].isFavorite;
        prompts[index].fechaModificacion = new Date().toISOString();
        savePrompts();
        const isFav = prompts[index].isFavorite;
        if (iconEl) {
            const icon = iconEl.matches?.('i') ? iconEl : iconEl.querySelector?.('i');
            if (icon) icon.className = isFav ? 'fas fa-heart active' : 'fas fa-heart';
            iconEl.style.color = isFav ? '#ef4444' : 'var(--text-muted)';
            iconEl.title = isFav ? 'Quitar de favoritos' : 'Marcar como favorito';
            iconEl.setAttribute?.('aria-label', isFav ? 'Quitar de favoritos' : 'Marcar como favorito');
        }
        const filterFavorite = document.getElementById('filterFavorite');
        if (filterFavorite?.checked) renderLibrary(currentPage);
    }
}

function handleFormSubmit() {
    const promptId = document.getElementById('promptId')?.value;
    const isUpdating = !!promptId;
    const now = new Date().toISOString();
    const nameInput = document.getElementById('promptName');
    const categoryInput = document.getElementById('promptCategory');
    const tagsInput = document.getElementById('promptTags');
    const municipioInput = document.getElementById('promptMunicipio');
    const ratingValueInput = document.getElementById('promptRatingValue');
    const favoriteCheckbox = document.getElementById('promptFavorite');
    const roleInput = document.getElementById('promptRole');
    const contextInput = document.getElementById('promptContext');
    const taskInput = document.getElementById('promptTask');
    const formatInput = document.getElementById('promptFormat');
    const toneInput = document.getElementById('promptTone');
    const constraintsInput = document.getElementById('promptConstraints');
    const exampleInput = document.getElementById('promptExample');
    const notesInput = document.getElementById('promptNotes');
    const finalDisplay = document.getElementById('promptFinalDisplay');
    const taskText = (taskInput?.value || '').trim();
    let finalPrompt = (finalDisplay?.textContent || '').trim();
    if (!taskText && !finalPrompt) {
        showToast("Define la 'Tarea' o escribe un 'Prompt Final'.", 'error');
        if (taskInput) taskInput.focus();
        return;
    }
    if (!finalPrompt) {
        const generated = generateFinalPrompt();
        if (!generated) { showToast('El prompt final no puede estar vacío.', 'error'); if (finalDisplay) finalDisplay.focus(); return; }
        finalPrompt = generated;
    }
    const currentPromptData = isUpdating ? prompts.find(p => p.id === promptId) : {};
    // SECURITY: Usar ID criptográficamente seguro y clampar rating
    const ratingValue = Math.max(0, Math.min(5, parseInt(ratingValueInput?.value) || 0));
    const data = {
        id: promptId || generateSecureId('prompt'),
        nombre: nameInput?.value.trim() || 'Prompt sin nombre',
        categoria: categoryInput?.value.trim() || '',
        tags: tagsInput?.value.split(',').map(t => t.trim()).filter(Boolean) || [],
        municipio: municipioInput?.value.trim() || '',
        rating: ratingValue,
        isFavorite: favoriteCheckbox?.checked || false,
        usageCount: currentPromptData?.usageCount || 0,
        fechaCreacion: currentPromptData?.fechaCreacion || now,
        fechaModificacion: now,
        rol: roleInput?.value.trim() || '',
        contexto: contextInput?.value.trim() || '',
        tarea: taskText,
        formato: formatInput?.value.trim() || '',
        tono: toneInput?.value.trim() || '',
        restricciones: constraintsInput?.value.trim() || '',
        ejemplo: exampleInput?.value.trim() || '',
        promptFinal: finalPrompt,
        variations: getFormData().variations,
        notas: notesInput?.value.trim() || ''
    };
    if (isUpdating) {
        const index = prompts.findIndex(p => p.id === promptId);
        if (index > -1) prompts[index] = data; else prompts.push(data);
    } else { prompts.push(data); }
    savePrompts();
    updateFilterOptions();
    renderLibrary(currentPage);
    showSection('promptLibrarySection');
    showToast(`Prompt "${data.nombre}" ${isUpdating ? 'actualizado' : 'guardado'} correctamente.`, 'success');
    clearForm();
}

function duplicatePrompt(id) {
    const original = prompts.find(p => p.id === id);
    if (!original) return;
    const now = new Date().toISOString();
    const copy = JSON.parse(JSON.stringify(original));
    // SECURITY: Usar ID criptográficamente seguro
    copy.id = generateSecureId('prompt');
    copy.nombre = `${original.nombre} (Copia)`;
    copy.fechaCreacion = now; copy.fechaModificacion = now; copy.usageCount = 0;
    prompts.push(copy);
    savePrompts();
    renderLibrary(currentPage);
    updateFilterOptions();
    showToast(`Prompt duplicado como "${copy.nombre}".`, 'success');
}

function addVariation() {
    const input = document.getElementById('newVariationName');
    const list = document.getElementById('variationsList');
    if (!input || !list) return;

    const name = input.value.trim();
    if (!name) {
        showToast('El nombre de la variación no puede estar vacío', 'error');
        return;
    }

    addVariationToDom({ name, content: '' }); // Content could be captured if we had a field for it
    input.value = '';
    triggerAutosave();
}

function addVariationToDom(variation) {
    const list = document.getElementById('variationsList');
    if (!list) return;

    const div = document.createElement('div');
    div.className = 'variation-item flex justify-between items-center p-sm mb-sm bg-card border rounded';
    div.dataset.name = variation.name;
    div.dataset.content = variation.content || '';

    div.innerHTML = `
        <span class="font-medium">${escapeHTML(variation.name)}</span>
        <button type="button" class="btn btn-icon btn-sm text-danger action-remove-variation" aria-label="Eliminar variación ${escapeHTML(variation.name)}">
            <i class="fas fa-trash" aria-hidden="true"></i>
        </button>
    `;
    const removeBtn = div.querySelector('.action-remove-variation');
    removeBtn?.addEventListener('click', () => {
        div.remove();
        triggerAutosave();
        updatePromptQualityMetrics();
    });
    list.appendChild(div);
    updatePromptQualityMetrics();
}

const triggerAutosave = debounce(() => {
    const data = getFormData();
    if (data.nombre === 'Prompt sin nombre' && !data.tarea && !data.promptFinal) return; // Don't save empty state

    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
    const status = document.getElementById('autosave-status');
    if (status) {
        status.textContent = 'Guardado en borrador…';
        setTimeout(() => status.textContent = '', 2000);
    }
}, 1000);

function loadAutosave() {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (!saved) return;

    try {
        const data = JSON.parse(saved);
        // Simple check to see if it's worth restoring (not empty)
        if (data.nombre || data.tarea || data.promptFinal) {
            // Optional: Ask user? For now, we can just log or provide a "Restore" button. 
            // Or just silently not restore to avoid overwriting current work if they opened a prompt.
            // A better UX is to check if the form is empty, if so, restore.
            const nameInput = document.getElementById('promptName');
            if (nameInput && !nameInput.value) {
                populateForm(data);
                showToast('Borrador restaurado', 'info');
            }
        }
    } catch (e) {
        console.error('Error loading autosave', e);
    }
}

function getFormData() {
    const promptId = document.getElementById('promptId')?.value;
    const nameInput = document.getElementById('promptName');
    const categoryInput = document.getElementById('promptCategory');
    const tagsInput = document.getElementById('promptTags');
    const municipioInput = document.getElementById('promptMunicipio');
    const ratingValueInput = document.getElementById('promptRatingValue');
    const favoriteCheckbox = document.getElementById('promptFavorite');
    const roleInput = document.getElementById('promptRole');
    const contextInput = document.getElementById('promptContext');
    const taskInput = document.getElementById('promptTask');
    const formatInput = document.getElementById('promptFormat');
    const toneInput = document.getElementById('promptTone');
    const constraintsInput = document.getElementById('promptConstraints');
    const exampleInput = document.getElementById('promptExample');
    const notesInput = document.getElementById('promptNotes');
    const finalDisplay = document.getElementById('promptFinalDisplay');

    const variationsList = document.getElementById('variationsList');
    const variations = [];
    if (variationsList) {
        variationsList.querySelectorAll('.variation-item').forEach(item => {
            variations.push({
                name: item.dataset.name,
                content: item.dataset.content
            });
        });
    }

    return {
        id: promptId,
        nombre: nameInput?.value.trim() || 'Prompt sin nombre',
        categoria: categoryInput?.value.trim() || '',
        tags: tagsInput?.value.split(',').map(t => t.trim()).filter(Boolean) || [],
        municipio: municipioInput?.value.trim() || '',
        rating: parseInt(ratingValueInput?.value) || 0,
        isFavorite: favoriteCheckbox?.checked || false,
        rol: roleInput?.value.trim() || '',
        contexto: contextInput?.value.trim() || '',
        tarea: taskInput?.value.trim() || '',
        formato: formatInput?.value.trim() || '',
        tono: toneInput?.value.trim() || '',
        restricciones: constraintsInput?.value.trim() || '',
        ejemplo: exampleInput?.value.trim() || '',
        promptFinal: (finalDisplay?.textContent || '').trim(),
        variations: variations,
        notas: notesInput?.value.trim() || ''
    };
}


function updatePromptQualityMetrics() {
    const container = document.getElementById('promptQualityMetrics');
    if (!container) return;
    const data = getFormData();
    const finalText = data.promptFinal && data.promptFinal !== 'El prompt generado aparecerá aquí…' ? data.promptFinal : generateFinalPrompt();
    const words = finalText ? finalText.trim().split(/\s+/).filter(Boolean).length : 0;
    const chars = finalText.length;
    const placeholders = detectPlaceholders(finalText).length;
    const completed = ['rol', 'contexto', 'tarea', 'formato', 'tono', 'restricciones', 'ejemplo'].filter(key => data[key]).length;
    const score = Math.round((completed / 7) * 100);
    container.innerHTML = `
        <span class="quality-pill ${score >= 70 ? 'strong' : ''}"><i class="fas fa-gauge-high" aria-hidden="true"></i>${score}% completo</span>
        <span class="quality-pill"><i class="fas fa-align-left" aria-hidden="true"></i>${words} palabras</span>
        <span class="quality-pill"><i class="fas fa-keyboard" aria-hidden="true"></i>${chars} caracteres</span>
        <span class="quality-pill"><i class="fas fa-brackets-curly" aria-hidden="true"></i>${placeholders} placeholders</span>
    `;
}


/* --- Start of events.js --- */

// Centralización de eventos y delegación




function setupEventListeners() {
    // Navegación por tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = tab.getAttribute('data-section');
            if (sectionId) showSection(sectionId);
        });
    });

    // Filtros
    const searchLibraryInput = document.getElementById('searchLibraryInput');
    const filterCategory = document.getElementById('filterCategory');
    const filterTag = document.getElementById('filterTag');
    const filterFavorite = document.getElementById('filterFavorite');
    const filterMunicipio = document.getElementById('filterMunicipio');
    const sortLibrarySelect = document.getElementById('sortLibrarySelect');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (searchLibraryInput) {
        const debounce = (fn, d = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); }; };
        searchLibraryInput.addEventListener('input', debounce(() => renderLibrary(1), 250));
    }
    if (filterCategory) filterCategory.addEventListener('change', () => { updateTagFilter(); renderLibrary(1); });
    if (filterTag) filterTag.addEventListener('change', () => renderLibrary(1));
    if (filterFavorite) filterFavorite.addEventListener('change', () => renderLibrary(1));
    if (filterMunicipio) filterMunicipio.addEventListener('change', () => renderLibrary(1));
    if (sortLibrarySelect) sortLibrarySelect.addEventListener('change', () => renderLibrary(1));
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => {
        if (searchLibraryInput) searchLibraryInput.value = '';
        if (filterCategory) filterCategory.value = '';
        if (filterTag) filterTag.value = '';
        if (filterFavorite) filterFavorite.checked = false;
        if (filterMunicipio) filterMunicipio.value = '';
        if (sortLibrarySelect) sortLibrarySelect.value = 'date_desc';
        updateTagFilter();
        renderLibrary(1);
    });

    // Toggle tema
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            toggleTheme();
            // Actualizar aria-pressed basado en el estado actual
            const isDark = document.body.classList.contains('dark');
            themeToggle.setAttribute('aria-pressed', isDark.toString());
        });
        // Establecer estado inicial
        const isDark = document.body.classList.contains('dark');
        themeToggle.setAttribute('aria-pressed', isDark.toString());
    }

    // Delegación en lista de biblioteca
    const libraryList = document.getElementById('libraryList');
    if (libraryList) {
        libraryList.addEventListener('click', (e) => {
            const target = e.target.closest('button, i, input');
            if (!target) return;
            if (target.closest('.action-empty-create')) { showSection('createPromptSection'); return; }
            if (target.closest('.action-clear-empty-filters')) { clearFiltersBtn?.click(); return; }
            const card = e.target.closest('.prompt-card');
            const promptId = card?.dataset.promptId;
            if (!promptId) return;
            if (target.matches('.prompt-select-checkbox')) {
                if (target.checked) selectedPromptIds.add(promptId); else selectedPromptIds.delete(promptId);
                const exportSelectedBtn = document.getElementById('exportSelectedBtn');
                if (exportSelectedBtn) exportSelectedBtn.disabled = selectedPromptIds.size === 0;
                return;
            }
            if (target.closest('.favorite-toggle')) { if (window.toggleFavorite) window.toggleFavorite(promptId, target.closest('.favorite-toggle')); return; }
            if (target.closest('.action-copy-text')) {
                if (window.copyFinalPromptWrapper) window.copyFinalPromptWrapper(promptId);
                return;
            }
            if (target.closest('.action-edit')) {
                if (window.viewPrompt) window.viewPrompt(promptId);
                return;
            }
            if (target.closest('.action-preview')) {
                if (window.openPreviewPromptModal) window.openPreviewPromptModal(promptId);
                return;
            }
            if (target.closest('.action-duplicate')) {
                if (window.duplicatePrompt) window.duplicatePrompt(promptId);
                return;
            }
            if (target.closest('.action-delete')) {
                if (window.openDeleteModal) window.openDeleteModal(promptId);
                return;
            }
        });
    }

    // Paginación (delegación)
    const pagination = document.getElementById('libraryPagination');
    if (pagination) {
        pagination.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.classList.contains('action-prev')) { requestAnimationFrame(() => renderLibrary(Math.max(1, (currentPage || 1) - 1))); return; }
            if (btn.classList.contains('action-first')) { requestAnimationFrame(() => renderLibrary(1)); return; }
            if (btn.classList.contains('action-last')) { requestAnimationFrame(() => renderLibrary(999999)); return; }
            if (btn.classList.contains('action-next')) { requestAnimationFrame(() => renderLibrary((currentPage || 1) + 1)); return; }
            if (btn.classList.contains('page-link')) {
                const page = parseInt(btn.dataset.page, 10);
                requestAnimationFrame(() => renderLibrary(page));
            }
        });
    }

    // Copiar bloques de la guía
    document.querySelectorAll('.guide-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const pre = btn.nextElementSibling;
            if (pre) navigator.clipboard.writeText(pre.textContent || '');
        });
    });

    // Botón backup del recordatorio
    const backupExportBtn = document.getElementById('backupExportBtn');
    if (backupExportBtn) backupExportBtn.addEventListener('click', () => window.openExportModal && window.openExportModal(true));

    // Cierre de modales desde botones
    const closeExportModalBtn = document.getElementById('closeExportModalBtn');
    if (closeExportModalBtn) closeExportModalBtn.addEventListener('click', () => closeModal('exportModal'));
    const cancelImportBtn = document.getElementById('cancelImportBtn');
    if (cancelImportBtn) cancelImportBtn.addEventListener('click', () => closeModal('importModal'));
    const cancelPlaceholderBtn = document.getElementById('cancelPlaceholderBtn');
    if (cancelPlaceholderBtn) cancelPlaceholderBtn.addEventListener('click', () => closeModal('placeholderModal'));
    const cancelEditTagCatBtn = document.getElementById('cancelEditTagCatBtn');
    if (cancelEditTagCatBtn) cancelEditTagCatBtn.addEventListener('click', () => closeModal('editTagCatModal'));
    const cancelEditTemplateBtn = document.getElementById('cancelEditTemplateBtn');
    if (cancelEditTemplateBtn) cancelEditTemplateBtn.addEventListener('click', () => closeModal('editTemplateModal'));
    const closePreviewTemplateBtn = document.getElementById('closePreviewTemplateBtn');
    if (closePreviewTemplateBtn) closePreviewTemplateBtn.addEventListener('click', () => closeModal('previewTemplateModal'));
    const closePreviewPromptBtn = document.getElementById('closePreviewPromptBtn');
    if (closePreviewPromptBtn) closePreviewPromptBtn.addEventListener('click', () => closeModal('previewPromptModal'));

    // Cancelar eliminación
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => closeModal('deleteConfirmModal'));

    // Confirmaciones y acciones principales en modales
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn && window.confirmDelete) confirmDeleteBtn.addEventListener('click', () => window.confirmDelete());

    const copyExportBtn = document.getElementById('copyExportBtn');
    if (copyExportBtn) copyExportBtn.addEventListener('click', () => {
        const exportTextArea = document.getElementById('exportTextArea');
        if (exportTextArea) navigator.clipboard.writeText(exportTextArea.value || '');
    });

    const confirmImportBtn = document.getElementById('confirmImportBtn');
    if (confirmImportBtn && window.handleImport) confirmImportBtn.addEventListener('click', () => window.handleImport());

    const copyPlaceholderResultBtn = document.getElementById('copyPlaceholderResultBtn');
    if (copyPlaceholderResultBtn && window.fillAndCopyPlaceholders) copyPlaceholderResultBtn.addEventListener('click', () => window.fillAndCopyPlaceholders());

    const confirmEditTagCatBtn = document.getElementById('confirmEditTagCatBtn');
    if (confirmEditTagCatBtn && window.confirmEditTagOrCat) confirmEditTagCatBtn.addEventListener('click', () => window.confirmEditTagOrCat());

    // Import/Export botones principales
    const importBtn = document.getElementById('importBtn');
    const exportSelectedBtn = document.getElementById('exportSelectedBtn');
    const exportAllBtn = document.getElementById('exportAllBtn');
    if (importBtn && window.openImportModal) importBtn.addEventListener('click', () => window.openImportModal());
    if (exportSelectedBtn && window.openExportModal) exportSelectedBtn.addEventListener('click', () => window.openExportModal(false));
    if (exportAllBtn && window.openExportModal) exportAllBtn.addEventListener('click', () => window.openExportModal(true));

    // Municipios
    const addMunicipioBtn = document.getElementById('addMunicipioBtn');
    if (addMunicipioBtn && window.addMunicipio) addMunicipioBtn.addEventListener('click', () => window.addMunicipio());

    // Importar archivo JSON en modal de import
    const importFile = document.getElementById('importFile');
    if (importFile) {
        importFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const importTextArea = document.getElementById('importTextArea');
                if (importTextArea) importTextArea.value = String(ev.target.result || '');
            };
            reader.onerror = () => showToast('Error al leer el archivo.', 'error');
            reader.readAsText(file);
        });
    }

    // Formulario crear/editar prompt
    const promptBuilderForm = document.getElementById('promptBuilderForm');
    if (promptBuilderForm && window.handleFormSubmit) {
        promptBuilderForm.addEventListener('submit', (e) => { e.preventDefault(); window.handleFormSubmit(); });
    }
    const generatePromptBtn = document.getElementById('generatePromptBtn');
    if (generatePromptBtn && window.generateFinalPromptUI) generatePromptBtn.addEventListener('click', () => window.generateFinalPromptUI());
    const copyPromptBtn = document.getElementById('copyPromptBtn');
    if (copyPromptBtn && window.copyFinalPromptWrapper) copyPromptBtn.addEventListener('click', () => window.copyFinalPromptWrapper());
    const clearFormBtn = document.getElementById('clearFormBtn');
    if (clearFormBtn && window.clearForm) clearFormBtn.addEventListener('click', () => window.clearForm());

    // Contenteditable seguro
    const promptFinalDisplay = document.getElementById('promptFinalDisplay');
    if (promptFinalDisplay) {
        promptFinalDisplay.addEventListener('input', () => {
            if (window.triggerAutosave) window.triggerAutosave();
            updatePromptQualityMetrics();
        });
        promptFinalDisplay.addEventListener('paste', e => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            document.execCommand('insertText', false, text);
            updatePromptQualityMetrics();
        });
    }

    // Tags pills
    const tagsInput = document.getElementById('promptTags');
    const pillsContainer = document.getElementById('tagsPills');
    if (tagsInput && pillsContainer) {
        const parseTags = () => (tagsInput.value || '').split(',').map(t => t.trim()).filter(Boolean);
        const renderPills = () => {
            const tags = parseTags();
            pillsContainer.innerHTML = '';
            tags.forEach((tag, idx) => {
                const pill = document.createElement('span');
                pill.className = 'tags-pill';
                const span = document.createElement('span');
                span.textContent = tag;
                pill.appendChild(span);
                const closeBtn = document.createElement('button');
                closeBtn.type = 'button';
                closeBtn.setAttribute('aria-label', `Eliminar etiqueta ${tag}`);
                closeBtn.innerHTML = '<i class="fas fa-times"></i>';
                closeBtn.addEventListener('click', () => {
                    const arr = parseTags();
                    arr.splice(idx, 1);
                    tagsInput.value = arr.join(', ');
                    renderPills();
                    if (window.triggerAutosave) window.triggerAutosave();
                });
                pill.appendChild(closeBtn);
                pillsContainer.appendChild(pill);
            });
        };
        const addTagFromInput = () => {
            const raw = tagsInput.value;
            const parts = raw.split(',');
            const last = parts[parts.length - 1].trim();
            if (last) {
                const existing = parts.slice(0, -1).map(s => s.trim()).filter(Boolean);
                const all = [...existing, last];
                tagsInput.value = [...new Set(all)].join(', ');
                renderPills();
                if (window.triggerAutosave) window.triggerAutosave();
            }
        };
        tagsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTagFromInput();
            } else if (e.key === 'Backspace' && !tagsInput.value) {
                const arr = parseTags();
                arr.pop();
                tagsInput.value = arr.join(', ');
                renderPills();
                if (window.triggerAutosave) window.triggerAutosave();
            }
        });
        tagsInput.addEventListener('blur', () => addTagFromInput());
        // render inicial (si ya hay tags)
        renderPills();
    }

    // Rating y favorito en formulario
    const promptRating = document.getElementById('promptRating');
    if (promptRating && window.setupRating) {
        promptRating.addEventListener('click', (e) => {
            if (e.target.matches('.fa-star')) {
                const rating = parseInt(e.target.dataset.value, 10);
                window.setupRating(rating);
            }
        });
    }
    const promptFavoriteIcon = document.getElementById('promptFavoriteIcon');
    const promptFavoriteCheckbox = document.getElementById('promptFavorite');
    if (promptFavoriteIcon && promptFavoriteCheckbox) {
        promptFavoriteIcon.addEventListener('click', () => {
            const newState = !promptFavoriteCheckbox.checked;
            promptFavoriteCheckbox.checked = newState;
            promptFavoriteIcon.className = newState ? 'fas fa-heart favorite-toggle active' : 'far fa-heart favorite-toggle';
            promptFavoriteIcon.style.color = newState ? '#ef4444' : 'var(--text-muted)';
        });
    }

    // Variaciones
    const addVariationBtn = document.getElementById('addVariationBtn');
    if (addVariationBtn && window.addVariation) addVariationBtn.addEventListener('click', () => window.addVariation());

    // Plantillas: añadir y edición
    const addRoleTemplateBtn = document.getElementById('addRoleTemplateBtn');
    if (addRoleTemplateBtn && window.addTemplate) addRoleTemplateBtn.addEventListener('click', () => {
        const name = document.getElementById('newRoleName')?.value || '';
        const text = document.getElementById('newRoleText')?.value || '';
        if (window.addTemplate('role', name, text)) {
            const n = document.getElementById('newRoleName'); if (n) n.value = '';
            const t = document.getElementById('newRoleText'); if (t) t.value = '';
        }
    });
    const addToneTemplateBtn = document.getElementById('addToneTemplateBtn');
    if (addToneTemplateBtn && window.addTemplate) addToneTemplateBtn.addEventListener('click', () => {
        const name = document.getElementById('newToneName')?.value || '';
        const text = document.getElementById('newToneText')?.value || '';
        if (window.addTemplate('tone', name, text)) {
            const n = document.getElementById('newToneName'); if (n) n.value = '';
            const t = document.getElementById('newToneText'); if (t) t.value = '';
        }
    });
    const addConstraintTemplateBtn = document.getElementById('addConstraintTemplateBtn');
    if (addConstraintTemplateBtn && window.addTemplate) addConstraintTemplateBtn.addEventListener('click', () => {
        const name = document.getElementById('newConstraintName')?.value || '';
        const text = document.getElementById('newConstraintText')?.value || '';
        if (window.addTemplate('constraint', name, text)) {
            const n = document.getElementById('newConstraintName'); if (n) n.value = '';
            const t = document.getElementById('newConstraintText'); if (t) t.value = '';
        }
    });
    const confirmEditTemplateBtn = document.getElementById('confirmEditTemplateBtn');
    if (confirmEditTemplateBtn && window.updateTemplate) confirmEditTemplateBtn.addEventListener('click', () => {
        const id = document.getElementById('editTemplateId')?.value;
        const name = document.getElementById('editTemplateName')?.value || '';
        const text = document.getElementById('editTemplateText')?.value || '';
        if (id) { window.updateTemplate(id, name, text); closeModal('editTemplateModal'); }
    });
    const extractTemplatesFromLibraryBtn = document.getElementById('extractTemplatesFromLibraryBtn');
    if (extractTemplatesFromLibraryBtn && window.extractTemplatesFromDataset && window.renderTemplates) extractTemplatesFromLibraryBtn.addEventListener('click', () => {
        const summary = window.extractTemplatesFromDataset(window.prompts || prompts);
        window.renderTemplates && window.renderTemplates();
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
                    const summary = window.extractTemplatesFromDataset(Array.isArray(data) ? data : []);
                    window.renderTemplates && window.renderTemplates();
                    showToast(`Extraídas ${summary.role} roles, ${summary.tone} tonos, ${summary.constraint} restricciones del JSON.`, 'success');
                } catch (err) {
                    console.error(err);
                    showToast('JSON inválido. No se pudo extraer plantillas.', 'error');
                }
            };
            reader.onerror = () => showToast('Error al leer el archivo JSON.', 'error');
            reader.readAsText(file);
            e.target.value = '';
        });
    }

    // Autosave
    const autosaveIds = ['promptName', 'promptCategory', 'promptTags', 'promptMunicipio', 'promptRole', 'promptContext', 'promptTask', 'promptFormat', 'promptTone', 'promptConstraints', 'promptExample', 'promptNotes'];
    autosaveIds.forEach(id => {
        const input = document.getElementById(id);
        if (input && window.triggerAutosave) input.addEventListener('input', () => { window.triggerAutosave(); updatePromptQualityMetrics(); });
    });
    if (promptRating && window.triggerAutosave) promptRating.addEventListener('click', () => { window.triggerAutosave(); updatePromptQualityMetrics(); });
    if (promptFavoriteIcon && window.triggerAutosave) promptFavoriteIcon.addEventListener('click', () => { window.triggerAutosave(); updatePromptQualityMetrics(); });

    document.querySelectorAll('.close-button').forEach(button => {
        button.type = 'button';
        button.setAttribute('aria-label', 'Cerrar modal');
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.setAttribute('aria-hidden', 'true');
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-button')) closeModal(modal.id);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModalEl = [...document.querySelectorAll('.modal.show')].pop();
            if (openModalEl) { closeModal(openModalEl.id); return; }
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
            document.querySelectorAll('.dropdown-toggle[aria-expanded="true"]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
        }
    });


    // Revised Global Dropdown Handler with Z-Index Fix
    document.addEventListener('click', (e) => {
        const isToggle = e.target.closest('.dropdown-toggle');
        const isMenu = e.target.closest('.dropdown-menu');

        if (!isToggle && !isMenu) {
            document.querySelectorAll('.dropdown-menu.show').forEach(m => {
                m.classList.remove('show');
                m.closest('.dropdown')?.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded', 'false');
                const p = m.closest('.prompt-card, .template-item');
                if (p) p.classList.remove('z-elevated');
            });
            return;
        }

        if (isToggle) {
            e.preventDefault();
            e.stopPropagation();
            const dropdown = isToggle.closest('.dropdown');
            const menu = dropdown.querySelector('.dropdown-menu');
            const parentCard = dropdown.closest('.prompt-card, .template-item');

            // Close others
            document.querySelectorAll('.dropdown-menu.show').forEach(m => {
                if (m !== menu) {
                    m.classList.remove('show');
                    m.closest('.dropdown')?.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded', 'false');
                    const p = m.closest('.prompt-card, .template-item');
                    if (p) p.classList.remove('z-elevated');
                }
            });

            if (menu) {
                menu.classList.toggle('show');
                const isOpen = menu.classList.contains('show');
                isToggle.setAttribute('aria-expanded', String(isOpen));
                if (isOpen) {
                    if (parentCard) parentCard.classList.add('z-elevated');
                } else {
                    if (parentCard) parentCard.classList.remove('z-elevated');
                }
            }
        }
    });

    // Accordion Delegation
    const guideAccordion = document.getElementById('guideAccordion');
    if (guideAccordion) {
        guideAccordion.addEventListener('click', (e) => {
            const header = e.target.closest('.accordion-header');
            if (!header) return;
            toggleAccordionItem(header.closest('.accordion-item'));
        });
        guideAccordion.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const header = e.target.closest('.accordion-header');
            if (!header) return;
            e.preventDefault();
            toggleAccordionItem(header.closest('.accordion-item'));
        });
    }

    // Expand/Collapse All Buttons
    const expandAllBtn = document.getElementById('expandAllAccordion');
    if (expandAllBtn) {
        expandAllBtn.addEventListener('click', () => expandAllAccordion());
    }

    const collapseAllBtn = document.getElementById('collapseAllAccordion');
    if (collapseAllBtn) {
        collapseAllBtn.addEventListener('click', () => collapseAllAccordion());
    }
}


/* --- Start of main.js --- */

// Punto de entrada ES Modules
window.__ESM_BOOTSTRAP__ = true;








// Expose functions to window for event delegation and HTML onclicks
window.showSection = showSection;
window.toggleTheme = toggleTheme;
window.renderLibrary = renderLibrary;
window.showToast = showToast;
window.updateFilterOptions = updateFilterOptions;
window.renderManageTagsCategories = renderManageTagsCategories;
window.confirmEditTagOrCat = confirmEditTagOrCat;
window.addMunicipio = addMunicipio;

window.viewPrompt = viewPrompt;
window.openPreviewPromptModal = openPreviewPromptModal;
window.duplicatePrompt = duplicatePrompt;
window.openDeleteModal = openDeleteModal;
window.confirmDelete = confirmDelete;
window.toggleFavorite = toggleFavoriteById; // Renamed for compatibility with events.js
window.handleFormSubmit = handleFormSubmit;
window.generateFinalPromptUI = generateFinalPromptUI;
window.copyFinalPromptWrapper = copyFinalPromptWrapper;
window.clearForm = clearForm;
window.setupRating = setupRating;
window.fillAndCopyPlaceholders = fillAndCopyPlaceholders;
window.addVariation = addVariation;
window.triggerAutosave = triggerAutosave;

window.addTemplate = addTemplate;
window.updateTemplate = updateTemplate;
window.extractTemplatesFromDataset = extractTemplatesFromDataset;
window.renderTemplates = renderTemplates;
window.updatePromptQualityMetrics = updatePromptQualityMetrics;

window.openExportModal = openExportModal;
window.openImportModal = openImportModal;
window.handleImport = handleImport;

document.addEventListener('DOMContentLoaded', () => {
    window.__ESM_BOOTSTRAP__ = true;
    initTheme();
    loadInitialData();
    setupAutoResize();
    updateFilterOptions();
    renderLibrary();
    setupTemplateAutocomplete();
    setupAccordion();
    checkBackupReminder();
    maybeBootstrapTemplatesFromBundledJson();
    updateMunicipiosSelects();
    setupEventListeners();
    loadAutosave();
    updatePromptQualityMetrics();
});