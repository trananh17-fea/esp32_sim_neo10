import re

f = open('src/app/page.tsx', 'r', encoding='utf-8')
content = f.read()
f.close()

original_content = content
changes = 0

def add_class_to_section_line(content, line_identifier, new_class):
    """Add a class to a section's className that contains the identifier"""
    global changes
    # Find the line containing the identifier
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if '<section' in line and line_identifier in line:
            # Add class to className
            if 'className="' in line:
                old_cn_match = re.search(r'className="([^"]+)"', line)
                if old_cn_match:
                    old_cn = old_cn_match.group(1)
                    if new_class not in old_cn:
                        new_cn = old_cn + ' ' + new_class
                        lines[i] = line.replace(f'className="{old_cn}"', f'className="{new_cn}"')
                        changes += 1
                        print(f'Line {i+1}: Added {new_class}')
    return '\n'.join(lines)


# Strategy: Add circuit-bg to sections based on their bg color
# We need to identify sections by their distinctive className parts

lines = content.split('\n')
new_lines = []

for i, line in enumerate(lines):
    if '<section' in line:
        # Determine if this section has a dark or light background
        # Dark bg indicators: 1d1d1f, bg-black, bg-zinc-900, bg-gray-900
        # Light bg: bg-white, bg-gray-50, bg-[#f5f5f7], no bg class
        
        # Get the full section opening tag (may span multiple lines)
        # For single-line sections:
        has_dark_bg = any(x in line for x in ['1d1d1f', 'bg-black', 'bg-zinc-900', 'bg-gray-900', 'bg-neutral-900'])
        has_light_bg = any(x in line for x in ['bg-white', 'bg-gray-50', 'bg-[#f5f5f7]', 'bg-[#fbfbfd]'])
        
        if 'className="' in line:
            old_cn_match = re.search(r'className="([^"]+)"', line)
            if old_cn_match:
                old_cn = old_cn_match.group(1)
                if has_dark_bg and 'circuit-bg' not in old_cn:
                    new_cn = old_cn + ' circuit-bg-dark'
                    line = line.replace(f'className="{old_cn}"', f'className="{new_cn}"')
                    changes += 1
                    print(f'Line {i+1}: Added circuit-bg-dark (dark section)')
                elif not has_dark_bg and 'circuit-bg' not in old_cn:
                    new_cn = old_cn + ' circuit-bg'
                    line = line.replace(f'className="{old_cn}"', f'className="{new_cn}"')
                    changes += 1
                    print(f'Line {i+1}: Added circuit-bg (light section)')
    new_lines.append(line)

content = '\n'.join(new_lines)

print(f'\nTotal changes: {changes}')

if changes > 0:
    f = open('src/app/page.tsx', 'w', encoding='utf-8')
    f.write(content)
    f.close()
    print('File saved successfully')
else:
    print('No changes made - sections may use multi-line className')