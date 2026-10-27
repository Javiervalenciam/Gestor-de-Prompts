// Punto de entrada ES Modules
window.__ESM_BOOTSTRAP__ = true;
import { initTheme, showSection, toggleTheme, renderLibrary, showToast, updateFilterOptions, checkBackupReminder, setupAccordion, setupAutoResize, setupTemplateAutocomplete } from './ui.js';
import { loadInitialData } from './state.js';
import { setupEventListeners } from './events.js';
import { renderTemplates, maybeBootstrapTemplatesFromBundledJson, addTemplate, updateTemplate, extractTemplatesFromDataset } from './templates.js';
import { openExportModal, openImportModal, handleImport } from './import_export.js';
import { renderManageTagsCategories, updateMunicipiosSelects, confirmEditTagOrCat, addMunicipio } from './manage.js';
import {
    viewPrompt, openPreviewPromptModal, duplicatePrompt, openDeleteModal, confirmDelete,
    toggleFavoriteById, handleFormSubmit, generateFinalPromptUI, copyFinalPromptWrapper,
    clearForm, setupRating, fillAndCopyPlaceholders, addVariation, triggerAutosave, loadAutosave
} from './prompts.js';

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
});


