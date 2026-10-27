
// Revised Global Dropdown Handler with Z-Index Fix
document.addEventListener('click', (e) => {
    // Clean up all elevated z-indexes first
    const isToggle = e.target.closest('.dropdown-toggle');
    const isMenu = e.target.closest('.dropdown-menu');

    // If not interacting with a menu, close all
    if (!isToggle && !isMenu) {
        document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
        document.querySelectorAll('.z-elevated').forEach(el => el.classList.remove('z-elevated'));
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
            if (parentCard) {
                if (menu.classList.contains('show')) {
                    parentCard.classList.add('z-elevated');
                } else {
                    parentCard.classList.remove('z-elevated');
                }
            }
        }
    }
});
