/** Base modal behavior: open, close, ESC, backdrop click. */

export function initModal(overlayId, { onClose } = {}) {
    const overlay = document.getElementById(overlayId);

    overlay.querySelector('.modal-close')?.addEventListener('click', close);
    overlay.querySelector('[id$="Cancel"]')?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    function close() {
        overlay.classList.remove('active');
        if (onClose) onClose();
    }

    return {
        open() { overlay.classList.add('active'); },
        close,
        overlay,
    };
}
