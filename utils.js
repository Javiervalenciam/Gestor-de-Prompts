// Utilidades puras

export function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

export function formatDate(isoString) {
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

export function debounce(func, wait = 20) {
    let timeoutId;
    return function debounced(...args) {
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), wait);
    };
}


