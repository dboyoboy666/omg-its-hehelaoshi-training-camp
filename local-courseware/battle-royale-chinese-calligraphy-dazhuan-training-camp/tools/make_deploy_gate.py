#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""make_deploy_gate.py — 从 V3.2 构建产物生成"门禁部署版"index.html（WorkBuddy 线上专用）
用法: python3 tools/make_deploy_gate.py [源HTML] [输出目录]
默认: 源=根目录最新 V3.2.html；输出=~/My-Projects/dazhuan-camp-sites/index.html
门禁: 初始密钥 zyywz（何何老师定），纯 JS 内存态——零 localStorage/sessionStorage/cookie，
      关页/刷新即失效须重输。真相源改动后：node tools/build.js → 本脚本 → 发布。
注意: 交付目录路径勿改（改了线上链接就变，SOP §十二）。"""
import sys, re, os
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '铸铭问鼎论英雄-大篆训练营-V3.2.html')
dst_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser('~/My-Projects/dazhuan-camp-sites')
dst = os.path.join(dst_dir, 'index.html')
ver = __import__('time').strftime('%Y%m%d-%H%M%S')
buf = open(src, encoding='utf-8').read()
buf = re.sub(r'<meta name="build"[^>]*>\n?', '', buf)
m = re.search(r'<title>[^<]*</title>', buf)
assert m, 'title not found'
buf = buf[:m.end()] + '\n<meta name="build" content="' + ver + '">' + buf[m.end():]
gate_css = "\n/* ===== 部署门禁层（仅线上部署版携带；初始密钥 zyywz，何何老师定） ===== */\n#gkGate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:var(--bg,#14100b)}\n#gkGate.off{display:none}\n#gkBox{width:min(420px,86vw);text-align:center;padding:34px 30px;border:1.5px solid var(--gold,#c9a227);border-radius:14px;background:rgba(20,16,11,.92);box-shadow:0 0 40px rgba(201,162,39,.18)}\n#gkBox .gkT{font-family:'STKaiti','Kaiti SC',KaiTi,serif;font-size:26px;letter-spacing:.14em;color:var(--gold-hi,#e8c96a);margin-bottom:6px}\n#gkBox .gkS{font-size:12.5px;color:var(--muted,#9a8c72);margin-bottom:18px;line-height:1.7}\n#gkIn{width:100%;box-sizing:border-box;padding:11px 14px;font-size:16px;letter-spacing:.3em;text-align:center;color:var(--gold-hi,#e8c96a);background:rgba(0,0,0,.35);border:1.5px solid var(--gold,#c9a227);border-radius:8px;outline:none}\n#gkIn:focus{border-color:var(--gold-hi,#e8c96a)}\n#gkIn.bad{border-color:#c0392b;animation:gkShake .38s}\n@keyframes gkShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-9px)}40%{transform:translateX(9px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}\n#gkGo{margin-top:14px;width:100%;padding:11px 0;font-size:15px;letter-spacing:.3em;font-weight:800;color:#14100b;background:linear-gradient(180deg,#e8c96a,#c9a227);border:none;border-radius:8px;cursor:pointer}\n#gkErr{height:18px;margin-top:10px;font-size:12px;color:#e07b52}\n"
gate_js = "\n/* ===== 部署门禁逻辑：密钥只活内存（GK_OK 变量），零持久化；关页/刷新即重输 ===== */\n(function(){\n  var KEY='zyywz', ok=false;\n  function $(id){return document.getElementById(id)}\n  window.__gkState=function(){return {on:!ok, bad:$('gkIn').classList.contains('bad')};};\n  function tryIn(){\n    var v=($('gkIn').value||'');\n    if(v===KEY){ ok=true; $('gkGate').classList.add('off'); $('gkIn').value=''; $('gkErr').textContent=''; }\n    else{ $('gkIn').classList.add('bad'); $('gkErr').textContent='密钥不对，请重试';\n      setTimeout(function(){ $('gkIn').classList.remove('bad'); },450); }\n  }\n  function arm(){\n    $('gkGo').onclick=tryIn;\n    $('gkIn').addEventListener('keydown',function(e){ if(e.key==='Enter') tryIn(); });\n    $('gkIn').focus();\n  }\n  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',arm); else arm();\n})();\n"
i = buf.find('</style>'); assert i > 0, 'no style'
buf = buf[:i] + gate_css + buf[i:]
gate_html = ('<div id="gkGate"><div id="gkBox"><div class="gkT">铸铭问鼎论英雄 · 大篆训练营</div>'
  '<div class="gkS">课堂教学专用 —— 请输入访问密钥<br>（密钥不记忆：关闭网页后须重新输入）</div>'
  '<input id="gkIn" type="password" autocomplete="off" inputmode="text">'
  '<button id="gkGo">进 入</button><div id="gkErr"></div></div></div>')
j = buf.rfind('</body>'); assert j > 0, 'no body'
buf = buf[:j] + '<script>' + gate_js + '</script>\n' + gate_html + '\n' + buf[j:]
os.makedirs(dst_dir, exist_ok=True)
open(dst, 'w', encoding='utf-8').write(buf)
print('OK', dst, 'build=' + ver)
