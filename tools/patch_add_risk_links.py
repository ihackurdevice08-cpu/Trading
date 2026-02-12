from pathlib import Path

def patch_file(p: Path, fn):
    if not p.exists():
        return
    s = p.read_text(encoding="utf-8")
    ns = fn(s)
    if ns != s:
        p.write_text(ns, encoding="utf-8")
        print("patched:", p)

# (A) components/layout/AppLayout.jsx : nav items에 Risk 추가
def patch_applayout(s: str) -> str:
    # 이미 있으면 스킵
    if 'href: "/risk"' in s or "href:'/risk'" in s:
        return s

    # settings 앞에 삽입 시도
    target = '{ href: "/settings", label: "Settings" }'
    if target in s:
        return s.replace(target, '{ href: "/risk", label: "Risk" },\n      ' + target)

    # dashboard/goals/settings 배열 패턴이 다르면 그냥 마지막에 넣기
    if "const NAV" in s or "navItems" in s:
        return s

    return s

# (B) 각 탭 상단 버튼에 Risk 추가 (a href="/risk")
def patch_top_buttons(s: str) -> str:
    if 'href="/risk"' in s:
        return s

    # 보통은 Settings 버튼 앞이나 맨 앞에 넣는 게 자연스러움
    if '<a href="/settings"' in s:
        return s.replace('<a href="/settings"', '<a href="/risk" style={S.btn}>Risk</a>\n          <a href="/settings"')
    if '<a href="/goals"' in s:
        return s.replace('<a href="/goals"', '<a href="/risk" style={S.btn}>Risk</a>\n          <a href="/goals"')
    if '<a href="/dashboard"' in s:
        return s.replace('<a href="/dashboard"', '<a href="/dashboard" style={S.btn}>Dashboard</a>\n          <a href="/risk" style={S.btn}>Risk</a>')
    return s

patch_file(Path("components/layout/AppLayout.jsx"), patch_applayout)
patch_file(Path("app/(app)/dashboard/ui.js"), patch_top_buttons)
patch_file(Path("app/(app)/journal/ui.js"), patch_top_buttons)
patch_file(Path("app/(app)/settings/ui.js"), patch_top_buttons)
patch_file(Path("app/(app)/goals/ui.js"), patch_top_buttons)
