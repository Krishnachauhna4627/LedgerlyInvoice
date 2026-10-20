// Available themes. To add one: create src/styles/themes/_<id>.scss, import it in styles.scss, add it here.
export const THEMES = [{ id: 'clean-indigo', label: 'Clean Indigo' }] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'clean-indigo';
