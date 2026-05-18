import { t, Language } from '@/lib/i18n';
import { useSettingsStore } from '@/store/settingsStore';

export function useT() {
  const { language } = useSettingsStore();
  return (key: string) => t(language as Language, key);
}