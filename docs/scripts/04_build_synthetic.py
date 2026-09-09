"""
Generate synthetic TMS / SMMS / TDMS maintenance jobs, freight/COA demand,
and compatibility rules -- all referencing the REAL section_ids and station
codes derived from the public dataset (never invented station/section IDs).
Seeded RNG for reproducibility.
"""
import csv
import random
import json

RAW = "/home/claude/work/build/data/raw"
SYN = "/home/claude/work/build/data/synthetic"
random.seed(27)

REF_DATE = "2026-09-05"

def load_csv(path):
    with open(path) as f:
        return list(csv.DictReader(f))

def rand_date_before(ref="2026-09-05", max_days=10):
    from datetime import date, timedelta
    y, m, d = map(int, ref.split("-"))
    base = date(y, m, d)
    delta = random.randint(1, max_days)
    return str(base - timedelta(days=delta))

# ---------- TMS (Track) ----------
TRACK_DEFECTS = [
    ("Rail Crack", "Corrective"), ("Sleeper Damage", "Preventive"),
    ("Ballast Deficiency", "Preventive"), ("Rail Wear", "Corrective"),
    ("Weld Failure", "Corrective"), ("Fish Plate Loose", "Preventive"),
    ("Track Geometry Defect", "Corrective"), ("Gauge Widening", "Corrective"),
]

def gen_tms(sections, n=12):
    jobs = []
    for i in range(1, n + 1):
        sec = random.choice(sections)
        defect, mtype = random.choice(TRACK_DEFECTS)
        severity = random.choices([2, 3, 4, 5], weights=[15, 30, 30, 25])[0]
        overdue = random.choices([0, 2, 5, 9, 16], weights=[15, 25, 25, 20, 15])[0]
        insp_date = rand_date_before()
        jobs.append({
            "job_id": f"TMS{i:03d}",
            "department": "TMS",
            "section_id": sec["section_id"],
            "asset_id": f"TRK-{sec['section_id']}-{i:02d}",
            "asset_type": "Track",
            "defect_type": defect,
            "inspection_date": insp_date,
            "defect_date": insp_date,
            "severity": severity,
            "maintenance_type": mtype,
            "overdue_days": overdue,
            "estimated_duration": random.choice([1, 2, 2, 3, 4]),
            "status": "Pending",
        })
    return jobs

# ---------- SMMS (Signal) ----------
SIGNAL_DEFECTS = [
    ("Signal Failure", "Signal"), ("Motor Issue", "Point Machine"),
    ("Cable Fault", "Signal"), ("Interlocking Fault", "Interlocking"),
    ("Point Failure", "Point Machine"), ("Track Circuit Failure", "Track Circuit"),
]

def gen_smms(stations, n=10):
    jobs = []
    for i in range(1, n + 1):
        st = random.choice(stations)
        defect, atype = random.choice(SIGNAL_DEFECTS)
        severity = random.choices([2, 3, 4, 5], weights=[10, 25, 30, 35])[0]
        overdue = random.choices([0, 1, 3, 6, 12], weights=[20, 25, 25, 15, 15])[0]
        fail_date = rand_date_before()
        jobs.append({
            "job_id": f"SM{i:03d}",
            "department": "SMMS",
            "section_id": st["nearest_section_id"],
            "asset_id": f"{atype[:3].upper()}-{st['Station_Code']}-{i:02d}",
            "asset_type": atype,
            "defect_type": defect,
            "failure_date": fail_date,
            "severity": severity,
            "maintenance_type": "Corrective",
            "overdue_days": overdue,
            "estimated_duration": random.choice([1, 1, 2, 2, 3]),
            "status": "Pending",
        })
    return jobs

# ---------- TDMS (OHE / Traction) ----------
OHE_DEFECTS = ["Wire Defect", "Insulator Issue", "Dropper Damage", "Tension Fault", "Jumper Wire Break"]

