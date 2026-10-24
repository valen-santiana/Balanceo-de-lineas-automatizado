import json, pathlib
src = pathlib.Path('src')
h = (src/'index.src.html').read_text()
dxf_sample = pathlib.Path('ejemplos/Plano_Camiseta_TallaM.dxf').read_text()
h = h.replace('<script>/*CORE*/</script>', '<script>\n' + (src/'core.js').read_text() + '\n</script>')
h = h.replace('<script>/*DXF*/</script>', '<script>\n' + (src/'dxf.js').read_text() + '\n</script>')
h = h.replace('<script>/*SAMPLE*/</script>', '<script>\nconst SAMPLE_DXF = ' + json.dumps(dxf_sample) + ';\n</script>')
h = h.replace('<script>/*APP*/</script>', '<script>\n' + (src/'app.js').read_text() + '\n</script>')
out = pathlib.Path('.')
# Une src/ en un solo index.html listo para GitHub Pages. Ejecutar desde la raíz: python tools/build.py
full = '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>html{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>\n' + \
       h.split('<header class="top">')[0] + '</head>\n<body>\n<header class="top">' + h.split('<header class="top">',1)[1] + '\n</body>\n</html>\n'
(out/'index.html').write_text(full)
print(len(h)//1024, 'KB')

