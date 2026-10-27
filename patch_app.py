import os

file_path = r"c:\Users\djjav\Documents\Gestor de Prompts v2\app.js"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Patch 1: Library Cards
target_1 = """        <div class="prompt-card-actions">
            <button class="btn btn-primary btn-sm action-edit"><i class="fas fa-edit"></i> Editar</button>
            <button class="btn btn-secondary btn-sm action-preview"><i class="fas fa-eye"></i> Previsualizar</button>
            <button class="btn btn-warning btn-sm action-duplicate"><i class="fas fa-clone"></i> Duplicar</button>
            <button class="btn btn-danger btn-sm action-delete"><i class="fas fa-trash-alt"></i> Eliminar</button>
        </div>`;"""

replacement_1 = """        <div class="prompt-card-actions" style="display: flex; justify-content: space-between; gap: 8px; align-items: center;">
            <button class="btn btn-primary btn-sm action-copy-text" title="Copiar al portapapeles"><i class="fas fa-copy"></i> Copiar</button>
            <div class="dropdown">
                <button class="btn btn-secondary btn-sm dropdown-toggle" title="Opciones"><i class="fas fa-ellipsis-v"></i> Opciones</button>
                <div class="dropdown-menu">
                    <button class="dropdown-item action-edit"><i class="fas fa-edit"></i> Editar</button>
                    <button class="dropdown-item action-preview"><i class="fas fa-eye"></i> Previsualizar</button>
                    <button class="dropdown-item action-duplicate"><i class="fas fa-clone"></i> Duplicar</button>
                    <div style="border-top: 1px solid var(--md-sys-color-outline-variant); margin: 4px 0;"></div>
                    <button class="dropdown-item action-delete text-danger"><i class="fas fa-trash-alt"></i> Eliminar</button>
                </div>
            </div>
        </div>`;"""

# Patch 2: Template Items
target_2 = """            <div class="flex gap-sm" style="margin-left: 16px;">
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
        return div;"""

replacement_2 = """            <div class="template-actions" style="display: flex; gap: 8px; align-items: center; margin-left: auto; flex-shrink: 0;">
                <button class="btn btn-success btn-sm action-apply" title="Aplicar al formulario"><i class="fas fa-check"></i></button>
                <button class="btn btn-secondary btn-sm action-copy" title="Copiar texto"><i class="fas fa-copy"></i></button>
                <div class="dropdown">
                    <button class="btn btn-icon dropdown-toggle" title="Opciones" style="width: 32px; height: 32px;"><i class="fas fa-ellipsis-v"></i></button>
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
        return div;"""

if target_1 in content:
    content = content.replace(target_1, replacement_1)
    print("Patch 1 applied.")
else:
    print("Patch 1 target not found.")
    # Try normalization
    print("Start of target 1:", repr(target_1[:50]))
    # print("Start of content around 286:", repr(content.splitlines()[285:290]))

if target_2 in content:
    content = content.replace(target_2, replacement_2)
    print("Patch 2 applied.")
else:
    print("Patch 2 target not found.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