def gen_tdms(sections, n=8):
    jobs = []
    elec_sections = [s for s in sections if s["electrified"] == "true"]
    for i in range(1, n + 1):
        sec = random.choice(elec_sections)
        defect = random.choice(OHE_DEFECTS)
        severity = random.choices([2, 3, 4, 5], weights=[10, 25, 30, 35])[0]
        overdue = random.choices([0, 2, 4, 7, 13], weights=[15, 25, 25, 20, 15])[0]
        insp_date = rand_date_before()
        jobs.append({
            "job_id": f"TD{i:03d}",
            "department": "TDMS",
            "section_id": sec["section_id"],
            "asset_id": f"OHE-{sec['section_id']}-{i:02d}",
            "asset_type": "OHE",
            "defect_type": defect,
            "inspection_date": insp_date,
            "severity": severity,
            "overdue_days": overdue,
            "estimated_duration": random.choice([1, 2, 2, 3]),
            "power_block_required": "true",
            "status": "Pending",
        })
    return jobs

def gen_freight(sections, dates, n_per_section_date=1):
    rows = []
    for d in dates:
        for sec in sections:
            # busier trunk sections (more observed train traversals) get higher baseline demand
            base = min(0.9, 0.25 + int(sec["observed_train_traversals"]) / 120)
            demand = round(min(0.95, max(0.05, random.gauss(base, 0.12))), 2)
            expected = max(1, round(demand * 20))
            priority = "High" if demand >= 0.6 else ("Medium" if demand >= 0.35 else "Low")
            rows.append({
                "date": d,
                "section_id": sec["section_id"],
                "freight_demand": demand,
                "expected_freight_trains": expected,
                "priority": priority,
            })
    return rows

COMPATIBILITY_RULES = [
    ("Track Repair", "Signal Inspection", "true", "false"),
    ("Track Repair", "OHE Work", "true", "false"),
    ("Track Inspection", "Signal Repair", "true", "false"),
    ("Signal Repair", "OHE Isolation", "false", "true"),
    ("Track Repair", "Point Machine Repair", "false", "true"),
    ("OHE Work", "Signal Inspection", "true", "false"),
    ("Track Repair", "Track Repair", "false", "true"),
    ("Signal Repair", "Signal Repair", "false", "true"),
    ("OHE Isolation", "OHE Isolation", "false", "true"),
]

def main():
    sections = load_csv(f"{RAW}/sections.csv")
    stations = load_csv(f"{RAW}/stations.csv")

    # map each station to its most-traveled adjacent section (for SMMS asset placement)
    sec_by_station = {}
    for sec in sections:
        for st in (sec["from_station"], sec["to_station"]):
            cur = sec_by_station.get(st)
            if cur is None or int(sec["observed_train_traversals"]) > int(cur["observed_train_traversals"]):
                sec_by_station[st] = sec
    for st in stations:
        nearest = sec_by_station.get(st["Station_Code"])
        st["nearest_section_id"] = nearest["section_id"] if nearest else sections[0]["section_id"]

    tms = gen_tms(sections, n=12)
    smms = gen_smms(stations, n=10)
    tdms = gen_tdms(sections, n=8)

    with open(f"{SYN}/tms_jobs.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=tms[0].keys()); w.writeheader(); w.writerows(tms)
    with open(f"{SYN}/smms_jobs.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=smms[0].keys()); w.writeheader(); w.writerows(smms)
    with open(f"{SYN}/tdms_jobs.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=tdms[0].keys()); w.writeheader(); w.writerows(tdms)

    dates = ["2026-09-05", "2026-09-06", "2026-09-07"]
    freight = gen_freight(sections, dates)
    with open(f"{SYN}/freight_demand.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=freight[0].keys()); w.writeheader(); w.writerows(freight)

    with open(f"{SYN}/compatibility_rules.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["activity_type_1", "activity_type_2", "compatible", "shared_resource"])
        w.writerows(COMPATIBILITY_RULES)

    print(f"TMS={len(tms)} SMMS={len(smms)} TDMS={len(tdms)} total={len(tms)+len(smms)+len(tdms)}")
    print(f"Freight rows={len(freight)} across {len(dates)} dates x {len(sections)} sections")

if __name__ == "__main__":
    main()
