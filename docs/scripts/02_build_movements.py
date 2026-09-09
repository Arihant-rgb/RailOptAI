"""
Derive train_movements (processed data) from the real timetable.csv, mapped
onto the sections derived in step 1. Movements are pinned to a single
reference operating date (2026-09-05) since the source timetable encodes a
recurring weekly pattern, not calendar dates.
"""
import csv
from collections import defaultdict

RAW = "/home/claude/work/build/data/raw"
PROCESSED = "/home/claude/work/build/data/processed"
REF_DATE = "2026-09-05"

TYPE_MAP = {
    "Exp": "Express", "Pass": "Passenger", "SF": "Superfast", "GR": "Garib Rath",
    "Shtb": "Shatabdi", "JShtb": "Jan Shatabdi", "Drnt": "Duronto",
    "Raj": "Rajdhani", "SKr": "Sampark Kranti", "": "Special",
}

def load_csv(path):
    with open(path) as f:
        return list(csv.DictReader(f))

def to_minutes(t):
    if not t or t in ("None", "null"):
        return None
    h, m, s = t.split(":")
    return int(h) * 60 + int(m)

def main():
    stations = load_csv(f"{RAW}/stations.csv")
    trains = {r["Train_No"]: r for r in load_csv(f"{RAW}/trains.csv")}
    sections = load_csv(f"{RAW}/sections.csv")
    tt = load_csv(f"{RAW}/timetable.csv")

    section_lookup = {}
    for s in sections:
        section_lookup[frozenset([s["from_station"], s["to_station"]])] = s["section_id"]

    per_train = defaultdict(list)
    for row in tt:
        per_train[row["Train_No"]].append(row)

    # Write derived trains.csv (unified train list limited to trains that
    # actually appear in the local 9-station timetable, enriched with type name)
    train_ids_used = set()
    movements = []
    mv_id = 1
    for train_no, rows in per_train.items():
        codes = [r["Station_Code"] for r in rows]
        for i in range(len(codes) - 1):
            a, b = codes[i], codes[i + 1]
            if a == b:
                continue
            key = frozenset([a, b])
            if key not in section_lookup:
                continue  # anomalous/rare edge, dropped in section derivation
            dep_a = to_minutes(rows[i]["Departure_Time"]) or to_minutes(rows[i]["Arrival_Time"])
            arr_b = to_minutes(rows[i + 1]["Arrival_Time"]) or to_minutes(rows[i + 1]["Departure_Time"])
            if dep_a is None or arr_b is None:
                continue
            # direction: matches canonical (from_station -> to_station) order of the section or not
            sec_id = section_lookup[key]
            sec = next(s for s in sections if s["section_id"] == sec_id)
            direction = "UP" if a == sec["from_station"] else "DOWN"

            def fmt(mins):
                mins = mins % (24 * 60)
                return f"{mins // 60:02d}:{mins % 60:02d}"

            movements.append({
                "movement_id": f"M{mv_id:04d}",
                "train_id": f"T{train_no}",
                "section_id": sec_id,
                "date": REF_DATE,
                "arrival_time": fmt(dep_a),
                "departure_time": fmt(arr_b),
                "direction": direction,
            })
            mv_id += 1
            train_ids_used.add(train_no)

    with open(f"{PROCESSED}/train_movements.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=movements[0].keys())
        w.writeheader()
        w.writerows(movements)

    # Unified trains list (only ones with a movement on our local network)
    unified_trains = []
    for train_no in sorted(train_ids_used, key=lambda x: (len(x), x)):
        t = trains[train_no]
        unified_trains.append({
            "train_id": f"T{train_no}",
            "train_name": t["Train_Name"],
            "train_type": TYPE_MAP.get(t["Type"], t["Type"] or "Special"),
            "zone": t["Zone"],
            "from_station": t["From_Station"],
            "to_station": t["To_Station"],
        })
    with open(f"{PROCESSED}/trains_unified.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=unified_trains[0].keys())
        w.writeheader()
        w.writerows(unified_trains)

    print(f"Derived {len(movements)} train movements across {len(train_ids_used)} trains on {REF_DATE}.")

if __name__ == "__main__":
    main()
