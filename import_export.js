// Importación y exportación de prompts
import { prompts, LAST_EXPORT_KEY } from './state.js';
import { showToast, openModal, closeModal, checkBackupReminder } from './ui.js';

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

export function openExportModal(exportAll = true) {
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

export function openImportModal() {
    const importTextArea = document.getElementById('importTextArea');
    const importFile = document.getElementById('importFile');
    const importError = document.getElementById('importError');
    if (importTextArea) importTextArea.value = '';
    if (importFile) importFile.value = '';
    if (importError) { importError.textContent = ''; importError.classList.add('hidden'); }
    openModal('importModal');
}

export function handleImport() {
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
        
        // Antes de map(), filtra claves prohibidas
        const isSafe = o => !Object.keys(o).some(k => ['__proto__','constructor','prototype'].includes(k));
        const valid = importedData
            .filter(p => p && typeof p === 'object' && isSafe(p) && (p.id || p.nombre || p.promptFinal))
            .map(p => ({
            id: p.id || `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nombre: p.nombre || 'Prompt importado',
            categoria: p.categoria || '',
            tags: Array.isArray(p.tags) ? p.tags.filter(t => t && t.trim()) : [],
            municipio: p.municipio || '',
            rating: typeof p.rating === 'number' && p.rating >= 0 && p.rating <= 5 ? p.rating : 0,
            isFavorite: typeof p.isFavorite === 'boolean' ? p.isFavorite : false,
            usageCount: typeof p.usageCount === 'number' && p.usageCount >= 0 ? p.usageCount : 0,
            fechaCreacion: p.fechaCreacion || new Date().toISOString(),
            fechaModificacion: p.fechaModificacion || new Date().toISOString(),
            rol: p.rol || '', contexto: p.contexto || '', tarea: p.tarea || '', formato: p.formato || '', tono: p.tono || '', restricciones: p.restricciones || '', ejemplo: p.ejemplo || '',
            promptFinal: p.promptFinal || '', variations: Array.isArray(p.variations) ? p.variations : [], notas: p.notas || ''
        }));
        if (valid.length !== importedData.length) showToast('Algunos prompts en el JSON tenían formato inválido y fueron omitidos.', 'warning');
        let addedCount = 0; let updatedCount = 0;
        if (merge) {
            valid.forEach(ip => {
                const idx = prompts.findIndex(p => p.id === ip.id);
                if (idx > -1) { if (new Date(ip.fechaModificacion) > new Date(prompts[idx].fechaModificacion)) { prompts[idx] = ip; updatedCount++; } }
                else { prompts.push(ip); addedCount++; }
            });
        } else { prompts.splice(0, prompts.length, ...valid); addedCount = valid.length; }
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


