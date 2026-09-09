"""
Derive sections.csv from the REAL public data (stations.csv + timetable.csv).
A "section" = a pair of adjacent stations that a train is observed to travel
between directly and consecutively in the public timetable.

This keeps sections.csv grounded in the actual gov/public dataset instead of
guessing a topology, and matches PS27's rule that sections are the
fundamental scheduling unit (Section + Time Window).
"""
import csv
import math
from collections import defaultdict

RAW = "/home/claude/work/build/data/raw"

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))

def load_stations():
    stations = {}
    with open(f"{RAW}/stations.csv") as f:
        for row in csv.DictReader(f):
            stations[row["Station_Code"]] = row
    return stations

def load_timetable():
    with open(f"{RAW}/timetable.csv") as f:
        return list(csv.DictReader(f))

def main():
    stations = load_stations()
    tt = load_timetable()

    per_train = defaultdict(list)
    for row in tt:
        per_train[row["Train_No"]].append(row)

    edge_counts = defaultdict(int)
    for train_no, rows in per_train.items():
        codes = [r["Station_Code"] for r in rows]
        for a, b in zip(codes, codes[1:]):
            if a == b:
                continue
            if a not in stations or b not in stations:
                continue
            key = tuple(sorted([a, b]))
            edge_counts[key] += 1

    # Keep edges observed more than once (drop 1-off anomalies / skip-stop noise)
    edges = [(k, v) for k, v in edge_counts.items() if v > 1]
    edges.sort(key=lambda x: -x[1])

    out_rows = []
    for i, ((a, b), count) in enumerate(edges, start=1):
        sa, sb = stations[a], stations[b]
        dist = haversine_km(
            float(sa["Latitude"]), float(sa["Longitude"]),
            float(sb["Latitude"]), float(sb["Longitude"]),
        )
        out_rows.append({
            "section_id": f"S{i:02d}",
            "from_station": a,
            "to_station": b,
            "distance_km": round(dist, 2),
            "electrified": "true",
            "observed_train_traversals": count,  # provenance: how many trains use this section in raw timetable
        })

    with open(f"{RAW}/sections.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=out_rows[0].keys())
        w.writeheader()
        w.writerows(out_rows)

    print(f"Wrote {len(out_rows)} sections derived from {len(per_train)} trains' real timetable stop sequences.")
    for r in out_rows:
        print(r)

if __name__ == "__main__":
    main()
