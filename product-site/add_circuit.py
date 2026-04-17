# Read globals.css
f = open('src/app/globals.css', 'r', encoding='utf-8-sig')
content = f.read()
f.close()

circuit_css = """
/* =================================================================
   TA SOLUTIONS — Circuit Board Brand Pattern
   Mach dien tu lam nen — khang dinh dau an ky thuat cao
   Inspired by PCB trace aesthetics, accentuated with brand red #e8340a
================================================================= */

/* Light section variant */
.circuit-bg {
  position: relative;
  overflow: hidden;
}

.circuit-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    /* Horizontal PCB traces */
    linear-gradient(90deg, transparent 0%, transparent 24.8%, rgba(232,52,10,0.045) 24.8%, rgba(232,52,10,0.045) 25.2%, transparent 25.2%),
    linear-gradient(90deg, transparent 0%, transparent 49.8%, rgba(232,52,10,0.03)  49.8%, rgba(232,52,10,0.03)  50.2%, transparent 50.2%),
    linear-gradient(90deg, transparent 0%, transparent 74.8%, rgba(232,52,10,0.035) 74.8%, rgba(232,52,10,0.035) 75.2%, transparent 75.2%),
    /* Vertical PCB traces */
    linear-gradient(0deg,  transparent 0%, transparent 33.1%, rgba(232,52,10,0.04)  33.1%, rgba(232,52,10,0.04)  33.5%, transparent 33.5%),
    linear-gradient(0deg,  transparent 0%, transparent 66.5%, rgba(232,52,10,0.03)  66.5%, rgba(232,52,10,0.03)  66.9%, transparent 66.9%);
  background-size: 480px 480px;
  pointer-events: none;
  z-index: 0;
}

.circuit-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  /* Solder pads - component nodes */
  background-image:
    radial-gradient(circle, rgba(232,52,10,0.1)  1.5px, transparent 1.5px),
    radial-gradient(circle, rgba(232,52,10,0.06) 1px,   transparent 1px);
  background-size: 120px 120px, 60px 60px;
  background-position: 0 0, 30px 30px;
  pointer-events: none;
  z-index: 0;
}

.circuit-bg > * {
  position: relative;
  z-index: 1;
}

/* Dark section variant */
.circuit-bg-dark {
  position: relative;
  overflow: hidden;
}

.circuit-bg-dark::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(90deg, transparent 0%, transparent 24.8%, rgba(232,52,10,0.07)  24.8%, rgba(232,52,10,0.07)  25.2%, transparent 25.2%),
    linear-gradient(90deg, transparent 0%, transparent 49.8%, rgba(232,52,10,0.05)  49.8%, rgba(232,52,10,0.05)  50.2%, transparent 50.2%),
    linear-gradient(90deg, transparent 0%, transparent 74.8%, rgba(232,52,10,0.055) 74.8%, rgba(232,52,10,0.055) 75.2%, transparent 75.2%),
    linear-gradient(0deg,  transparent 0%, transparent 33.1%, rgba(232,52,10,0.065) 33.1%, rgba(232,52,10,0.065) 33.5%, transparent 33.5%),
    linear-gradient(0deg,  transparent 0%, transparent 66.5%, rgba(232,52,10,0.05)  66.5%, rgba(232,52,10,0.05)  66.9%, transparent 66.9%);
  background-size: 480px 480px;
  pointer-events: none;
  z-index: 0;
}

.circuit-bg-dark::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle, rgba(232,52,10,0.18) 1.5px, transparent 1.5px),
    radial-gradient(circle, rgba(232,52,10,0.1)  1px,   transparent 1px);
  background-size: 120px 120px, 60px 60px;
  background-position: 0 0, 30px 30px;
  pointer-events: none;
  z-index: 0;
}

.circuit-bg-dark > * {
  position: relative;
  z-index: 1;
}

"""

# Add circuit CSS after tailwind directives
tailwind_end = content.find('@tailwind utilities;')
if tailwind_end != -1:
    insert_pos = tailwind_end + len('@tailwind utilities;')
    new_content = content[:insert_pos] + '\n' + circuit_css + content[insert_pos:]
    
    # Write back with UTF-8 (without BOM)
    f = open('src/app/globals.css', 'w', encoding='utf-8')
    f.write(new_content)
    f.close()
    print(f'SUCCESS: Added circuit CSS after @tailwind utilities (pos {insert_pos})')
    print(f'New length: {len(new_content)}')
else:
    print('ERROR: Could not find @tailwind utilities;')
    print('First 200 chars:', repr(content[:200]))