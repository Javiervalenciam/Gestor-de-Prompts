// Centralización de eventos y delegación
import { renderLibrary, updateTagFilter, expandAllAccordion, collapseAllAccordion, openModal, closeModal, showToast, toggleTheme } from './ui.js';
import { prompts, selectedPromptIds, setCurrentPage, LAST_EXPORT_KEY, currentPage as stateCurrentPage } from './state.js';
import { escapeHTML } from './utils.js';

export function setupEventListeners() {
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
            const card = e.target.closest('.prompt-card');
            const promptId = card?.dataset.promptId;
            if (!promptId) return;
            if (target.matches('.prompt-select-checkbox')) {
                if (target.checked) selectedPromptIds.add(promptId); else selectedPromptIds.delete(promptId);
                const exportSelectedBtn = document.getElementById('exportSelectedBtn');
                if (exportSelectedBtn) exportSelectedBtn.disabled = selectedPromptIds.size === 0;
                return;
            }
            if (target.matches('.favorite-toggle')) { if (window.toggleFavorite) window.toggleFavorite(promptId, target); return; }
            if (target.closest('.action-copy-text')) {
                const p = prompts.find(x => x.id === promptId);
                if (p && p.promptFinal) {
                    navigator.clipboard.writeText(p.promptFinal).then(() => showToast('Prompt copiado al portapapeles', 'success'));
                } else {
                    showToast('No hay contenido para copiar.', 'info');
                }
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
            if (btn.classList.contains('action-prev')) { requestAnimationFrame(() => renderLibrary(Math.max(1, (stateCurrentPage || 1) - 1))); return; }
            if (btn.classList.contains('action-first')) { requestAnimationFrame(() => renderLibrary(1)); return; }
            if (btn.classList.contains('action-last')) { requestAnimationFrame(() => renderLibrary(999999)); return; }
            if (btn.classList.contains('action-next')) { requestAnimationFrame(() => renderLibrary((stateCurrentPage || 1) + 1)); return; }
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
    if (backupExportBtn) backupExportBtn.addEventListener('click', () => window.openExportModal && window.openExportModal(false));

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
        promptFinalDisplay.addEventListener('paste', e => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            document.execCommand('insertText', false, text);
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
        if (input && window.triggerAutosave) input.addEventListener('input', () => window.triggerAutosave());
    });
    if (promptRating && window.triggerAutosave) promptRating.addEventListener('click', () => window.triggerAutosave());
    if (promptFavoriteIcon && window.triggerAutosave) promptFavoriteIcon.addEventListener('click', () => window.triggerAutosave());

    // Cerrar modales al click fuera o en la X
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-button')) closeModal(modal.id);
        });
    });

    
// Revised Global Dropdown Handler with Z-Index Fix
document.addEventListener('click', (e) => {
    const isToggle = e.target.closest('.dropdown-toggle');
    const isMenu = e.target.closest('.dropdown-menu');

    if (!isToggle && !isMenu) {
        document.querySelectorAll('.dropdown-menu.show').forEach(m => {
            m.classList.remove('show');
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
                const p = m.closest('.prompt-card, .template-item');
                if (p) p.classList.remove('z-elevated');
            }
        });

        if (menu) {
            menu.classList.toggle('show');
            if (menu.classList.contains('show')) {
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
        const item = header.closest('.accordion-item');
        const content = item.querySelector('.accordion-content');
        if (item && content) {
            const isOpen = item.classList.contains('open');
            item.classList.toggle('open', !isOpen);
            content.style.display = isOpen ? 'none' : 'block';
        }
    });
}

// Expand/Collapse All Buttons
const expandAllBtn = document.getElementById('expandAllAccordion');
if (expandAllBtn) {
    expandAllBtn.addEventListener('click', () => {
        document.querySelectorAll('#guideAccordion .accordion-item').forEach(item => {
            item.classList.add('open');
            const content = item.querySelector('.accordion-content');
            if (content) content.style.display = 'block';
        });
    });
}

const collapseAllBtn = document.getElementById('collapseAllAccordion');
if (collapseAllBtn) {
    collapseAllBtn.addEventListener('click', () => {
        document.querySelectorAll('#guideAccordion .accordion-item').forEach(item => {
            item.classList.remove('open');
            const content = item.querySelector('.accordion-content');
            if (content) content.style.display = 'none';
        });
    });
}
