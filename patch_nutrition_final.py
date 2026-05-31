# -*- coding: ascii -*-
import shutil, sys, re
from pathlib import Path

FILE = Path("src/app/(tabs)/nutrition.tsx")
if not FILE.exists():
    sys.exit("ERROR: file not found.")

shutil.copy(FILE, FILE.with_suffix(".tsx.bak"))
content = FILE.read_text(encoding="utf-8")
changes = []

# 1. Fix corrupted characters
em_dash   = "\u2014"
mid_dot   = "\u00b7"
times     = "\u00d7"
arrow     = "\u2192"
ellipsis  = "\u2026"
bad_pairs = [
    ("\u00e2\u20ac\u201d", em_dash),
    ("\u00e2\u20ac\u201c", em_dash),
    ("\u00c2\u00b7", mid_dot),
    ("\u00c3\u00d7", times),
    ("\u00e2\u2020\u2019", arrow),
    ("\u00e2\u20ac\u00a6", ellipsis),
    ("\u00c3\u00b0\u0178\u0161\u00aa", "\U0001f33f"),
    ("\u00c3\u00b0\u0178\u0161\u00b8", "\U0001f4a7"),
]
for bad, good in bad_pairs:
    if bad in content:
        content = content.replace(bad, good)
changes.append("1. Corrupted characters fixed")

# 2. Remove duplicate mc style keys
def remove_second(text, key):
    first = text.find(key)
    if first == -1: return text, False
    second = text.find(key, first + len(key))
    if second == -1: return text, False
    end = text.find("\n", second)
    return text[:second] + text[end+1:], True

content, a = remove_second(content, "  foodSummary:")
content, b = remove_second(content, "  expandedContent:")
changes.append("2. Duplicate mc styles removed (foodSummary=%s, expandedContent=%s)" % (a, b))

# 3. Make MealCard body collapsible
old3 = (
    "          </View>\n\n"
    "          {/* Time + max serving */}\n"
    "          <View style={mc.metaRow}>\n"
    "            <Ionicons name=\"time-outline\" size={12} color={COLORS.textMuted} />\n"
    "            <Text style={mc.metaText}>{MEAL_TIMES[slot.type]}</Text>\n"
    "            {slot.primaryFood.max_serving_g != null && (\n"
    "              <>\n"
    "                <View style={mc.dot} />\n"
    "                <Ionicons name=\"scale-outline\" size={12} color={COLORS.due} />\n"
    "                <Text style={[mc.metaText, { color: COLORS.due }]}>\n"
    "                  Max {slot.primaryFood.max_serving_g}g\n"
    "                </Text>\n"
    "              </>\n"
    "            )}\n"
    "          </View>\n\n"
    "          {/* Nutrient tags \u2014 translated */}\n"
    "          <View style={mc.tags}>\n"
    "            {slot.nutrients.map(tag => {\n"
    "              const ts = tagStyle(tag);\n"
    "              const label = t(NUTRIENT_KEY[tag] ?? tag);\n"
    "              return (\n"
    "                <View key={tag} style={[mc.tag, { backgroundColor: ts.bg }]}>\n"
    "                  <Text style={[mc.tagText, { color: ts.color }]}>{label}</Text>\n"
    "                </View>\n"
    "              );\n"
    "            })}\n"
    "          </View>\n\n"
    "          {/* Foods breakdown */}\n"
    "          <View style={mc.foodsRow}>\n"
    "            {[slot.primaryFood, slot.secondFood, slot.thirdFood]\n"
    "              .filter(Boolean)\n"
    "              .map(food => (\n"
    "                <View key={food!.food_id} style={mc.foodChip}>\n"
    "                  <Text style={mc.foodEmoji}>{pickEmoji(food!.food_name, food!.who_group, food!.food_id)}</Text>\n"
    "                  <Text style={mc.foodName} numberOfLines={1}>\n"
    "                    {food!.local_name ?? food!.food_name}\n"
    "                  </Text>\n"
    "                  {food!.energy_kcal != null && (\n"
    "                    <Text style={mc.foodKcal}>{Math.round(food!.energy_kcal)} kcal</Text>\n"
    "                  )}\n"
    "                </View>\n"
    "              ))}\n"
    "          </View>\n\n"
    "          {/* Synergy note */}\n"
    "          {!!slot.synergyNote && (\n"
    "            <View style={mc.synergyBox}>\n"
    "              <Ionicons name=\"flash-outline\" size={11} color={COLORS.primary} />\n"
    "              <Text style={mc.synergyText}>\n"
    "                <Text style={{ fontFamily: FONTS.semibold }}>{t('synergy_note_label')}: </Text>\n"
    "                {slot.synergyNote}\n"
    "              </Text>\n"
    "            </View>\n"
    "          )}\n\n"
    "          <View style={mc.divider} />\n"
    "          <View style={{ flexDirection: 'row', gap: 8 }}>\n"
    "            <TouchableOpacity style={mc.swapBtn} onPress={() => onSwap(slot)} activeOpacity={0.7}>\n"
    "              <Ionicons name=\"swap-horizontal-outline\" size={14} color={COLORS.primary} />\n"
    "              <Text style={mc.swapText}>Swap food</Text>\n"
    "            </TouchableOpacity>\n"
    "          </View>\n\n"
    "        </View>\n"
    "      </View>\n"
    "    </Animated.View>\n"
    "  );\n"
    "});\n"
    "MealCard.displayName = 'MealCard';"
)

