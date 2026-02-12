from pathlib import Path

p = Path("app/(app)/layout.js")
s = p.read_text(encoding="utf-8")

if "import RiskBanner" not in s:
    s = s.replace(
        'import Link from "next/link";',
        'import Link from "next/link";\nimport RiskBanner from "@/components/RiskBanner";'
    )

if 'href="/risk"' not in s:
    s = s.replace(
        '<Link style={S.navItem} href="/settings">Settings</Link>',
        '<Link style={S.navItem} href="/risk">Risk</Link>\n                <Link style={S.navItem} href="/settings">Settings</Link>'
    )

if "<RiskBanner />" not in s:
    s = s.replace("{children}", "<RiskBanner />\n              {children}")

p.write_text(s, encoding="utf-8")
print("patched:", p)
