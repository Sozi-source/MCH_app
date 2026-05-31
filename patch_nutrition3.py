import shutil, sys
from pathlib import Path

FILE = Path("src/app/(tabs)/nutrition.tsx")
if not FILE.exists():
    sys.exit(f"ERROR: {FILE} not found.")

shutil.copy(FILE, FILE.with_suffix(".tsx.bak"))
raw = FILE.read_bytes()

dash = bytes.fromhex('c3a2e282ace2809d')
prefix = b'          {/* Row 1 ' + dash + b' slot type + meal name + snack/meal badge */}'
suffix = b'          <View style={mc.header}>'
new4 = (
    b'          {/* Collapsed header \xe2\x80\x94 tap to expand */}\n'
    b'          <TouchableOpacity style={mc.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.75}>'
)

# Try both \n and \r\n between the two lines
for sep in [b'\n', b'\r\n']:
    old4 = prefix + sep + suffix
    if old4 in raw:
        raw = raw.replace(old4, new4, 1)
        FILE.write_bytes(raw)
        print(f"4. MealCard header made tappable - DONE (separator: {repr(sep)})")
        sys.exit(0)

print("4. SKIP - tried both \\n and \\r\\n, no match")
# show surrounding bytes for diagnosis
idx = raw.find(prefix)
print(f"  prefix found at index: {idx}")
if idx >= 0:
    print(f"  bytes after prefix: {raw[idx+len(prefix):idx+len(prefix)+5].hex()}")
