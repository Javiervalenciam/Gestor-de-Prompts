// Gestión de etiquetas, categorías y municipios
import { prompts, municipios, MUNICIPIOS_KEY } from './state.js';
import { savePrompts } from './state.js';
import { showToast, openModal, closeModal } from './ui.js';
import { escapeHTML, formatDate } from './utils.js';

export function updateMunicipiosSelects() {
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

export function addMunicipio() {
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

export function deleteMunicipio(name) {
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

export function renderManageMunicipios() {
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

export function renderManageTagsCategories() {
    renderManageTags();
    renderManageCategories();
    renderManageMunicipios();
}

export function renderManageTags() {
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

export function renderManageCategories() {
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

export function openEditTagCatModal(oldValue, isCategory, isMunicipio = false) {
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

export function confirmEditTagOrCat() {
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


