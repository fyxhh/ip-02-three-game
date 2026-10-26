# -*- coding: utf-8 -*-
"""把三部分拼成一个可独立运行的 index.html：
   head.html（页面 + CSS + HUD） + three-bundle.js（three.js 内核） + game.js（游戏逻辑）
以后只改 game.js，重新运行本脚本即可。
"""
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, '_src')

head = open(os.path.join(SRC, 'head.html'), encoding='utf-8').read().rstrip('\n')
bundle = open(os.path.join(SRC, 'three-bundle.js'), encoding='utf-8').read().rstrip('\n')
game = open(os.path.join(SRC, 'game.js'), encoding='utf-8').read().rstrip('\n')

out = head + '\n' + bundle + '\n\n' + game + '\n</script>\n</body>\n</html>\n'
dst = os.path.join(BASE, 'index.html')
open(dst, 'w', encoding='utf-8').write(out)
print('已生成：%s  %.2f MB' % (dst, len(out.encode('utf-8')) / 1024 / 1024))
