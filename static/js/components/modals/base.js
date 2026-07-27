/** Base modal behavior: open, close, ESC, backdrop click. */

export function initModal(overlayId, { onClose } = {}) {
    const overlay = document.getElementById(overlayId);

    const closeBtn = overlay.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', close);

    const cancelBtn = overlay.querySelector('[id$="Cancel"]');
    if (cancelBtn) cancelBtn.addEventListener('click', close);
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
