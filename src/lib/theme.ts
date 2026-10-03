export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'budget_theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// Inlined into <head> so the theme is applied before first paint (avoids a light flash),
// and keeps following the OS setting while the preference is "system".
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var media = window.matchMedia('${DARK_QUERY}');
    var apply = function () {
      var pref = localStorage.getItem('${THEME_KEY}') || 'system';
      document.documentElement.classList.toggle('dark', pref === 'dark' || (pref === 'system' && media.matches));
    };
    apply();
    media.addEventListener('change', apply);
  } catch (e) {}
})();`;

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function setThemePreference(preference: ThemePreference): void {
  localStorage.setItem(THEME_KEY, preference);
  const isDark = preference === 'dark' || (preference === 'system' && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle('dark', isDark);
}
