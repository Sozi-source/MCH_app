import sys

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as fh:
    lines = fh.readlines()

# Print context around the lines we need to remove so we know the block boundaries
for i in range(438, 475):
    print(f"{i+1:4d}: {lines[i]}", end='')
