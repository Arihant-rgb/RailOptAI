"""
Candidate block generation (blueprint section 12):
Timetable -> group by section -> sort -> find gaps -> apply safety buffer -> candidate blocks
"""
import csv
from collections import defaultdict

RAW = "/home/claude/work/build/data/raw"
PROCESSED = "/home/claude/work/build/data/processed"
REF_DATE = "2026-09-05"
BUFFER_MIN = 10          # safety buffer subtracted from each end of a gap
MIN_BLOCK_MIN = 45       # minimum usable maintenance block length

def load_csv(path):
    with open(path) as f:
        return list(csv.DictReader(f))

def to_minutes(t):
    h, m = t.split(":")
    return int(h) * 60 + int(m)

def fmt(mins):
    mins = mins % (24 * 60)
    return f"{mins // 60:02d}:{mins % 60:02d}"

def main():
    movements = load_csv(f"{PROCESSED}/train_movements.csv")
    by_section = defaultdict(list)
    for m in movements:
        start = min(to_minutes(m["arrival_time"]), to_minutes(m["departure_time"]))
        end = max(to_minutes(m["arrival_time"]), to_minutes(m["departure_time"]))
        by_section[m["section_id"]].append((start, end))

    sections = load_csv(f"{RAW}/sections.csv")
    all_section_ids = [s["section_id"] for s in sections]

    blocks = []
    bid = 1
    for sec_id in all_section_ids:
        occ = sorted(by_section.get(sec_id, []))
        # merge overlapping occupied windows
        merged = []
        for s, e in occ:
            if merged and s <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], e))
            else:
                merged.append((s, e))

        cursor = 0
        gaps = []
        for s, e in merged:
            if s - cursor > 0:
                gaps.append((cursor, s))
            cursor = max(cursor, e)
        if cursor < 24 * 60:
            gaps.append((cursor, 24 * 60))

        for gs, ge in gaps:
            bs = gs + BUFFER_MIN
            be = ge - BUFFER_MIN
            dur = be - bs
            if dur >= MIN_BLOCK_MIN:
                blocks.append({
                    "block_id": f"B{bid:03d}",
                    "section_id": sec_id,
                    "date": REF_DATE,
                    "start_time": fmt(bs),
                    "end_time": fmt(be),
                    "duration_minutes": dur,
                    "status": "Available",
                })
                bid += 1

    with open(f"{PROCESSED}/blocks.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=blocks[0].keys())
        w.writeheader()
        w.writerows(blocks)

    print(f"Generated {len(blocks)} candidate blocks across {len(all_section_ids)} sections on {REF_DATE}.")

if __name__ == "__main__":
    main()
