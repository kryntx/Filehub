/** Theme management component. */

import State from '../state.js';

const root = document.documentElement;
const colorButtons = Array.from(document.querySelectorAll('[data-color-mode]'));
const effectButtons = Array.from(document.querySelectorAll('[data-effect-option]'));
const systemScheme = window.matchMedia('(prefers-color-scheme: light)');
let transitionTimer = null;

function resolvedTheme() {
    return State.colorMode === 'system'
        ? (systemScheme.matches ? 'light' : 'dark')
        : State.colorMode;
}

function animateThemeChange() {
    root.classList.remove('theme-transition');
    void root.offsetWidth;
    root.classList.add('theme-transition');

    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => {
        root.classList.remove('theme-transition');
    }, 520);
}

function updateButtons() {
    colorButtons.forEach(btn => {
        const active = btn.dataset.colorMode === State.colorMode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    effectButtons.forEach(btn => {
        const active = btn.dataset.effectOption === State.effectTheme;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function applyTheme(animate = false) {
    const theme = resolvedTheme();
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-color-mode', State.colorMode);
    root.setAttribute('data-effect', State.effectTheme);
    root.style.colorScheme = theme;
    updateButtons();

    if (animate) animateThemeChange();
}

export function init() {
    applyTheme(false);

    const handleSystemChange = () => {
        if (State.colorMode === 'system') {
            applyTheme(true);
        }
    };

    if (systemScheme.addEventListener) {
        systemScheme.addEventListener('change', handleSystemChange);
    } else if (systemScheme.addListener) {
        systemScheme.addListener(handleSystemChange);
    }

    colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            State.colorMode = btn.dataset.colorMode;
        });
    });

    effectButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            State.effectTheme = btn.dataset.effectOption;
        });
    });

    State.on('colorMode', () => applyTheme(true));
    State.on('effectTheme', () => applyTheme(true));
}
