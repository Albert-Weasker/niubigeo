import { THEME_TOKENS_CSS } from "./theme-tokens.js";
import { THEME_LABELS } from "./product-localization.js";

/** Runs in the head, before styles and first paint. */
export const THEME_HEAD_SCRIPT = String.raw`<script>
(() => {
  const key = 'niubigeo-theme';
  const media = window.matchMedia('(prefers-color-scheme: light)');
  let preference = 'dark';
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === 'dark' || saved === 'light' || saved === 'system') preference = saved;
  } catch { /* Private browsing can disable storage. */ }
  const labels = ${JSON.stringify(THEME_LABELS)};
  const locale = () => {
    try {
      const saved = window.localStorage.getItem('niubigeo.product.locale');
      if (saved === 'en' || saved === 'pt-BR') return saved;
    } catch { /* Use the document language. */ }
    const lang = document.documentElement.lang;
    return lang === 'en' || lang === 'pt-BR' ? lang : 'zh-CN';
  };
  const paintButton = () => {
    const copy = labels[locale()];
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const label = copy.menu.replace('{current}', copy[preference]);
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });
    document.querySelectorAll('[data-theme-options]').forEach(menu => {
      menu.setAttribute('aria-label', copy.menu.replace('{current}', copy[preference]));
      menu.querySelectorAll('[data-theme-option]').forEach(option => {
        option.textContent = copy[option.dataset.themeOption];
        option.setAttribute('aria-checked', String(option.dataset.themeOption === preference));
      });
    });
  };
  const apply = () => {
    document.documentElement.dataset.theme = preference === 'system' ? (media.matches ? 'light' : 'dark') : preference;
    document.documentElement.dataset.themePreference = preference;
    paintButton();
  };
  const setPreference = value => {
    preference = value;
    try { window.localStorage.setItem(key, preference); } catch { /* Keep the session choice. */ }
    apply();
  };
  apply();
  media.addEventListener('change', () => { if (preference === 'system') apply(); });
  const closeMenu = menu => {
    menu.hidden = true;
    menu.parentElement.querySelector('[data-theme-toggle]').setAttribute('aria-expanded', 'false');
  };
  const openMenu = (menu, focusOption = false) => {
    menu.hidden = false;
    menu.parentElement.querySelector('[data-theme-toggle]').setAttribute('aria-expanded', 'true');
    if (focusOption) menu.querySelector('[data-theme-option="' + preference + '"]').focus();
  };
  document.addEventListener('click', event => {
    const option = event.target.closest?.('[data-theme-option]');
    if (option) {
      setPreference(option.dataset.themeOption);
      closeMenu(option.closest('[data-theme-options]'));
      option.closest('.theme-menu').querySelector('[data-theme-toggle]').focus();
      return;
    }
    const toggle = event.target.closest?.('[data-theme-toggle]');
    if (toggle) {
      const menu = toggle.parentElement.querySelector('[data-theme-options]');
      if (menu.hidden) openMenu(menu);
      else closeMenu(menu);
      return;
    }
    document.querySelectorAll('[data-theme-options]:not([hidden])').forEach(closeMenu);
  });
  document.addEventListener('focusin', event => {
    if (!event.target.closest?.('.theme-menu')) document.querySelectorAll('[data-theme-options]:not([hidden])').forEach(closeMenu);
  });
  document.addEventListener('keydown', event => {
    const toggle = event.target.closest?.('[data-theme-toggle]');
    const menu = event.target.closest?.('[data-theme-options]') || toggle?.parentElement.querySelector('[data-theme-options]');
    if (!menu) return;
    if (event.key === 'Escape') {
      closeMenu(menu);
      menu.parentElement.querySelector('[data-theme-toggle]').focus();
      return;
    }
    if (toggle && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      openMenu(menu, true);
      return;
    }
    if (event.target.closest?.('[data-theme-option]') && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const options = [...menu.querySelectorAll('[data-theme-option]')];
      const step = event.key === 'ArrowDown' ? 1 : -1;
      options[(options.indexOf(event.target) + step + options.length) % options.length].focus();
    }
  });
  document.addEventListener('DOMContentLoaded', paintButton);
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    preference = event.newValue === 'dark' || event.newValue === 'light' || event.newValue === 'system' ? event.newValue : 'dark';
    apply();
  });
  window.niubigeoTheme = Object.freeze({ get preference() { return preference; }, setPreference, refresh: paintButton });
})();
</script>`;

export function renderThemeHead(): string {
  return `<meta name="color-scheme" content="dark light">${THEME_HEAD_SCRIPT}<style>${THEME_TOKENS_CSS}</style>`;
}
