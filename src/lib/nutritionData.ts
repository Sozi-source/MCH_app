// =============================================================================
//  src/lib/nutritionData.ts
//  ZuriHealth — Verified Nutrition & Growth Reference Data
//
//  SOURCES:
//    · WHO IYCF Guidelines, 2003
//    · WHO Complementary Feeding Counselling Guide, 2004
//    · UNICEF IYCF Counselling Cards (latest edition)
//    · Kenya MCH Handbook (Ministry of Health)
//    · Kenya National Nutrition Action Plan (NNAP)
//    · Kenya IMAM Guidelines, 2019
//    · WHO Child Growth Standards
//    · UNICEF Programming Guide — IYCF
//    · Nelson Textbook of Pediatrics, 21st Edition
//    · Krause's Food & Nutrition Care Process, 14th Edition
//    · AAP Pediatric Nutrition Guidelines
//    · Lancet Breastfeeding Series, 2016
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: FEEDING STAGES
// ─────────────────────────────────────────────────────────────────────────────

export interface FeedingStage {
  minMonths: number;
  maxMonths: number;
  stage: string;
  breastfeeding: string;
  mealsPerDay: string;
  snacksPerDay: string;
  texture: string;
  amountPerMeal: string;
  keyFacts: string[];
  source: string;
}

