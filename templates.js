// Lógica específica de plantillas
import { templates } from './state.js';
import { showToast, openModal, closeModal } from './ui.js';
import { escapeHTML } from './utils.js';
import { saveTemplates } from './state.js';
import { showSection } from './ui.js';

export function addTemplate(category, name, text) {
    const cleanText = (text || '').trim();
    if (!cleanText) { showToast('El texto de la plantilla no puede estar vacío.', 'error'); return false; }
    if (templateExists(category, cleanText)) { showToast('Esta plantilla ya existe.', 'warning'); return false; }
    const now = new Date().toISOString();
    const tpl = { id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, category, name: (name || '').trim(), text: cleanText, createdAt: now, updatedAt: now, usageCount: 0 };
    templates.push(tpl);
    showToast('Plantilla añadida.', 'success');
    return true;
}

export function templateExists(category, text) {
    const key = normalizeTextForKey(text);
    return templates.some(t => t.category === category && normalizeTextForKey(t.text) === key);
}

export function normalizeTextForKey(text) { return (text || '').toLowerCase().trim().replace(/\s+/g, ' '); }

export function openPreviewTemplateModal(tpl) {
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

export function updateTemplate(id, name, text) {
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

export function deleteTemplate(id) {
    const idx = templates.findIndex(t => t.id === id);
    if (idx === -1) return;
    const name = templates[idx].name || templates[idx].text.substring(0, 40) + (templates[idx].text.length > 40 ? '…' : '');
    if (!confirm(`¿Eliminar la plantilla "${name}"?`)) return;
    templates.splice(idx, 1);
    saveTemplates();
    renderTemplates();
    showToast('Plantilla eliminada.', 'info');
}

export function applyTemplateToForm(template) {
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

export function renderTemplates() {
    const rolesList = document.getElementById('rolesTemplatesList');
    const tonesList = document.getElementById('tonesTemplatesList');
    const constraintsList = document.getElementById('constraintsTemplatesList');
    if (!rolesList || !tonesList || !constraintsList) return;
    const createItem = (tpl) => {
        const div = document.createElement('div');
        div.className = 'template-item';
        const safeName = escapeHTML(tpl.name || '');
        const safeText = escapeHTML(tpl.text);
        const title = safeName ? `${safeName}` : `${safeText.substring(0, 50)}${tpl.text.length > 50 ? '…' : ''}`;
        const usageCount = tpl.usageCount || 0;
        div.innerHTML = `
            <div class="template-item-content">
                <div class="template-item-header">
                    <h4 class="template-item-title">${title}</h4>
                    <div class="template-item-meta">
                        <span class="template-usage-badge">
                            <i class="fas fa-chart-line"></i>
                            ${usageCount} uso${usageCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
                <p class="template-item-text">${safeText}</p>
            </div>
            <div class="template-item-actions">
                <button class="btn btn-primary btn-sm action-apply" title="Aplicar al formulario">
                    <i class="fas fa-check"></i>
                    <span>Aplicar</span>
                </button>
                <button class="btn btn-secondary btn-sm action-copy" title="Copiar texto">
                    <i class="fas fa-copy"></i>
                    <span>Copiar</span>
                </button>
                <div class="template-item-more">
                    <div class="dropdown">
                        <button class="btn btn-icon btn-sm dropdown-toggle" title="Más opciones">
                            <i class="fas fa-ellipsis-h"></i>
                        </button>
                        <div class="dropdown-menu">
                             <button class="dropdown-item action-preview"><i class="fas fa-eye"></i> Previsualizar</button>
                             <button class="dropdown-item action-edit"><i class="fas fa-edit"></i> Editar</button>
                             <div style="border-top: 1px solid var(--md-sys-color-outline-variant); margin: 4px 0;"></div>
                             <button class="dropdown-item action-delete text-danger"><i class="fas fa-trash-alt"></i> Eliminar</button>
                        </div>
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

export function openEditTemplateModal(tpl) {
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

export function extractTemplatesFromDataset(dataset) {
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

export async function maybeBootstrapTemplatesFromBundledJson() {
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


