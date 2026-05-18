# fix_reports_types.ps1
# Fixes TypeScript type errors in src/app/reports.tsx for the mamaTOTO project
#
# Errors fixed:
#   1. child.name -> child.full_name
#      (Child type uses full_name, not name)
#
#   2. latest.nutritional_status -> removed (field doesn't exist on GrowthRecord)
#
# Usage:
#   cd C:\Users\sozi\Desktop\2026-projects\mamaTOTO
#   .\fix_reports_types.ps1

$ErrorActionPreference = "Stop"

$filePath = "src\app\reports.tsx"

if (-not (Test-Path $filePath)) {
    Write-Error "File not found: $filePath. Run this script from the project root."
    exit 1
}

# Back up original
$backupPath = "$filePath.bak"
Copy-Item $filePath $backupPath -Force
Write-Host "Backup created: $backupPath"

$content = Get-Content $filePath -Raw

# -----------------------------------------------------------------
# Fix 1: child.name -> child.full_name
# The Child interface has full_name, not name.
# Appears in: <Text style={styles.headerSub}>{child.name}</Text>
# -----------------------------------------------------------------
$before1 = '{child.name}'
$after1  = '{child.full_name}'

if ($content -notlike "*$before1*") {
    Write-Warning "Fix 1: Pattern '$before1' not found — may already be fixed."
} else {
    $content = $content.Replace($before1, $after1)
    Write-Host "Fix 1 applied: child.name -> child.full_name"
}

# -----------------------------------------------------------------
# Fix 2: Remove the nutritional_status block
# GrowthRecord in childStore.ts has no nutritional_status field.
# Remove the conditional block that references it so the screen
# compiles. The block looks like:
#
#   {latest.nutritional_status && (
#     <View style={styles.statusBanner}>
#       <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
#       <Text style={styles.statusBannerText}>
#         Overall: <Text style={{ fontWeight: '700' }}>{latest.nutritional_status}</Text>
#       </Text>
#     </View>
#   )}
#
# We replace the whole block with a comment placeholder.
# -----------------------------------------------------------------
$before2 = @'
              {latest.nutritional_status && (
                <View style={styles.statusBanner}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.statusBannerText}>
                    Overall: <Text style={{ fontWeight: '700' }}>{latest.nutritional_status}</Text>
                  </Text>
                </View>
              )}
'@

$after2 = @'
              {/* nutritional_status removed — field not present on GrowthRecord */}
'@

if ($content -notlike "*nutritional_status*") {
    Write-Warning "Fix 2: 'nutritional_status' not found — may already be fixed."
} else {
    # Try exact block replacement first
    if ($content.Contains($before2.Trim())) {
        $content = $content.Replace($before2, $after2)
        Write-Host "Fix 2 applied: removed nutritional_status block (exact match)"
    } else {
        # Fallback: regex replacement for whitespace-tolerant match
        $pattern2 = '\{latest\.nutritional_status\s*&&\s*\(\s*<View[^>]*statusBanner[^/]*/View>\s*\)\}'
        $content = [regex]::Replace($content, $pattern2, '{/* nutritional_status removed */}', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        Write-Host "Fix 2 applied: removed nutritional_status block (regex match)"
    }
}

# -----------------------------------------------------------------
# Write the fixed file
# -----------------------------------------------------------------
Set-Content $filePath $content -NoNewline
Write-Host ""
Write-Host "Done. Fixed file: $filePath"
Write-Host "To verify, run:  npx tsc --noEmit"
