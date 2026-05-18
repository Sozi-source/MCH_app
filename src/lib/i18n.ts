export type Language = 'en' | 'sw';

const translations: Record<Language, Record<string, string>> = {
  en: {
    tab_home:        'Home',
    tab_children:    'Children',
    tab_growth:      'Growth',
    tab_vaccines:    'Vaccines',
    tab_chat:        'AI Chat',
    active:          'Active',
    dob_label:       'Born',
    no_children:     'No children yet',
    no_children_hint:'Add your first child to start tracking their health',
    add_child_btn:   'Add Child',
    manage:          'Manage',
    select_child:    'Select Child',
    active_child:    'Active Child',
    add_child:       'Add child',
    quick_access:    'Quick Access',
    growth_desc:     'Track weight & height',
    vaccines_desc:   'Immunisation schedule',
    nutrition_desc:  'Feeding guidance',
    chat_desc:       'Ask Zuri anything',
    tip:             'Keep your child\'s vaccine card handy and bring it to every clinic visit.',
    settings:        'Settings',
    language:        'Language',
    sign_out:        'Sign Out',
  },
  sw: {
    tab_home:        'Nyumbani',
    tab_children:    'Watoto',
    tab_growth:      'Ukuaji',
    tab_vaccines:    'Chanjo',
    tab_chat:        'AI Chat',
    active:          'Amilifu',
    dob_label:       'Alizaliwa',
    no_children:     'Hakuna watoto bado',
    no_children_hint:'Ongeza mtoto wako wa kwanza kuanza kufuatilia afya yao',
    add_child_btn:   'Ongeza Mtoto',
    manage:          'Simamia',
    select_child:    'Chagua Mtoto',
    active_child:    'Mtoto Amilifu',
    add_child:       'Ongeza mtoto',
    quick_access:    'Ufikiaji wa Haraka',
    growth_desc:     'Fuatilia uzito na urefu',
    vaccines_desc:   'Ratiba ya chanjo',
    nutrition_desc:  'Mwongozo wa kulisha',
    chat_desc:       'Uliza Zuri chochote',
    tip:             'Beba kadi ya chanjo ya mtoto wako kila unapokwenda kliniki.',
    settings:        'Mipangilio',
    language:        'Lugha',
    sign_out:        'Toka',
  },
};

export function t(lang: Language, key: string): string {
  return translations[lang]?.[key] ?? translations['en']?.[key] ?? key;
}

export default translations;