/**
 * src/lib/ageUtils.ts — shared age display helpers
 */

/** Compact label: "2 wk", "4 mo 2 wk", "1 yr 3 mo" */
export function getAgeLabel(dob: string): string {
  const totalDays = Math.floor((Date.now() - new Date(dob).getTime()) / 86_400_000);
  const months    = Math.floor(totalDays / 30.4375);
  const weeks     = Math.floor((totalDays % 30.4375) / 7);
  if (months < 1)  { const w = Math.floor(totalDays / 7); return `${w} wk`; }
  if (months < 12) { return weeks > 0 ? `${months} mo ${weeks} wk` : `${months} mo`; }
  const years = Math.floor(months / 12);
  const rem   = months % 12;
  return rem > 0 ? `${years} yr ${rem} mo` : `${years} yr`;
}

/** Verbose: "4 mo 2 wk old", "1 yr 3 mo old" */
export function getAgeLong(dob: string): string {
  return getAgeLabel(dob) + ' old';
}

/** Raw months count */
export function getAgeMonthsFromDob(dob: string): number {
  const b = new Date(dob); const n = new Date();
  return (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
}
