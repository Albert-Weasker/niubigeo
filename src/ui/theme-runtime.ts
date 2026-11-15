import { THEME_TOKENS_CSS } from "./theme-tokens.js";
import { THEME_LABELS } from "./product-localization.js";

/** Runs in the head, before styles and first paint. */
export const THEME_HEAD_SCRIPT = String.raw`<script>
(() => {
  const key = 'niubigeo-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
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
      button.textContent = copy[preference];
      button.setAttribute('aria-label', copy.action + ': ' + copy[preference]);
      button.setAttribute('title', copy.action + ': ' + copy[preference]);
    });
  };
  const apply = () => {
    document.documentElement.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
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
  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-theme-toggle]')) return;
    setPreference(preference === 'dark' ? 'light' : preference === 'light' ? 'system' : 'dark');
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
