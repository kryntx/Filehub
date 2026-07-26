/** Toast notification component. */

const el = document.getElementById('toast');
let timer = null;

export function show(msg, type = '') {
    el.textContent = msg;
    el.className = 'toast ' + type + ' show';
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 3000);
}
