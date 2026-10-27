// Lógica de prompts (CRUD, preview, formulario)
import { prompts, setPrompts, savePrompts, currentPage } from './state.js';
import { showToast, renderLibrary, updateFilterOptions, openModal, closeModal, showSection } from './ui.js';
import { escapeHTML, formatDate, debounce } from './utils.js';
import { AUTOSAVE_KEY } from './state.js';

export function generateFinalPromptFromObject(p) {
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

export function generateFinalPrompt() {
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

export function generateFinalPromptUI() {
    const finalPrompt = generateFinalPrompt();
    const promptFinalDisplay = document.getElementById('promptFinalDisplay');
    if (promptFinalDisplay) promptFinalDisplay.innerHTML = escapeHTML(finalPrompt);
}

export function setupRating(rating = 0) {
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

export function clearForm() {
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
    if (elements.promptFinalDisplay) elements.promptFinalDisplay.innerHTML = 'El prompt generado aparecerá aquí...';
    if (elements.variationsList) elements.variationsList.innerHTML = '';
    if (elements.formMetaInfo) elements.formMetaInfo.classList.add('hidden');
    if (elements.savePromptBtn) elements.savePromptBtn.innerHTML = '<i class="fas fa-save"></i> Guardar en Biblioteca';
    if (elements.autosaveStatus) elements.autosaveStatus.innerHTML = '';
    setupRating(0);
}

export function populateForm(prompt) {
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

    // Populate variations
    const variationsList = document.getElementById('variationsList');
    if (variationsList) {
        variationsList.innerHTML = '';
        if (prompt.variations && Array.isArray(prompt.variations)) {
            prompt.variations.forEach(v => addVariationToDom(v));
        }
    }
}

export function viewPrompt(id) { const prompt = prompts.find(p => p.id === id); if (!prompt) return; populateForm(prompt); showSection('createPromptSection'); }

export function openPreviewPromptModal(id) {
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

export function openDeleteModal(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;
    const nameSpan = document.getElementById('deletePromptName');
    if (nameSpan) { nameSpan.textContent = prompt.nombre || ''; nameSpan.dataset.promptId = id; }
    openModal('deleteConfirmModal');
}

export function confirmDelete() {
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

export function copyFinalPromptWrapper(id) {
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

export function detectPlaceholders(text) { const regex = /\[([^\]]+)\]/g; let match; const found = new Set(); while ((match = regex.exec(text)) !== null) found.add(match[1].trim()); return Array.from(found); }

export function openPlaceholderModal(text, promptId = null) {
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

export function updatePlaceholderPreview() {
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

export function fillAndCopyPlaceholders() {
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

export function incrementUsageCount(id) {
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

export function toggleFavoriteById(id, iconEl) {
    const index = prompts.findIndex(p => p.id === id);
    if (index > -1) {
        prompts[index].isFavorite = !prompts[index].isFavorite;
        prompts[index].fechaModificacion = new Date().toISOString();
        savePrompts();
        const isFav = prompts[index].isFavorite;
        if (iconEl) {
            iconEl.className = isFav ? 'fas fa-heart favorite-toggle active' : 'fas fa-heart favorite-toggle';
            iconEl.style.color = isFav ? '#ef4444' : 'var(--text-muted)';
            iconEl.title = isFav ? 'Quitar de favoritos' : 'Marcar como favorito';
        }
        const filterFavorite = document.getElementById('filterFavorite');
        if (filterFavorite?.checked) renderLibrary(currentPage);
    }
}

export function handleFormSubmit() {
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
    const data = {
        id: promptId || `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        nombre: nameInput?.value.trim() || 'Prompt sin nombre',
        categoria: categoryInput?.value.trim() || '',
        tags: tagsInput?.value.split(',').map(t => t.trim()).filter(Boolean) || [],
        municipio: municipioInput?.value.trim() || '',
        rating: parseInt(ratingValueInput?.value) || 0,
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

export function duplicatePrompt(id) {
    const original = prompts.find(p => p.id === id);
    if (!original) return;
    const now = new Date().toISOString();
    const copy = JSON.parse(JSON.stringify(original));
    copy.id = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    copy.nombre = `${original.nombre} (Copia)`;
    copy.fechaCreacion = now; copy.fechaModificacion = now; copy.usageCount = 0;
    prompts.push(copy);
    savePrompts();
    renderLibrary(currentPage);
    updateFilterOptions();
    showToast(`Prompt duplicado como "${copy.nombre}".`, 'success');
}

export function addVariation() {
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
        <button type="button" class="btn btn-icon btn-sm text-danger" onclick="this.closest('.variation-item').remove(); window.triggerAutosave();">
            <i class="fas fa-trash"></i>
        </button>
    `;
    list.appendChild(div);
}

export const triggerAutosave = debounce(() => {
    const data = getFormData();
    if (data.nombre === 'Prompt sin nombre' && !data.tarea && !data.promptFinal) return; // Don't save empty state

    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
    const status = document.getElementById('autosave-status');
    if (status) {
        status.textContent = 'Guardado en borrador...';
        setTimeout(() => status.textContent = '', 2000);
    }
}, 1000);

export function loadAutosave() {
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
