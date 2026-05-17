import { create } from 'zustand';
import { Language } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

interface SettingsState {
  language: Language;
  setLanguage: (lang: Language, userId?: string) => Promise<void>;
  loadSettings: (userId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'en',

  setLanguage: async (lang, userId) => {
    set({ language: lang });
    if (userId) {
      await supabase.from('user_settings').upsert(
        { user_id: userId, language: lang },
        { onConflict: 'user_id' }
      );
    }
  },

  loadSettings: async (userId) => {
    const { data } = await supabase
      .from('user_settings')
      .select('language')
      .eq('user_id', userId)
      .single();
    if (data?.language) set({ language: data.language as Language });
  },
}));