export const FEEDING_STAGES: FeedingStage[] = [
  {
    minMonths: 0,
    maxMonths: 5,
    stage: 'Exclusive Breastfeeding (0-5 months)',
    breastfeeding: 'Breast milk only - on demand, at least 8-12 times per day including at night',
    mealsPerDay: 'Breast milk only - no other foods, water or drinks',
    snacksPerDay: 'None',
    texture: 'Breast milk only',
    amountPerMeal: 'Feed on demand - never restrict or schedule feeds',
    keyFacts: [
      'No water, juice, porridge, or any other food before 6 months - even in hot weather',
      'Breast milk alone provides complete nutrition for the first 6 months of life',
      'Frequent feeding (8-12x/day) builds and maintains milk supply',
      'Colostrum (thick yellow first milk) is critical - it provides immunity; never discard it',
      'Skin-to-skin contact immediately after birth supports successful breastfeeding initiation',
      'Night feeds are important - prolactin (milk hormone) peaks at night',
      'If baby seems unsatisfied, increase feeding frequency before considering supplements',
    ],
    source: 'WHO IYCF Guidelines, 2003; Kenya MCH Handbook; Lancet Breastfeeding Series, 2016',
  },
  {
    minMonths: 6,
    maxMonths: 8,
    stage: 'Introduction of Complementary Foods (6-8 months)',
    breastfeeding: 'Continue breastfeeding on demand - at least 8 times/day; breast milk remains the primary food',
    mealsPerDay: '2-3 meals of complementary food per day',
    snacksPerDay: '1-2 nutritious snacks if child appears hungry between meals',
    texture: 'Smooth thick porridge and well-mashed foods - no lumps, no whole pieces',
    amountPerMeal: 'Start with 2-3 tablespoons and gradually increase to half cup (125 ml)',
    keyFacts: [
      'Breast milk alone is no longer sufficient energy after 6 months - complementary foods are essential',
      'Continue breastfeeding - complementary foods ADD to breast milk, they do not replace it',
      'Iron-rich foods are critical from 6 months: mashed liver, eggs, beans, dark green leaves',
      'Never add salt or sugar to any baby food under 12 months - kidneys cannot safely process them',
      'Introduce one new food at a time; wait 2-3 days before introducing the next new food',
      'Thick porridge provides more energy than thin - a spoon should stand upright in it',
      'Add a small amount of oil or fat (e.g. sunflower oil) to every meal to double energy density',
      'Start with single-ingredient purees and progress to combinations over the first weeks',
    ],
    source: 'WHO Complementary Feeding Counselling Guide, 2004; UNICEF IYCF Counselling Cards; Kenya MCH Handbook',
  },
  {
    minMonths: 9,
    maxMonths: 11,
    stage: 'Expanding Food Variety (9-11 months)',
    breastfeeding: 'Continue breastfeeding on demand - still a major source of nutrition',
    mealsPerDay: '3-4 meals per day',
    snacksPerDay: '1-2 nutritious snacks',
    texture: 'Finely chopped or mashed - small soft lumps are fine; baby is developing chewing skills',
    amountPerMeal: 'Half cup (125 ml) per meal',
    keyFacts: [
      'Baby can now eat most family foods - chop or mash finely, avoid whole hard pieces',
      'Introduce finger foods to develop self-feeding, hand-eye coordination and chewing skills',
      'All 7 WHO food groups should be represented across each day',
      'Add a small amount of oil or fat to every meal - doubles energy density',
      'Liver once a week provides the best source of iron, zinc and vitamin A in one food',
      'Introduce cup drinking to prepare for transition away from bottle after 12 months',
      'Gagging is normal at this stage - it is different from choking; do not stop introducing textures',
    ],
    source: 'WHO IYCF Guidelines, 2003; UNICEF IYCF Counselling Cards; Nelson Textbook of Pediatrics, 21st Ed.',
  },
  {
    minMonths: 12,
    maxMonths: 23,
    stage: 'Family Foods (12-23 months)',
    breastfeeding: 'Continue breastfeeding up to 2 years and beyond - still provides ~50% of energy needs at 12-24 months',
    mealsPerDay: '3-4 meals per day',
    snacksPerDay: '1-2 nutritious snacks',
    texture: 'Family foods - chop or mash only as needed',
    amountPerMeal: '3/4 to 1 full cup (175-250 ml) per meal',
    keyFacts: [
      'Breast milk still provides approximately 50% of energy needs at 12-24 months - keep breastfeeding',
      'Never give honey under 12 months - risk of infant botulism which can be fatal',
      'Avoid sugary drinks, salty snacks, and all ultra-processed foods',
      'All 7 WHO food groups daily - dietary variety is the key to micronutrient adequacy',
      'Whole nuts are a choking hazard before age 5 - always use smooth nut paste or butter',
      'Responsive feeding: watch for hunger cues; never force-feed or use food as reward or punishment',
      'Transition fully to cup; bottle-feeding beyond 12 months increases risk of tooth decay',
      'Vitamin A supplementation every 6 months - collect at MCH clinic (Kenya National Programme)',
      'Deworming every 6 months from 12 months of age - Kenya MoH guideline',
    ],
    source: 'WHO IYCF Guidelines, 2003; Kenya National Nutrition Action Plan; AAP Guidelines; Kenya MCH Handbook',
  },
  {
    minMonths: 24,
    maxMonths: 999,
    stage: 'Toddler & Young Child Nutrition (24 months+)',
    breastfeeding: 'Breastfeeding can continue as long as mother and child choose - there is no upper age limit',
    mealsPerDay: '3 main meals per day',
    snacksPerDay: '2 healthy snacks',
    texture: 'All family foods - same as the rest of the family',
    amountPerMeal: '1 cup (250 ml) or more per meal, based on child appetite',
    keyFacts: [
      'Healthy eating patterns established now have lasting effects through childhood and adult life',
      'Limit all sugar, salt, and ultra-processed and fast foods',
      'Vitamin A supplementation every 6 months at MCH clinic (up to age 5)',
      'Deworming every 6 months - Kenya MoH guideline',
      'Iron-rich foods remain essential: beans, meat, fish, dark green leafy vegetables',
      'Ensure adequate calcium: milk, yoghurt, fish with edible bones (e.g. omena/dagaa)',
      'Encourage self-feeding and participation in family mealtimes',
      'Screen for anaemia at 24 months at the MCH clinic',
    ],
    source: "Krause's Food & Nutrition Care Process, 14th Ed.; Kenya KEPH; Kenya MCH Handbook",
  },
];

