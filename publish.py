#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
一键发布脚本（小熊快跑 · 四季滚动天空）

为什么不用 git push？
    本机网络对 git 的 HTTPS 上传极不稳定（代理频繁 502，4MB 的包经常传到一半断线），
    但对 GitHub API 的请求很稳。所以本脚本改用「GitHub Contents API」逐文件直传：
    每个文件单独成一次请求，断了也只重传那一个文件，不会整包作废。

用法（在项目文件夹里，双击或在终端执行）：
    python publish.py

原理三步：
    1. 从 Windows 凭据管理器取出你登录 VS Code 时保存的 GitHub 令牌（不需要密码）
    2. 用 git 的 blob 算法在本地算出每个文件的指纹，和云端比对——内容一样就跳过
    3. 只有真正改动过的文件才上传，每个文件最多重试 6 次
"""
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

# ===================== 可调参数 =====================
REPO = 'fyxhh/rolling-sky-game'       # GitHub 仓库（用户名/仓库名）
BRANCH = 'main'                       # 分支
# 需要同步的文件；_src 里的源码也一起同步，方便重新构建
FILES = ['index.html', 'bear.glb', 'README.md']
SRC_FILES = ['build.py', 'game.js', 'head.html', 'three-bundle.js',
             'optimize_model.js', 'optimize_model.py', 'optimize_model2.js', 'test_parse.js']
COMMIT_MSG = '更新小熊快跑（四季滚动天空）'
RETRY = 6                             # 每个文件的重试次数
TIMEOUT = 120                         # 单次请求超时（秒，大文件要给足时间）
# ===================================================

BASE = os.path.dirname(os.path.abspath(__file__))


def get_token():
    """从 Windows 凭据管理器取令牌（VS Code 登录 GitHub 时存进去的那把钥匙）"""
    p = subprocess.run(
        'printf "protocol=https\\nhost=github.com\\n\\n" | git credential-manager get',
        shell=True, capture_output=True, text=True)
    m = re.search(r'^password=(.+)$', (p.stdout or ''), re.M)
    if not m:
        print('✗ 取不到 GitHub 令牌。请先在 VS Code 里登录一次 GitHub。')
        sys.exit(1)
    return m.group(1).strip()


def get_proxy():
    """沿用系统代理（和 git / curl 用的是同一个）"""
    for k in ('https_proxy', 'HTTPS_PROXY', 'http_proxy', 'HTTP_PROXY'):
        v = os.environ.get(k)
        if v:
            return v
    return None


def blob_sha(data: bytes) -> str:
    """git 的 blob 指纹：sha1('blob <长度>\\0' + 内容)，用来和云端比对"""
    h = hashlib.sha1()
    h.update(b'blob %d\0' % len(data))
    h.update(data)
    return h.hexdigest()


def api(method, url_path, token, body=None):
    url = 'https://api.github.com' + url_path
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({'https': get_proxy(), 'http': get_proxy()}))
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', 'Bearer ' + token)
    req.add_header('Accept', 'application/vnd.github+json')
    req.add_header('User-Agent', 'bear-publisher')
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with opener.open(req, timeout=TIMEOUT) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]
    except Exception as e:
        return 0, str(e)


def upload(rel_path, token):
    local = os.path.join(BASE, rel_path.replace('/', os.sep))
    if not os.path.exists(local):
        print('  - 跳过（本地没有）' + rel_path)
        return True
    data = open(local, 'rb').read()
    want = blob_sha(data)

    # 先看云端现在是什么版本
    status, info = api('GET', '/repos/%s/contents/%s?ref=%s' % (REPO, rel_path, BRANCH), token)
    if status == 200 and isinstance(info, dict) and info.get('sha') == want:
        print('  = 无变化 ' + rel_path)
        return True

    payload = {'message': COMMIT_MSG, 'content': base64.b64encode(data).decode(), 'branch': BRANCH}
    if status == 200 and isinstance(info, dict) and info.get('sha'):
        payload['sha'] = info['sha']          # 更新已存在的文件必须带上原 sha

    for i in range(RETRY):
        code, res = api('PUT', '/repos/%s/contents/%s' % (REPO, rel_path), token, payload)
        if code in (200, 201):
            print('  ✓ 已上传 %s（%.2f MB）' % (rel_path, len(data) / 1048576))
            return True
        print('    重试 %d/%d：%s -> %s' % (i + 1, RETRY, rel_path, code or res))
        time.sleep(5)
    print('  ✗ 失败 ' + rel_path)
    return False


def main():
    token = get_token()
    targets = FILES + ['_src/' + f for f in SRC_FILES]
    print('发布到 %s（分支 %s）' % (REPO, BRANCH))
    print('代理：' + (get_proxy() or '无'))
    ok = 0
    for f in targets:
        if upload(f, token):
            ok += 1
    print('\n完成：%d/%d 个文件' % (ok, len(targets)))
    if ok == len(targets):
        print('网址：https://fyxhh.github.io/rolling-sky-game/')
        print('（GitHub Pages 会在 1~2 分钟内自动更新）')


if __name__ == '__main__':
    main()
