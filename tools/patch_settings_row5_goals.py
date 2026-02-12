from pathlib import Path

p = Path('app/(app)/settings/page.tsx')
s = p.read_text(encoding='utf-8')

needle = 'title="Row 4 — Overtrade Monitor"'
if needle not in s:
    print("skip: cannot find Row4 toggle block")
    exit(0)

if "Row 5 — Goals" in s:
    print("already patched:", p)
    exit(0)

# Row4 토글 바로 뒤에 Row5 토글을 삽입
insert = """
          <RowToggle
            checked={(appearance as any).showRow5Goals}
            onChange={(v) => patchAppearance({ showRow5Goals: v } as any)}
            title="Row 5 — Goals"
            desc="진행중 목표 달성률"
          />
"""

# Row4 블록의 닫힘을 안전하게 찾기: Row4 desc 줄 이후 다음 RowToggle 앞에 끼우지 않고,
# Row4 토글 컴포넌트 끝난 뒤(바로 다음 RowToggle/닫힘) 위치에 삽입하기 위해 간단 치환 사용
s = s.replace(
    'title="Row 4 — Overtrade Monitor"\n            desc="최근 1시간 과다거래 감시"\n          />',
    'title="Row 4 — Overtrade Monitor"\n            desc="최근 1시간 과다거래 감시"\n          />' + insert
)

p.write_text(s, encoding='utf-8')
print("patched:", p)