new3 = (
    "          </View>\n\n"
    "          {!expanded && (\n"
    "            <Text style={mc.foodSummary} numberOfLines={1}>\n"
    "              {[slot.primaryFood, slot.secondFood, slot.thirdFood]\n"
    "                .filter(Boolean)\n"
    "                .map(f => f!.local_name ?? f!.food_name)\n"
    "                .join(' \u00b7 ')}\n"
    "            </Text>\n"
    "          )}\n\n"
    "          {expanded && (\n"
    "            <View style={mc.expandedContent}>\n\n"
    "              <View style={mc.metaRow}>\n"
    "                <Ionicons name=\"time-outline\" size={12} color={COLORS.textMuted} />\n"
    "                <Text style={mc.metaText}>{MEAL_TIMES[slot.type]}</Text>\n"
    "                {slot.primaryFood.max_serving_g != null && (\n"
    "                  <>\n"
    "                    <View style={mc.dot} />\n"
    "                    <Ionicons name=\"scale-outline\" size={12} color={COLORS.due} />\n"
    "                    <Text style={[mc.metaText, { color: COLORS.due }]}>\n"
    "                      Max {slot.primaryFood.max_serving_g}g\n"
    "                    </Text>\n"
    "                  </>\n"
    "                )}\n"
    "              </View>\n\n"
    "              <View style={mc.tags}>\n"
    "                {slot.nutrients.map(tag => {\n"
    "                  const ts = tagStyle(tag);\n"
    "                  const label = t(NUTRIENT_KEY[tag] ?? tag);\n"
    "                  return (\n"
    "                    <View key={tag} style={[mc.tag, { backgroundColor: ts.bg }]}>\n"
    "                      <Text style={[mc.tagText, { color: ts.color }]}>{label}</Text>\n"
    "                    </View>\n"
    "                  );\n"
    "                })}\n"
    "              </View>\n\n"
    "              <View style={mc.foodsRow}>\n"
    "                {[slot.primaryFood, slot.secondFood, slot.thirdFood]\n"
    "                  .filter(Boolean)\n"
    "                  .map(food => (\n"
    "                    <View key={food!.food_id} style={mc.foodChip}>\n"
    "                      <Text style={mc.foodEmoji}>{pickEmoji(food!.food_name, food!.who_group, food!.food_id)}</Text>\n"
    "                      <Text style={mc.foodName} numberOfLines={1}>\n"
    "                        {food!.local_name ?? food!.food_name}\n"
    "                      </Text>\n"
    "                      {food!.energy_kcal != null && (\n"
    "                        <Text style={mc.foodKcal}>{Math.round(food!.energy_kcal)} kcal</Text>\n"
    "                      )}\n"
    "                    </View>\n"
    "                  ))}\n"
    "              </View>\n\n"
    "              {!!slot.synergyNote && (\n"
    "                <View style={mc.synergyBox}>\n"
    "                  <Ionicons name=\"flash-outline\" size={11} color={COLORS.primary} />\n"
    "                  <Text style={mc.synergyText}>\n"
    "                    <Text style={{ fontFamily: FONTS.semibold }}>{t('synergy_note_label')}: </Text>\n"
    "                    {slot.synergyNote}\n"
    "                  </Text>\n"
    "                </View>\n"
    "              )}\n\n"
    "              <View style={mc.divider} />\n\n"
    "              <TouchableOpacity style={mc.swapBtn} onPress={() => onSwap(slot)} activeOpacity={0.7}>\n"
    "                <Ionicons name=\"shuffle-outline\" size={14} color={COLORS.primary} />\n"
    "                <Text style={mc.swapText}>Try different foods</Text>\n"
    "              </TouchableOpacity>\n\n"
    "            </View>\n"
    "          )}\n\n"
    "        </View>\n"
    "      </View>\n"
    "    </Animated.View>\n"
    "  );\n"
    "});\n"
    "MealCard.displayName = 'MealCard';"
)

