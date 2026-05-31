import re, sys

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as fh:
    c = fh.read()

# Normalize to LF for matching, we'll restore at the end
crlf = '\r\n' in c
c = c.replace('\r\n', '\n')

original = c

# 1. Remove throttle constant
c = re.sub(r"\nconst MIN_MANUAL_REFRESH_MS = 5 \* 60 \* 1000;.*\n", "\n", c)

# 2. Remove lastRefreshRef declaration
c = re.sub(r"  const lastRefreshRef\s+=\s+useRef\(0\);\n", "", c)

# 3. Remove throttle block inside generate
c = re.sub(
    r"    // -- 2\. Throttle.*?lastRefreshRef\.current = now;\n\n",
    "",
    c,
    flags=re.DOTALL
)

# 4. Remove cache READ block, keep cacheKey for the save below
c = re.sub(
    r"      // -- 5\. Cache check.*?}\n\n",
    "      // -- 5. Build cache key (still saved after generation)\n"
    "      const cacheKey = `${childNameRef.current}-${sexRef.current}-${ageMonths}`;\n\n",
    c,
    flags=re.DOTALL
)

# 5. Fix useEffect dep array
c = re.sub(
    r"    // eslint-disable-next-line react-hooks/exhaustive-deps\n"
    r"  }, \[ageMonths, hydrated, enabled\]\);",
    "  }, [ageMonths, hydrated, enabled, generate]);",
    c
)

# 6. Update header comment
c = re.sub(
    r" \*   1\. AsyncStorage cache.*?\*   6\. Exponential back-off on 429 \(already present, kept\)",
    " *   1. Always generates fresh plan - cache read removed, throttle removed\n"
    " *   2. Cache write kept so other parts of app can still read if needed\n"
    " *   3. isGeneratingRef concurrency lock prevents overlapping calls\n"
    " *   4. refreshTokenRef cancels stale in-flight runs\n"
    " *   5. generate added to useEffect deps so it re-fires on input changes\n"
    " *   6. Exponential back-off on 429 (kept)",
    c,
    flags=re.DOTALL
)

if c == original:
    print("WARNING: no changes made")
else:
    if crlf:
        c = c.replace('\n', '\r\n')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(c)
    print("OK: file patched")
