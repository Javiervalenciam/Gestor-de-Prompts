
// Global Dropdown Handler - Appended to ensure functionality
document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.dropdown-toggle');
    if (toggle) {
        e.preventDefault();
        e.stopPropagation();
        const dropdown = toggle.closest('.dropdown');
        const menu = dropdown.querySelector('.dropdown-menu');

        // Close other open dropdowns
        document.querySelectorAll('.dropdown-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });

        if (menu) {
            // Toggle current
            if (menu.classList.contains('show')) {
                menu.classList.remove('show');
            } else {
                menu.classList.add('show');
            }
        }
    } else {
        // Click outside - close all
        if (!e.target.closest('.dropdown-menu')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
        }
    }
});
