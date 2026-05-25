# patch-growth-editmode.ps1
# Patches src/app/(tabs)/growth.tsx to complete the edit-mode UX
# Run from your project root: .\patch-growth-editmode.ps1

$file = "src\app\(tabs)\growth.tsx"

if (-not (Test-Path $file)) {
    Write-Error "Could not find $file — run this script from your project root (mamaTOTO)"
    exit 1
}

$content = Get-Content $file -Raw -Encoding UTF8

$patchCount = 0

# ── Patch 1: Add isEditMode and onCancel to props interface ──────────────────
$old1 = '  loading: boolean;
  onWeightChange: (v: string) => void;'

$new1 = '  loading: boolean;
  isEditMode?: boolean;
  onCancel?: () => void;
  onWeightChange: (v: string) => void;'

if ($content.Contains($old1)) {
    $content = $content.Replace($old1, $new1)
    Write-Host "[1/6] Added isEditMode and onCancel props" -ForegroundColor Green
    $patchCount++
} else {
    Write-Warning "[1/6] Patch 1 target not found — already applied or file changed"
}

# ── Patch 2: Destructure new props ───────────────────────────────────────────
$old2 = '  loading,
  onWeightChange,'

$new2 = '  loading,
  isEditMode = false,
  onCancel,
  onWeightChange,'

if ($content.Contains($old2)) {
    $content = $content.Replace($old2, $new2)
    Write-Host "[2/6] Destructured isEditMode and onCancel" -ForegroundColor Green
    $patchCount++
} else {
    Write-Warning "[2/6] Patch 2 target not found — already applied or file changed"
}

# ── Patch 3: Update title row to show edit vs add state ──────────────────────
$old3 = "      <Text style={fm.title}>{t('add_measurement')}</Text>
      <Text style={fm.emoji}>📏</Text>"

$new3 = "      <Text style={fm.title}>
        {isEditMode ? 'Edit measurement' : t('add_measurement')}
      </Text>
      <Text style={fm.emoji}>{isEditMode ? '✏️' : '📏'}</Text>"

if ($content.Contains($old3)) {
    $content = $content.Replace($old3, $new3)
    Write-Host "[3/6] Updated title row for edit/add state" -ForegroundColor Green
    $patchCount++
} else {
    Write-Warning "[3/6] Patch 3 target not found — already applied or file changed"
}

# ── Patch 4: Replace submit button with edit-aware button + cancel ────────────
$old4 = "      <TouchableOpacity
        style={[fm.submitBtn, loading && { opacity: 0.7 }]}
        onPress={onSubmit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.onPrimary} size=""small"" />
        ) : (
          <Ionicons name=""save-outline"" size={18} color={COLORS.onPrimary} />
        )}
        <Text style={fm.submitText}>
          {loading ? t('calculating') : t('calculate_save')}
        </Text>
      </TouchableOpacity>"

$new4 = "      <TouchableOpacity
        style={[fm.submitBtn, isEditMode && fm.submitBtnEdit, loading && { opacity: 0.7 }]}
        onPress={onSubmit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.onPrimary} size=""small"" />
        ) : (
          <Ionicons
            name={isEditMode ? 'checkmark-circle-outline' : 'save-outline'}
            size={18}
            color={COLORS.onPrimary}
          />
        )}
        <Text style={fm.submitText}>
          {loading ? t('calculating') : isEditMode ? 'Save changes' : t('calculate_save')}
        </Text>
      </TouchableOpacity>

      {isEditMode && onCancel && (
        <TouchableOpacity style={fm.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Ionicons name=""close-circle-outline"" size={16} color={COLORS.textSecondary} />
          <Text style={fm.cancelText}>Cancel edit</Text>
        </TouchableOpacity>
      )}"

if ($content.Contains($old4)) {
    $content = $content.Replace($old4, $new4)
    Write-Host "[4/6] Replaced submit button with edit-aware button + cancel" -ForegroundColor Green
    $patchCount++
} else {
    Write-Warning "[4/6] Patch 4 target not found — already applied or file changed"
}

# ── Patch 5: Add submitBtnEdit and cancelBtn styles to fm StyleSheet ──────────
$old5 = "  submitText: { color: COLORS.onPrimary, fontWeight: '800', fontSize: 15 },"

$new5 = "  submitText: { color: COLORS.onPrimary, fontWeight: '800', fontSize: 15 },
  submitBtnEdit: {
    backgroundColor: '#0F6E56',
  },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: RADIUS.lg, padding: 13, marginTop: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cancelText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 },"

if ($content.Contains($old5)) {
    $content = $content.Replace($old5, $new5)
    Write-Host "[5/6] Added submitBtnEdit, cancelBtn, cancelText styles" -ForegroundColor Green
    $patchCount++
} else {
    Write-Warning "[5/6] Patch 5 target not found — already applied or file changed"
}

# ── Patch 6: Pass isEditMode and onCancel where AddMeasurementForm is rendered ─
$old6 = "            onSubmit={handleAdd}
          />"

$new6 = "            onSubmit={handleAdd}
            isEditMode={!!editRecord}
            onCancel={() => {
              setEditRecord(null);
              setWeight('');
              setHeight('');
              setMeasureDate(new Date());
              setShowForm(false);
              setShowPicker(false);
            }}
          />"

if ($content.Contains($old6)) {
    $content = $content.Replace($old6, $new6)
    Write-Host "[6/6] Passed isEditMode and onCancel to AddMeasurementForm" -ForegroundColor Green
    $patchCount++
} else {
    Write-Warning "[6/6] Patch 6 target not found — already applied or file changed"
}

# ── Write back ────────────────────────────────────────────────────────────────
if ($patchCount -gt 0) {
    $content | Set-Content $file -Encoding UTF8 -NoNewline
    Write-Host ""
    Write-Host "$patchCount/6 patches applied to $file" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "No patches applied — file may already be up to date." -ForegroundColor Yellow
}
