"""Render the repository acceptance checklist as a phone-readable static page."""
from pathlib import Path
from html import escape
lines=Path('ACCEPTANCE.md').read_text().splitlines()
parts=[];in_table=False
for line in lines:
    if line.startswith('|'):
        cells=[x.strip()for x in line.strip('|').split('|')]
        if all(set(c)<={'-',' ',':'}for c in cells):continue
        if not in_table:parts.append('<div class="scroll"><table>');in_table=True
        tag='th' if cells[0]in('Area','Feature','Section')else'td'
        parts.append('<tr>'+''.join('<'+tag+'>'+escape(c)+'</'+tag+'>'for c in cells)+'</tr>')
    else:
        if in_table:parts.append('</table></div>');in_table=False
        if line.startswith('# '):parts.append('<h1>'+escape(line[2:])+'</h1>')
        elif line.startswith('## '):parts.append('<h2>'+escape(line[3:])+'</h2>')
        elif line.strip():parts.append('<p>'+escape(line)+'</p>')
if in_table:parts.append('</table></div>')
Path('verification.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lake House Picks verification</title><style>body{font:16px/1.55 system-ui;margin:auto;padding:20px;max-width:1100px;background:#07172a;color:#e8f6ff}h1{font-size:27px}a{color:#71d4ff}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #35627e;text-align:left;vertical-align:top;padding:10px}th{background:#12364e}td:nth-child(2){font-weight:bold;white-space:nowrap}p{overflow-wrap:anywhere}</style></head><body><a href="./?release=20261019-phase2">Open Lake House Picks</a>'+''.join(parts)+'</body></html>\n')
