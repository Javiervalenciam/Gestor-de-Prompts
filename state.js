// Estado y persistencia

export const LOCAL_STORAGE_KEY = 'aiPrompts_v3';
export const AUTOSAVE_KEY = 'aiPrompts_autosave';
export const BACKUP_REMINDER_DAYS = 14;
export const LAST_EXPORT_KEY = 'aiPrompts_lastExport';
export const THEME_KEY = 'aiPrompts_theme';
export const MUNICIPIOS_KEY = 'aiPrompts_municipios';
export const TEMPLATES_KEY = 'aiPrompts_templates_v1';

export const MUNICIPIOS_DEFAULT = [
    'ARBOLEDAS', 'BOCHALEMA', 'CACHIRA', 'CHINACOTA', 'CHITAGA', 'CONVENCION',
    'CUCUTA', 'EL TARRA', 'HACARI', 'HERRAN', 'LABATECA', 'LA ESPERANZA',
    'LOURDES', 'MUTISCUA', 'OCAÑA', 'PUERTO SANTANDER', 'RAGONVALIA',
    'TOLEDO', 'VILLA CARO', 'VILLA DEL ROSARIO'
];

export let prompts = [];
export let templates = [];
export let municipios = [];
export let isDarkMode = false;
export let currentPage = 1;
export const promptsPerPage = 9;
export let selectedPromptIds = new Set();

export function setIsDarkMode(value) { isDarkMode = value; }
export function setPrompts(value) { prompts = value; }
export function setTemplates(value) { templates = value; }
export function setMunicipios(value) { municipios = value; }
export function setCurrentPage(value) { currentPage = value; }

export function savePrompts() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prompts));
}

export function loadPrompts() {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    try {
        setPrompts(stored ? JSON.parse(stored) : []);
    } catch {
        setPrompts([]);
    }
}

export function saveTemplates() {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function loadTemplates() {
    const saved = localStorage.getItem(TEMPLATES_KEY);
    try {
        setTemplates(saved ? JSON.parse(saved) : []);
    } catch {
        setTemplates([]);
    }
}

export function initMunicipios() {
    const saved = localStorage.getItem(MUNICIPIOS_KEY);
    setMunicipios(saved ? JSON.parse(saved) : [...MUNICIPIOS_DEFAULT]);
}

export function loadInitialData() {
    loadPrompts();
    loadTemplates();
    initMunicipios();
}


