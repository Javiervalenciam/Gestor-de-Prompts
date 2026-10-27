// UI y renderizado
import { escapeHTML, formatDate, debounce } from './utils.js';
import { prompts, templates, municipios, isDarkMode, setIsDarkMode, selectedPromptIds, currentPage, setCurrentPage, promptsPerPage, LAST_EXPORT_KEY, BACKUP_REMINDER_DAYS, THEME_KEY } from './state.js';
export function showSection(sectionId) {
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

export function showToast(message, type = 'info') {
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
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

export function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    setIsDarkMode(savedTheme === 'dark');
    applyTheme();
}

export function toggleTheme() {
    setIsDarkMode(!isDarkMode);
    localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
    applyTheme();
}

export function applyTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const icon = themeToggle?.querySelector('i');
    if (isDarkMode) {
        body.classList.add('dark');
        if (icon) { icon.className = 'fas fa-sun'; themeToggle.title = 'Cambiar a modo claro'; }
    } else {
        body.classList.remove('dark');
        if (icon) { icon.className = 'fas fa-moon'; themeToggle.title = 'Cambiar a modo oscuro'; }
    }
}

export function renderLibrary(page = 1) {
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
            libraryList.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: var(--spacing-2xl); color: var(--text-muted);">
                    <i class="fas fa-search" style="font-size: 3rem; margin-bottom: var(--spacing-md); opacity: 0.5;"></i>
                    <p style="font-size: 1.125rem; margin: 0;">${message}</p>
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

        // GSAP Stagger Animation
        if (window.gsap) {
            gsap.from('.card-element', {
                y: 50,
                opacity: 0,
                stagger: 0.1,
                duration: 0.6,
                ease: 'back.out(1.7)',
                clearProps: 'all'
            });
        }
    }, 200);
}

export function createPromptCard(prompt, index) {
    const card = document.createElement('div');
    card.className = 'prompt-card card-element'; // Added card-element class for GSAP selector
    card.dataset.promptId = prompt.id;
    // Removed manual style transitions in favor of GSAP

    // ... (rest of card construction)


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
                    <input type="checkbox" class="prompt-select-checkbox" data-prompt-id="${prompt.id}" style="margin: 0;">
                    <h3 class="prompt-card-title" style="flex: 1; min-width: 0;">${escapeHTML(prompt.nombre)}</h3>
                    <i class="favorite-toggle fas fa-heart ${prompt.isFavorite ? 'active' : ''}"
                       title="${prompt.isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}"
                       style="color: ${prompt.isFavorite ? '#ef4444' : 'var(--md-sys-color-on-surface-variant)'}; cursor: pointer; font-size: 1.125rem;"></i>
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
                    ${escapeHTML(prompt.promptFinal.substring(0, 150))}${prompt.promptFinal.length > 150 ? '...' : ''}
                </div>
            </div>` : ''}
        <div class="prompt-card-actions" style="display: flex; justify-content: space-between; gap: 8px; align-items: center;">
            <button class="btn btn-primary btn-sm action-copy-text" title="Copiar al portapapeles"><i class="fas fa-copy"></i> Copiar</button>
            <div class="dropdown">
                <!-- A11Y: ARIA labels para accesibilidad -->
                <button class="btn btn-icon dropdown-toggle" title="Más opciones del prompt" 
                        aria-label="Más opciones del prompt" aria-haspopup="true" aria-expanded="false"
                        style="width: 32px; height: 32px;"><i class="fas fa-ellipsis-v" aria-hidden="true"></i></button>
                <div class="dropdown-menu">
                    <button class="dropdown-item action-edit"><i class="fas fa-edit"></i> Editar</button>
                    <button class="dropdown-item action-preview"><i class="fas fa-eye"></i> Previsualizar</button>
                    <button class="dropdown-item action-duplicate"><i class="fas fa-clone"></i> Duplicar</button>
                    <div style="border-top: 1px solid var(--md-sys-color-outline-variant); margin: 4px 0;"></div>
                    <button class="dropdown-item action-delete text-danger"><i class="fas fa-trash-alt"></i> Eliminar</button>
                </div>
            </div>
        </div>`;
    return card;
}

