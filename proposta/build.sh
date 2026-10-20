#!/bin/sh
# gera index.html (arquivo único, capa embutida) a partir de fonte.html
cd "$(dirname "$0")" && python3 -c "import base64;s=open('fonte.html').read();open('index.html','w').write(s.replace('{{CAPA}}','data:image/jpeg;base64,'+base64.b64encode(open('capa.jpg','rb').read()).decode()))"
