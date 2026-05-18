# fix-vaccineStore.ps1
# Run from your project root: pwsh ./fix-vaccineStore.ps1

$file = "store/vaccineStore.ts"

if (-not (Test-Path $file)) {
    Write-Error "Could not find '$file'. Run this script from your project root."
    exit 1
}

$src = Get-Content $file -Raw

# ────────────────────────────────────────────────────────────────────────────────
# Fix 1 — VaccineState interface: fetchImmunizations return type void → Immunization[]
# ────────────────────────────────────────────────────────────────────────────────
$old1 = '  fetchImmunizations:  (childId: string) => Promise<void>;'
$new1 = '  fetchImmunizations:  (childId: string) => Promise<Immunization[]>;'

if ($src.Contains($old1)) {
    $src = $src.Replace($old1, $new1)
    Write-Host "Fix 1 applied: fetchImmunizations interface return type -> Promise<Immunization[]>" -ForegroundColor Green
} else {
    Write-Warning "Fix 1 skipped: interface line not found (may already be fixed)."
}

# ────────────────────────────────────────────────────────────────────────────────
# Fix 2 — fetchImmunizations implementation: return Immunization[] instead of void
# ────────────────────────────────────────────────────────────────────────────────
$old2 = "  fetchImmunizations: async (childId: string) => {
    const { data, error } = await supabase.from('immunizations').select('*').eq('child_id', childId);
    if (error) console.error('[vaccineStore] fetchImmunizations:', error.message);
    if (data)  set({ immunizations: data });
  },"

$new2 = "  fetchImmunizations: async (childId: string): Promise<Immunization[]> => {
    const { data, error } = await supabase.from('immunizations').select('*').eq('child_id', childId);
    if (error) console.error('[vaccineStore] fetchImmunizations:', error.message);
    const imms: Immunization[] = data ?? [];
    set({ immunizations: imms });
    return imms;
  },"

if ($src.Contains($old2)) {
    $src = $src.Replace($old2, $new2)
    Write-Host "Fix 2 applied: fetchImmunizations implementation now returns Immunization[]" -ForegroundColor Green
} else {
    Write-Warning "Fix 2 skipped: implementation block not found (whitespace may differ)."
}

# ────────────────────────────────────────────────────────────────────────────────
# Fix 3 — VaccinesScreen calls  const fresh = await fetchImmunizations(id)
#          then passes fresh to computeRows — the store's markAsGiven also needs
#          to capture the return value (currently discards it)
# ────────────────────────────────────────────────────────────────────────────────
$old3 = "    await get().fetchImmunizations(childId);
  },

  updateImmunization:"

$new3 = "    const fresh = await get().fetchImmunizations(childId);
    const dobIso = get().vaccineRows.find(r => r.dueDate != null)?.dueDate?.toISOString()
      ?? new Date().toISOString();
    get().computeRows(dobIso, fresh);
  },

  updateImmunization:"

if ($src.Contains($old3)) {
    $src = $src.Replace($old3, $new3)
    Write-Host "Fix 3 applied: markAsGiven recomputes rows with fresh data" -ForegroundColor Green
} else {
    Write-Warning "Fix 3 skipped: markAsGiven tail block not found."
}

# ────────────────────────────────────────────────────────────────────────────────
# Write back
# ────────────────────────────────────────────────────────────────────────────────
Set-Content -Path $file -Value $src -NoNewline -Encoding UTF8
Write-Host ""
Write-Host "Done. Run  npx tsc --noEmit  to verify no remaining type errors." -ForegroundColor Cyan
