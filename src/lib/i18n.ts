// src/lib/i18n.ts

export type Language = 'en' | 'sw';

const translations: Record<Language, Record<string, string>> = {
  en: {
    // ── Tabs ──────────────────────────────────────────────────────
    tab_home:               'Home',
    tab_children:           'Children',
    tab_growth:             'Growth',
    tab_vaccines:           'Vaccines',
    tab_chat:               'AI Chat',

    // ── Children ──────────────────────────────────────────────────
    active:                 'Active',
    dob_label:              'Born',
    no_children:            'No children yet',
    no_children_hint:       'Add your first child to start tracking their health',
    add_child_btn:          'Add Child',
    manage:                 'Manage',
    select_child:           'Select Child',
    active_child:           'Active Child',
    add_child:              'Add child',

    // ── Home ──────────────────────────────────────────────────────
    quick_access:           'Quick Access',
    growth_desc:            'Track weight & height',
    growth_tracker:         'Growth Tracker',
    vaccines_desc:          'Immunisation schedule',
    nutrition_desc:         'Feeding guidance',
    chat_desc:              'Ask Zuri anything',
    tip:                    'Keep your child\'s vaccine card handy and bring it to every clinic visit.',

    // ── Growth ────────────────────────────────────────────────────
    add_measurement:        'Add Measurement',
    age_months:             'Age (months)',
    history:                'History',
    no_records:             'No measurements yet',
    weight_kg:              'Weight (kg)',
    height_cm:              'Height (cm)',
    weight_placeholder:     'e.g. 12.5',
    height_placeholder:     'e.g. 75.0',
    calculating:            'Saving...',
    calculate_save:         'Save Measurement',
    weight_label:           'Weight',
    height_label:           'Height',

    // ── Settings ──────────────────────────────────────────────────
    settings:               'Settings',
    language:               'Language',
    sign_out:               'Sign Out',

    // ── Meal Plan — screen ────────────────────────────────────────
    meal_plan_title:        'Meal Plan',
    meal_plan_subtitle:     'Today\'s feeding guide',
    meal_plan_for:          'Meal plan for',
    energy_target:          'Energy target',
    texture:                'Texture',
    refresh_plan:           'Refresh Plan',
    generating:             'Generating plan…',
    no_plan:                'No plan yet. Tap Refresh to generate.',
    plan_error:             'Could not generate plan. Tap Refresh to try again.',

    // ── Meal Plan — slot types ─────────────────────────────────────
    slot_breakfast:         'Breakfast',
    slot_morning_snack:     'Morning Snack',
    slot_lunch:             'Lunch',
    slot_afternoon_snack:   'Afternoon Snack',
    slot_dinner:            'Dinner',

    // ── Meal Plan — nutrients ─────────────────────────────────────
    nutrient_iron:          'Iron',
    nutrient_vitamin_a:     'Vitamin A',
    nutrient_vitamin_c:     'Vitamin C',
    nutrient_energy:        'Energy',
    nutrient_omega3:        'Omega-3',
    nutrient_zinc:          'Zinc',
    nutrient_calcium:       'Calcium',
    nutrient_protein:       'Protein',
    nutrient_b12:           'B12',

    // ── Meal Plan — referral ──────────────────────────────────────
    referral_title:         'Clinical Referral Required',
    referral_dismiss:       'I understand',

    // ── Meal Plan — conditions ────────────────────────────────────
    condition_sam:          'Severe Acute Malnutrition',
    condition_mam:          'Moderate Acute Malnutrition',
    condition_stunting:     'Stunting',
    condition_anaemia:      'Iron Anaemia',
    condition_overweight:   'Overweight',

    // ── Meal Plan — severity ──────────────────────────────────────
    severity_critical:      'Critical',
    severity_moderate:      'Moderate',
    severity_stunted:       'Stunted',
    severity_normal:        'Normal',

    // ── Meal Plan — food labels ───────────────────────────────────
    primary_food:           'Main',
    second_food:            'Side',
    third_food:             'Vegetable',
    synergy_note_label:     'Why this works',
    snack_label:            'Snack',
    meal_label:             'Meal',
  },

  sw: {
    // ── Tabs ──────────────────────────────────────────────────────
    tab_home:               'Nyumbani',
    tab_children:           'Watoto',
    tab_growth:             'Ukuaji',
    tab_vaccines:           'Chanjo',
    tab_chat:               'AI Chat',

    // ── Children ──────────────────────────────────────────────────
    active:                 'Amilifu',
    dob_label:              'Alizaliwa',
    no_children:            'Hakuna watoto bado',
    no_children_hint:       'Ongeza mtoto wako wa kwanza kuanza kufuatilia afya yao',
    add_child_btn:          'Ongeza Mtoto',
    manage:                 'Simamia',
    select_child:           'Chagua Mtoto',
    active_child:           'Mtoto Amilifu',
    add_child:              'Ongeza mtoto',

    // ── Home ──────────────────────────────────────────────────────
    quick_access:           'Ufikiaji wa Haraka',
    growth_desc:            'Fuatilia uzito na urefu',
    growth_tracker:         'Kufuatilia Ukuaji',
    vaccines_desc:          'Ratiba ya chanjo',
    nutrition_desc:         'Mwongozo wa kulisha',
    chat_desc:              'Uliza Zuri chochote',
    tip:                    'Beba kadi ya chanjo ya mtoto wako kila unapokwenda kliniki.',

    // ── Growth ────────────────────────────────────────────────────
    add_measurement:        'Ongeza Kipimo',
    age_months:             'Umri (miezi)',
    history:                'Historia',
    no_records:             'Hakuna vipimo bado',
    weight_kg:              'Uzito (kg)',
    height_cm:              'Urefu (cm)',
    weight_placeholder:     'mfano 12.5',
    height_placeholder:     'mfano 75.0',
    calculating:            'Inahifadhi...',
    calculate_save:         'Hifadhi Kipimo',
    weight_label:           'Uzito',
    height_label:           'Urefu',

    // ── Settings ──────────────────────────────────────────────────
    settings:               'Mipangilio',
    language:               'Lugha',
    sign_out:               'Toka',

    // ── Meal Plan — screen ────────────────────────────────────────
    meal_plan_title:        'Mpango wa Chakula',
    meal_plan_subtitle:     'Mwongozo wa kulisha leo',
    meal_plan_for:          'Mpango wa chakula kwa',
    energy_target:          'Lengo la nishati',
    texture:                'Umbile la chakula',
    refresh_plan:           'Onyesha Mpango Mpya',
    generating:             'Inaunda mpango…',
    no_plan:                'Hakuna mpango bado. Bonyeza Onyesha Upya.',
    plan_error:             'Haikuweza kuunda mpango. Bonyeza Onyesha Upya.',

    // ── Meal Plan — slot types ─────────────────────────────────────
    slot_breakfast:         'Kifungua Kinywa',
    slot_morning_snack:     'Vitafunio vya Asubuhi',
    slot_lunch:             'Chakula cha Mchana',
    slot_afternoon_snack:   'Vitafunio vya Alasiri',
    slot_dinner:            'Chakula cha Jioni',

    // ── Meal Plan — nutrients ─────────────────────────────────────
    nutrient_iron:          'Chuma',
    nutrient_vitamin_a:     'Vitamini A',
    nutrient_vitamin_c:     'Vitamini C',
    nutrient_energy:        'Nishati',
    nutrient_omega3:        'Omega-3',
    nutrient_zinc:          'Zinki',
    nutrient_calcium:       'Kalsiamu',
    nutrient_protein:       'Protini',
    nutrient_b12:           'B12',

    // ── Meal Plan — referral ──────────────────────────────────────
    referral_title:         'Rufaa ya Kliniki Inahitajika',
    referral_dismiss:       'Nimeelewa',

    // ── Meal Plan — conditions ────────────────────────────────────
    condition_sam:          'Utapiamlo Mkali',
    condition_mam:          'Utapiamlo wa Wastani',
    condition_stunting:     'Ukuaji Duni',
    condition_anaemia:      'Upungufu wa Chuma',
    condition_overweight:   'Uzito Kupita Kiasi',

    // ── Meal Plan — severity ──────────────────────────────────────
    severity_critical:      'Hatari',
    severity_moderate:      'Wastani',
    severity_stunted:       'Ukuaji Duni',
    severity_normal:        'Kawaida',

    // ── Meal Plan — food labels ───────────────────────────────────
    primary_food:           'Chakula Kikuu',
    second_food:            'Kiambatisho',
    third_food:             'Mboga',
    synergy_note_label:     'Kwa nini hii inafanya kazi',
    snack_label:            'Vitafunio',
    meal_label:             'Mlo',
  },
};

export function t(lang: Language, key: string): string {
  return translations[lang]?.[key] ?? translations['en']?.[key] ?? key;
}

export default translations;