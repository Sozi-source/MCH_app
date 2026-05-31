import sys

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as fh:
    lines = fh.readlines()

# Print line numbers for the key lines so we can target them exactly
targets = [
    'MIN_MANUAL_REFRESH_MS',
    'lastRefreshRef',
    'loadCachedPlan',
    'eslint-disable-next-line react-hooks',
    'ageMonths, hydrated, enabled]',
]
for i, line in enumerate(lines, 1):
    for t in targets:
        if t in line:
            print(f"{i:4d}: {line}", end='')