export function getFeedingStage(ageMonths: number): FeedingStage {
  return (
    FEEDING_STAGES.find((s) => ageMonths >= s.minMonths && ageMonths <= s.maxMonths) ??
    FEEDING_STAGES[FEEDING_STAGES.length - 1]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: WHO FOOD GROUPS (Minimum Dietary Diversity)
// ─────────────────────────────────────────────────────────────────────────────

export interface FoodGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
  bg: string;
  examples: string;
  whyImportant: string;
  minAgeMonths: number;
}

export const FOOD_GROUPS: FoodGroup[] = [
  {
    id: 'grains',
    name: 'Grains, Roots & Tubers',
    icon: 'leaf',
    color: '#C97B2A',
    bg: '#FEF3E2',
    examples: 'Ugali, rice, bread, potatoes, cassava, sweet potato, millet, sorghum',
    whyImportant: 'Primary energy source for growth and physical activity',
    minAgeMonths: 6,
  },
  {
    id: 'legumes',
    name: 'Legumes & Nuts',
    icon: 'ellipse',
    color: '#7B6E2A',
    bg: '#F5F0DC',
    examples: 'Beans, lentils, groundnuts, peas, cowpeas, soybeans, green grams',
    whyImportant: 'Affordable plant protein and iron - staple of the Kenyan diet',
    minAgeMonths: 6,
  },
  {
    id: 'dairy',
    name: 'Dairy Products',
    icon: 'water',
    color: '#2A7BA8',
    bg: '#E8F4FB',
    examples: 'Milk, fermented milk (mursik), yoghurt, cheese',
    whyImportant: 'Calcium for bone development; high-quality protein for growth',
    minAgeMonths: 6,
  },
  {
    id: 'flesh',
    name: 'Flesh Foods',
    icon: 'restaurant',
    color: '#A83232',
    bg: '#FAEAEA',
    examples: 'Beef, chicken, fish (tilapia, omena/dagaa), goat, liver, kidney',
    whyImportant: 'Best source of haem iron (most absorbable form), zinc, and vitamin B12',
    minAgeMonths: 6,
  },
  {
    id: 'eggs',
    name: 'Eggs',
    icon: 'sunny',
    color: '#C97B2A',
    bg: '#FEF8E8',
    examples: 'Boiled egg, scrambled egg, mashed egg yolk',
    whyImportant: 'Complete protein, iron, choline for brain development - affordable and widely available',
    minAgeMonths: 6,
  },
  {
    id: 'vita_fruits_veg',
    name: 'Vitamin A-Rich Fruits & Veg',
    icon: 'color-palette',
    color: '#E07A5F',
    bg: '#FEF3EF',
    examples: 'Carrots, pumpkin, yellow sweet potato, mango, papaya, sukuma wiki, amaranth, cowpea leaves',
    whyImportant: 'Vitamin A for immune function and vision; iron in dark green leaves',
    minAgeMonths: 6,
  },
  {
    id: 'other_fruits_veg',
    name: 'Other Fruits & Vegetables',
    icon: 'nutrition',
    color: '#2A9D6E',
    bg: '#F0FAF5',
    examples: 'Banana, avocado, tomatoes, cabbage, onions, watermelon, pawpaw',
    whyImportant: 'Vitamin C (enhances iron absorption), fibre, folate, and other micronutrients',
    minAgeMonths: 6,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: MDD SCORING
// ─────────────────────────────────────────────────────────────────────────────

export interface MDDStatus {
  score: number;
  label: string;
  color: string;
  bg: string;
  message: string;
}

export function getMDDStatus(checked: Record<string, boolean>): MDDStatus {
  const score = Object.values(checked).filter(Boolean).length;
  if (score >= 5)
    return { score, label: 'Excellent', color: '#2A9D6E', bg: '#F0FAF5', message: 'Outstanding dietary diversity - well above the WHO minimum.' };
  if (score >= 4)
    return { score, label: 'Adequate',  color: '#2A9D6E', bg: '#F0FAF5', message: 'Good! WHO recommends at least 4 food groups daily.' };
  if (score >= 2)
    return { score, label: 'Low',       color: '#E07A5F', bg: '#FEF3EF', message: 'Try to include more food groups today. Aim for at least 4.' };
  return   { score, label: 'Very Low',  color: '#C0392B', bg: '#FDF0F0', message: 'Your child needs more variety. Add foods from more groups today.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: VERIFIED IYCF TIPS
// ─────────────────────────────────────────────────────────────────────────────

export interface IYCFTip {
  tip: string;
  source: string;
  ageMin: number;
  ageMax: number;
}

export const IYCF_TIPS: IYCFTip[] = [
  {
    tip: 'Add a small amount of oil or fat to every complementary meal - it doubles the energy density and helps absorb vitamins A, D, E and K.',
    source: 'UNICEF IYCF Counselling Cards',
    ageMin: 6, ageMax: 999,
  },
  {
    tip: 'Liver is one of the best first foods at 6 months - rich in iron, zinc, and vitamin A. Offer mashed liver once a week.',
    source: 'WHO Complementary Feeding Counselling Guide, 2004',
    ageMin: 6, ageMax: 24,
  },
  {
    tip: 'Thick porridge has far more energy than thin watery porridge. If a spoon stands upright in it, the consistency is right for a 6-8 month old.',
    source: 'UNICEF IYCF Counselling Cards',
    ageMin: 6, ageMax: 12,
  },
  {
    tip: 'Never add salt or sugar to any food for a baby under 12 months - their kidneys cannot safely process sodium, and sugar promotes unhealthy eating patterns.',
    source: 'Kenya MCH Handbook; WHO IYCF Guidelines',
    ageMin: 0, ageMax: 12,
  },
  {
    tip: 'Sukuma wiki (kale) is rich in iron, but pair it with a vitamin C food (tomato, lemon juice) to significantly improve how much iron the body absorbs.',
    source: "Krause's Food & Nutrition Care Process, 14th Ed.",
    ageMin: 6, ageMax: 999,
  },
  {
    tip: 'Eggs are a complete protein and one of the most affordable nutritious foods in Kenya. Introduce at 6 months - scrambled or mashed.',
    source: 'WHO IYCF Guidelines, 2003',
    ageMin: 6, ageMax: 24,
  },
  {
    tip: 'Breast milk still provides approximately 50% of a toddler\'s energy needs at 12-24 months. Continue breastfeeding up to 2 years and beyond.',
    source: 'WHO IYCF Guidelines, 2003; Lancet Breastfeeding Series, 2016',
    ageMin: 12, ageMax: 999,
  },
  {
    tip: 'Responsive feeding: watch your baby\'s hunger cues (opening mouth, reaching for food) and fullness cues (turning away). Never force-feed.',
    source: 'UNICEF Programming Guide - IYCF',
    ageMin: 6, ageMax: 999,
  },
  {
    tip: 'Never give honey to babies under 12 months - it can cause infant botulism, a potentially fatal illness caused by Clostridium botulinum spores.',
    source: 'Nelson Textbook of Pediatrics, 21st Ed.; Kenya MCH Handbook',
    ageMin: 0, ageMax: 12,
  },
  {
    tip: 'Groundnut (peanut) paste is an excellent energy and protein food from 6 months. Never give whole nuts before age 5 - serious choking hazard.',
    source: 'AAP Guidelines; Kenya MCH Handbook',
    ageMin: 6, ageMax: 999,
  },
  {
    tip: 'Exclusive breastfeeding for the first 6 months protects against diarrhoea, pneumonia and ear infections - the leading killers of children under 5 in Kenya.',
    source: 'WHO IYCF Guidelines, 2003; Lancet Breastfeeding Series, 2016',
    ageMin: 0, ageMax: 6,
  },
  {
    tip: 'Omena (dagaa/silver cyprinid) is an affordable iron-rich and calcium-rich fish widely available in Kenya. Mash finely for babies from 8 months.',
    source: 'Kenya National Nutrition Action Plan; Kenya MCH Handbook',
    ageMin: 8, ageMax: 999,
  },
  {
    tip: 'Vitamin A supplementation is provided free at Kenya MCH clinics every 6 months from age 6 months to 5 years. Do not miss these doses.',
    source: 'Kenya National Nutrition Action Plan; Kenya MoH',
    ageMin: 6, ageMax: 60,
  },
  {
    tip: 'Deworming tablets are provided free at Kenya MCH clinics every 6 months from 12 months of age. Worms cause anaemia and stunt growth.',
    source: 'Kenya MoH Deworming Programme; WHO Guideline on Preventive Chemotherapy',
    ageMin: 12, ageMax: 999,
  },
  {
    tip: 'Uji (fermented porridge) made from millet or sorghum has higher iron and zinc content than maize porridge, and fermentation improves mineral absorption.',
    source: "Krause's Food & Nutrition Care Process, 14th Ed.",
    ageMin: 6, ageMax: 24,
  },
];

export function getTipsForAge(ageMonths: number): IYCFTip[] {
  return IYCF_TIPS.filter((t) => ageMonths >= t.ageMin && ageMonths <= t.ageMax);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: Z-SCORE THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────

export type ZIndicator = 'WAZ' | 'HAZ' | 'WHZ';
export type AlertUrgency = 'urgent' | 'monitor' | 'normal';

export interface ZScoreThreshold {
  indicator: ZIndicator;
  threshold: string;
  min: number;
  max: number;
  classification: string;
  action: string;
  urgency: AlertUrgency;
}

export const ZSCORE_THRESHOLDS: ZScoreThreshold[] = [
  {
    indicator: 'WHZ',
    threshold: '< -3 (SAM)',
    min: -Infinity,
    max: -3,
    classification: 'Severe Acute Malnutrition (SAM)',
    action: 'Refer to hospital or inpatient therapeutic feeding centre immediately. Child qualifies for Ready-to-Use Therapeutic Food (RUTF). Do not delay.',
    urgency: 'urgent',
  },
  {
    indicator: 'WHZ',
    threshold: '-3 to -2 (MAM)',
    min: -3,
    max: -2,
    classification: 'Moderate Acute Malnutrition (MAM)',
    action: 'Refer to nearest MCH clinic for enrolment in Supplementary Feeding Programme (SFP). Increase meal frequency and energy density immediately.',
    urgency: 'urgent',
  },
  {
    indicator: 'WHZ',
    threshold: '> 2 (Overweight)',
    min: 2,
    max: 3,
    classification: 'Overweight',
    action: 'Review feeding practices with an MCH nurse. Avoid high-sugar foods, sweetened drinks, and excessive snacking. Monitor monthly.',
    urgency: 'monitor',
  },
  {
    indicator: 'WHZ',
    threshold: '> 3 (Obese)',
    min: 3,
    max: Infinity,
    classification: 'Obese',
    action: 'Refer to MCH clinic for full dietary assessment and counselling. Urgent review of feeding practices required.',
    urgency: 'urgent',
  },
  {
    indicator: 'WAZ',
    threshold: '< -3 (Severely Underweight)',
    min: -Infinity,
    max: -3,
    classification: 'Severely Underweight',
    action: 'Refer to MCH clinic immediately. Investigate underlying cause (illness, feeding problems, or social factors). Initiate nutritional rehabilitation.',
    urgency: 'urgent',
  },
  {
    indicator: 'WAZ',
    threshold: '-3 to -2 (Underweight)',
    min: -3,
    max: -2,
    classification: 'Underweight',
    action: 'Increase meal frequency and energy density (add oil/fat to every meal). Ensure all 7 food groups are covered daily. Review at next MCH visit.',
    urgency: 'monitor',
  },
  {
    indicator: 'HAZ',
    threshold: '< -3 (Severe Stunting)',
    min: -Infinity,
    max: -3,
    classification: 'Severe Stunting',
    action: 'Refer to MCH nutritionist for full assessment. Severe stunting reflects prolonged chronic undernutrition - urgent multi-disciplinary review needed.',
    urgency: 'urgent',
  },
  {
    indicator: 'HAZ',
    threshold: '-3 to -2 (Stunting)',
    min: -3,
    max: -2,
    classification: 'Stunting',
    action: 'Improve dietary diversity and feeding frequency. Focus on protein and micronutrient-rich foods. Monitor weight and height monthly at MCH clinic.',
    urgency: 'monitor',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: Z-SCORE ALERT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

export interface ActiveAlert {
  indicator: ZIndicator;
  threshold: string;
  classification: string;
  action: string;
  urgency: AlertUrgency;
}

export function getZScoreAlerts(
  waz: number | null,
  haz: number | null,
  whz: number | null,
  ageMonths: number = 12,
): ActiveAlert[] {
  const scores: { indicator: ZIndicator; value: number | null }[] = [
    { indicator: 'WHZ', value: whz },
    { indicator: 'WAZ', value: waz },
    { indicator: 'HAZ', value: haz },
  ];

  const alerts: ActiveAlert[] = [];

  for (const { indicator, value } of scores) {
    if (value === null || value === undefined) continue;

    const matched = ZSCORE_THRESHOLDS.filter(
      (t) => t.indicator === indicator && value >= t.min && value < t.max,
    ).sort((a, b) => {
      if (a.urgency === 'urgent' && b.urgency !== 'urgent') return -1;
      if (b.urgency === 'urgent' && a.urgency !== 'urgent') return 1;
      return 0;
    })[0];

    if (matched) {
      let action = matched.action;

      // Age-sensitive action overrides
      if (ageMonths < 6) {
        // Under 6 months: exclusive breastfeeding period � no complementary food advice
        if (matched.indicator === 'WHZ' && matched.urgency === 'urgent') {
          action = 'Your baby is under 6 months and showing signs of acute malnutrition. Increase breastfeeding frequency immediately � feed on demand at least 10-12 times per day including at night. Do NOT give any other foods or fluids. Refer to the nearest MCH clinic or hospital TODAY for therapeutic assessment.';
        } else if (matched.indicator === 'WAZ' && matched.urgency === 'urgent') {
          action = 'Your baby is under 6 months and severely underweight. This requires urgent review. Ensure exclusive breastfeeding on demand (no water, no formula, no porridge). Go to the nearest MCH clinic or hospital immediately � the baby may need inpatient nutritional support.';
        } else if (matched.indicator === 'HAZ') {
          action = 'Stunting at this age reflects poor nutrition before or shortly after birth. Ensure the mother is eating well and breastfeeding exclusively on demand. Attend your next MCH clinic visit and inform the nurse.';
        } else if (matched.urgency === 'monitor') {
          action = 'Continue exclusive breastfeeding on demand. Monitor weight weekly at home or at the MCH clinic. No complementary foods should be introduced before 6 months.';
        }
      } else if (ageMonths < 12) {
        // 6�11 months: just starting complementary foods
        if (matched.indicator === 'WHZ' && matched.urgency === 'urgent') {
          action = 'Your baby has acute malnutrition. Continue breastfeeding on demand AND increase complementary meal frequency to 3-4 times per day. Add energy-dense foods: mashed liver, eggs, groundnut paste, mashed beans with oil. Refer to MCH clinic immediately for enrolment in the Supplementary Feeding Programme (SFP).';
        } else if (matched.indicator === 'WAZ' && matched.urgency === 'urgent') {
          action = 'Your baby is severely underweight. Breastfeed on demand AND offer 3-4 complementary meals daily. Focus on iron-rich foods (mashed liver once a week, eggs, beans) and always add a teaspoon of oil to every meal. Go to the MCH clinic immediately.';
        } else if (matched.indicator === 'HAZ') {
          action = 'Stunting at this age means your baby has had prolonged inadequate nutrition. Increase meal frequency to 3 times per day, add variety across all 7 food groups, and continue breastfeeding. Visit the MCH clinic for a full nutritional assessment.';
        } else if (matched.urgency === 'monitor') {
          action = matched.action + ' At this age, continue breastfeeding and ensure 2-3 complementary meals per day with iron-rich foods and added oil or fat.';
        }
      } else if (ageMonths < 24) {
        // 12�23 months: family foods, breastfeeding still important
        if (matched.indicator === 'WHZ' && matched.urgency === 'urgent') {
          action = 'Your child has acute malnutrition. Offer 3-4 meals and 1-2 nutritious snacks daily. Include: eggs, mashed liver, groundnut paste, omena, beans, and always add oil to meals. Continue breastfeeding. Refer to MCH clinic immediately for RUTF or SFP assessment.';
        } else if (matched.indicator === 'WAZ' && matched.urgency === 'urgent') {
          action = 'Your child is severely underweight. Increase meal frequency to 4 times per day with energy-dense foods. Continue breastfeeding � it still provides up to 50% of energy needs. Visit the MCH clinic urgently.';
        } else if (matched.urgency === 'monitor') {
          action = matched.action + ' Ensure your child gets 3 meals and 1-2 snacks daily with foods from all 7 food groups. Continue breastfeeding up to 2 years.';
        }
      } else {
        // 24+ months: toddler diet
        if (matched.urgency === 'urgent') {
          action = matched.action + ' At this age, offer 3 main meals and 2 healthy snacks daily. Focus on protein-rich foods (eggs, beans, meat, fish), dark green leafy vegetables, and vitamin A-rich foods. Limit sugary drinks and processed foods.';
        } else if (matched.urgency === 'monitor') {
          action = matched.action + ' Ensure dietary variety across all food groups daily. If breastfeeding has stopped, ensure adequate dairy (milk, yoghurt) or calcium-rich alternatives.';
        }
      }

      alerts.push({
        indicator: matched.indicator,
        threshold: matched.threshold,
        classification: matched.classification,
        action,
        urgency: matched.urgency,
      });
    }
  }

  return alerts.sort((a, b) => {
    if (a.urgency === 'urgent' && b.urgency !== 'urgent') return -1;
    if (b.urgency === 'urgent' && a.urgency !== 'urgent') return 1;
    return 0;
  });
}

export function getZScoreDisplay(z: number | null): {
  label: string;
  color: string;
  bg: string;
} {
  if (z === null || z === undefined)
    return { label: 'N/A',          color: '#9CA3AF', bg: '#F3F4F6' };
  if (z < -3)
    return { label: 'Severely Low', color: '#A32D2D', bg: '#FCEBEB' };
  if (z < -2)
    return { label: 'Low',          color: '#854F0B', bg: '#FAEEDA' };
  if (z > 3)
    return { label: 'Obese',        color: '#7B3FA0', bg: '#F3E8FC' };
  if (z > 2)
    return { label: 'High',         color: '#185FA5', bg: '#E6F1FB' };
  return   { label: 'Normal',       color: '#0F6E56', bg: '#E1F5EE' };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: PREVENTIVE CARE SCHEDULE (Kenya)
// ─────────────────────────────────────────────────────────────────────────────

export interface PreventiveCareItem {
  id: string;
  name: string;
  schedule: string;
  startAgeMonths: number;
  intervalMonths: number | null;
  notes: string;
  source: string;
}

export const PREVENTIVE_CARE: PreventiveCareItem[] = [
  {
    id: 'vitamin_a',
    name: 'Vitamin A Supplementation',
    schedule: 'Every 6 months from age 6 months to 5 years (60 months)',
    startAgeMonths: 6,
    intervalMonths: 6,
    notes: 'Given free at all Kenya MCH clinics. Dose: 100,000 IU at 6-11 months; 200,000 IU from 12 months+.',
    source: 'Kenya National Nutrition Action Plan; Kenya MoH',
  },
  {
    id: 'deworming',
    name: 'Deworming (Mebendazole/Albendazole)',
    schedule: 'Every 6 months from age 12 months',
    startAgeMonths: 12,
    intervalMonths: 6,
    notes: 'Given free at Kenya MCH clinics. Worms cause iron-deficiency anaemia and impair growth.',
    source: 'Kenya MoH Deworming Programme; WHO Guideline on Preventive Chemotherapy, 2017',
  },
  {
    id: 'iron_folic',
    name: 'Iron & Folic Acid Supplementation',
    schedule: 'Daily for 3 months if anaemia is detected; per clinician advice',
    startAgeMonths: 6,
    intervalMonths: null,
    notes: 'Indicated when Hb < 11 g/dL. Ferrous sulfate + folic acid. Confirm with blood test at MCH. Pair with vitamin C-rich foods to improve absorption.',
    source: 'WHO Guideline on Use of Ferritin for Iron Deficiency Anaemia; Kenya MCH Handbook',
  },
  {
    id: 'zinc',
    name: 'Zinc Supplementation (Diarrhoea Management)',
    schedule: 'During diarrhoea episodes only - 10 mg/day for 10-14 days (6-59 months)',
    startAgeMonths: 6,
    intervalMonths: null,
    notes: 'Reduces duration and severity of diarrhoea. Always given alongside ORS. Not routine daily supplementation.',
    source: 'WHO/UNICEF Joint Statement on Zinc; Kenya IMAM Guidelines, 2019',
  },
];