export function renderPagination(totalPages, currentPage, totalItems) {
    const paginationContainer = document.getElementById('libraryPagination');
    if (!paginationContainer) return;
    if (totalPages <= 1) {
        paginationContainer.innerHTML = totalItems > 0 ? `<div class="pagination-info" style="text-align: center; color: var(--text-muted);">Mostrando todos los ${totalItems} prompts</div>` : '';
        return;
    }
    let html = `
        <button class="pagination-btn action-prev" ${currentPage <= 1 ? 'disabled' : ''} title="Página anterior"><i class="fas fa-chevron-left"></i></button>
        <button class="pagination-btn action-first" ${currentPage === 1 ? 'disabled' : ''} title="Primera página"><i class="fas fa-angle-double-left"></i></button>`;
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    if (startPage > 1) html += `<span class="pagination-info">...</span>`;
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn page-link ${i === currentPage ? 'active' : ''}" data-page="${i}" title="Página ${i}">${i}</button>`;
    }
    if (endPage < totalPages) html += `<span class="pagination-info">...</span>`;
    html += `
        <button class="pagination-btn action-last" ${currentPage === totalPages ? 'disabled' : ''} title="Última página"><i class="fas fa-angle-double-right"></i></button>
        <button class="pagination-btn action-next" ${currentPage >= totalPages ? 'disabled' : ''} title="Página siguiente"><i class="fas fa-chevron-right"></i></button>
        <div class="pagination-info" style="margin-left: auto;">Página ${currentPage} de ${totalPages} (${totalItems} prompts)</div>`;
    paginationContainer.innerHTML = html;
}

export function updateExportSelectedButton() {
    const exportSelectedBtn = document.getElementById('exportSelectedBtn');
    if (exportSelectedBtn) {
        exportSelectedBtn.disabled = selectedPromptIds.size === 0;
        exportSelectedBtn.title = selectedPromptIds.size === 0 ? 'Selecciona prompts para exportar' : `Exportar ${selectedPromptIds.size} prompts seleccionados`;
    }
}

export function checkBackupReminder() {
    const backupReminder = document.getElementById('backupReminder');
    if (!backupReminder) return;
    const lastExport = localStorage.getItem(LAST_EXPORT_KEY);
    if (!lastExport) {
        backupReminder.style.display = 'block';
        // Modal no intrusivo 1a vez tras X días (mismo contenido actual)
        setTimeout(() => {
            const alreadyShown = sessionStorage.getItem('backupReminderShown');
            if (!alreadyShown) {
                const btn = document.getElementById('backupExportBtn');
                if (btn) btn.focus();
                sessionStorage.setItem('backupReminderShown', '1');
            }
        }, 300);
        return;
    }
    const daysSince = (new Date() - new Date(lastExport)) / (1000 * 60 * 60 * 24);
    const shouldShow = daysSince > BACKUP_REMINDER_DAYS;
    backupReminder.style.display = shouldShow ? 'block' : 'none';
    if (shouldShow) {
        setTimeout(() => {
            const alreadyShown = sessionStorage.getItem('backupReminderShown');
            if (!alreadyShown) {
                const btn = document.getElementById('backupExportBtn');
                if (btn) btn.focus();
                sessionStorage.setItem('backupReminderShown', '1');
            }
        }, 300);
    }
}

export function setupAccordion() {
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
}

export function expandAllAccordion() {
    document.querySelectorAll('.accordion-item').forEach(item => {
        const content = item.querySelector('.accordion-content');
        if (content) { item.classList.add('open'); content.style.display = 'block'; }
    });
}

export function collapseAllAccordion() {
    document.querySelectorAll('.accordion-item').forEach(item => {
        const content = item.querySelector('.accordion-content');
        if (content) { item.classList.remove('open'); content.style.display = 'none'; }
    });
}

export function setupAutoResize() {
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

export function getFilteredPrompts() {
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

export function updateFilterOptions() {
    updateCategoryFilter();
    updateTagFilter();
}

export function updateCategoryFilter() {
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

export function updateTagFilter() {
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

export function setupTemplateAutocomplete() {
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
        field.addEventListener('input', () => {
            if (!templates.some(t => t.category === category)) { closeTemplatesAutocompleteMenu(category); return; }
            openMenu();
        });
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

export function createOrUpdateTemplatesAutocompleteMenu(category, anchorElement, matchedTemplates, onSelect) {
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

export function closeTemplatesAutocompleteMenu(category) {
    const menu = document.getElementById(`acTpl-${category}`);
    if (menu) menu.remove();
}

export function filterTemplatesForAutocomplete(category, query) {
    const norm = (query || '').toLowerCase().trim();
    const source = templates.filter(t => t.category === category);
    if (!norm) {
        return source.slice().sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 8);
    }
    const filtered = source.filter(t => (t.name && t.name.toLowerCase().includes(norm)) || (t.text && t.text.toLowerCase().includes(norm)));
    return filtered.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 8);
}

export function openModal(modalId) { const m = document.getElementById(modalId); if (m) { m.style.display = 'flex'; setTimeout(() => m.classList.add('show'), 10); } }
export function closeModal(modalId) { const m = document.getElementById(modalId); if (m) { m.classList.remove('show'); setTimeout(() => { m.style.display = 'none'; }, 300); } }

export function maybeBootstrapTemplatesFromBundledJson() { if (window && window.maybeBootstrapTemplatesFromBundledJson) { window.maybeBootstrapTemplatesFromBundledJson(); } }


