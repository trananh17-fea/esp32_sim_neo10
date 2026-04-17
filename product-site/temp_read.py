import re
import sys

f = open('src/app/page.tsx', 'r', encoding='utf-8')
content = f.read()
f.close()

lines = content.split('\n')
for i, line in enumerate(lines):
    if '<section' in line:
        for j in range(i, min(len(lines), i+5)):
            try:
                encoded = lines[j].encode('ascii', errors='replace').decode('ascii')
                print(f'{j+1}: {encoded}')
            except Exception as e:
                print(f'{j+1}: [error: {e}]')
        print('---')