if old3 in content:
    content = content.replace(old3, new3)
    changes.append("3. MealCard body is now collapsible")
else:
    changes.append("3. SKIP - MealCard body anchor not found")

# 4. Remove SwapModal + sm styles
start_marker = "// \u2500\u2500\u2500 Swap Modal"
end_marker   = "// \u2500\u2500\u2500 Chat Bubble"
i1 = content.find(start_marker)
i2 = content.find(end_marker)
if i1 != -1 and i2 != -1 and i2 > i1:
    content = content[:i1] + content[i2:]
    changes.append("4. SwapModal + sm styles removed")
else:
    changes.append("4. SKIP - SwapModal block not found")

# 5. Replace stub comment with Responsive Feeding tab
stub = (
    "          {/*\n"
    "           * CF Guide, EBF Guide, Responsive Feeding tabs:\n"
    "           * Conditionally render them here based on activeTab.\n"
    "           *\n"
    "           * Example:\n"
    "           *   {isEbf && activeTab === 'guide' && <EbfScreen feedingStage={feedingStage} />}\n"
    "           *   {!isEbf && activeTab === 'guide' && <CfGuideTab ageMonths={ageMonths} />}\n"
    "           *   {!isEbf && activeTab === 'rf' && <ResponsiveFeedingTab />}\n"
    "           */}"
)
rf_tab = (
    "          {/* Responsive Feeding Tab */}\n"
    "          {!isEbf && activeTab === 'rf' && (\n"
    "            <ScrollView\n"
    "              style={{ flex: 1 }}\n"
    "              contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 80 }]}\n"
    "              showsVerticalScrollIndicator={false}\n"
    "            >\n"
    "              {[\n"
    "                { icon: 'eye-outline' as const, title: 'Watch for hunger cues', body: 'Feed when your child opens their mouth, reaches for food, or gets excited at mealtimes. Stop when they turn away or close their mouth.' },\n"
    "                { icon: 'happy-outline' as const, title: 'Make mealtimes positive', body: 'Sit together, minimise distractions, and talk to your child during meals. Avoid force-feeding \u2014 it reduces appetite over time.' },\n"
    "                { icon: 'time-outline' as const, title: 'Consistent meal schedule', body: `Aim for ${ageMonths < 12 ? '3 meals + 1 snack' : '3 meals + 2 snacks'} per day at regular times.` },\n"
    "                { icon: 'restaurant-outline' as const, title: 'Offer variety, accept refusal', body: 'Offer new foods 8\u201310 times before concluding a child dislikes them. Rejection is normal.' },\n"
    "                { icon: 'people-outline' as const, title: 'Eat together as a family', body: 'Children learn to eat by watching others. Eating the same foods as the family encourages acceptance.' },\n"
    "                { icon: 'hand-left-outline' as const, title: 'Let the child self-feed', body: `From ${ageMonths >= 9 ? 'now' : '9 months'}, encourage finger foods and self-feeding. Messy eating is normal.` },\n"
    "              ].map((tip, i) => (\n"
    "                <View key={i} style={rf.card}>\n"
    "                  <View style={rf.iconWrap}>\n"
    "                    <Ionicons name={tip.icon} size={22} color={COLORS.primary} />\n"
    "                  </View>\n"
    "                  <View style={{ flex: 1 }}>\n"
    "                    <Text style={rf.title}>{tip.title}</Text>\n"
    "                    <Text style={rf.body}>{tip.body}</Text>\n"
    "                  </View>\n"
    "                </View>\n"
    "              ))}\n"
    "              <View style={s.sourceCard}>\n"
    "                <Ionicons name=\"book-outline\" size={12} color={COLORS.textMuted} />\n"
    "                <Text style={s.sourceText}>WHO Responsive Feeding Guidelines 2023 \u00b7 Kenya MoH MIYCN 2023\u20132028</Text>\n"
    "              </View>\n"
    "            </ScrollView>\n"
    "          )}"
)

if stub in content:
    content = content.replace(stub, rf_tab)
    changes.append("5. Responsive Feeding tab added")
else:
    changes.append("5. SKIP - stub comment not found")

FILE.write_text(content, encoding="utf-8")
print("Done.")
for c in changes:
    print("  " + c)
