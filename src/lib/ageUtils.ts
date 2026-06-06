/**
 * src/lib/ageUtils.ts — shared age display helpers
 * All age calculations are calendar-exact (no floating-point month averages).
 */

/** Compact label: "Newborn", "2 wk", "3 mo 3 wk", "1 yr 3 mo" */
export function getAgeLabel(dob: string): string {
  const birth = new Date(dob);
  const now   = new Date();

  const totalDays = Math.floor((now.getTime() - birth.getTime()) / 86_400_000);

  // Under 2 weeks → Newborn
  if (totalDays < 14) return 'Newborn';

  // Under 1 calendar month → show weeks
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth()   - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) months = 0;

  if (months < 1) {
    const weeks = Math.floor(totalDays / 7);
    return `${weeks} wk`;
  }

  // Leftover days after whole calendar months
  const anchor      = new Date(birth);
  anchor.setMonth(anchor.getMonth() + months);
  const leftoverDays  = Math.floor((now.getTime() - anchor.getTime()) / 86_400_000);
  const leftoverWeeks = Math.floor(leftoverDays / 7);

  if (months < 24) {
    return leftoverWeeks > 0 ? `${months} mo ${leftoverWeeks} wk` : `${months} mo`;
  }

  const years     = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years} yr ${remMonths} mo` : `${years} yr`;
}

/** Verbose: "3 mo 3 wk old" */
export function getAgeLong(dob: string): string {
  return getAgeLabel(dob) + ' old';
}

/** Raw whole-months count (calendar-exact) */
export function getAgeMonthsFromDob(dob: string): number {
  const b = new Date(dob);
  const n = new Date();
  let months =
    (n.getFullYear() - b.getFullYear()) * 12 +
    (n.getMonth()   - b.getMonth());
  if (n.getDate() < b.getDate()) months -= 1;
  return Math.max(0, months);
}