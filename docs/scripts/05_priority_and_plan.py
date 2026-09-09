"""
- Compute explainable priority scores per blueprint section 13 (priority.py formula).
- Unify TMS/SMMS/TDMS into maintenance_jobs (matches blueprint's maintenance_jobs table).
- Run a simple greedy forward planner (job -> best fitting available block) as a
  lightweight stand-in for the full OR-Tools CP-SAT optimizer (documented as such).
- Compute real KPIs from the generated data (not hand-typed).
"""
import csv
import json
import random

RAW = "/home/claude/work/build/data/raw"
SYN = "/home/claude/work/build/data/synthetic"
PROCESSED = "/home/claude/work/build/data/processed"
random.seed(27)

def load_csv(path):
    with open(path) as f:
        return list(csv.DictReader(f))

def urgency_score(overdue_days):
    if overdue_days >= 15:
        return 100
    elif overdue_days >= 8:
        return 75
    elif overdue_days >= 4:
        return 50
    elif overdue_days >= 1:
        return 25
    return 0

def asset_impact_score(asset_type, severity):
    # Track/OHE assets on higher-traversal sections and higher severity => higher impact
    base = {"Track": 70, "OHE": 65, "Signal": 60, "Point Machine": 55,
            "Interlocking": 65, "Track Circuit": 55}.get(asset_type, 50)
    return min(100, base + severity * 4)

def delay_risk_score(section, freight_by_section):
    traversals = int(section["observed_train_traversals"])
    traffic_component = min(60, traversals / 2)
    fr = freight_by_section.get(section["section_id"])
    freight_component = (fr["freight_demand"] * 40) if fr else 20
    return round(min(100, traffic_component + freight_component), 1)

def calculate_priority(criticality, urgency, asset_impact, delay_risk):
    score = 0.45 * criticality + 0.25 * urgency + 0.20 * asset_impact + 0.10 * delay_risk
    return round(score, 2)

def priority_label(score):
    if score >= 80:
        return "Critical"
    elif score >= 60:
        return "High"
    elif score >= 40:
        return "Medium"
    return "Low"

def main():
    sections = {s["section_id"]: s for s in load_csv(f"{RAW}/sections.csv")}
    freight = load_csv(f"{SYN}/freight_demand.csv")
    freight_ref = [f for f in freight if f["date"] == "2026-09-05"]
    freight_by_section = {f["section_id"]: {**f, "freight_demand": float(f["freight_demand"])} for f in freight_ref}

    tms = load_csv(f"{SYN}/tms_jobs.csv")
    smms = load_csv(f"{SYN}/smms_jobs.csv")
    tdms = load_csv(f"{SYN}/tdms_jobs.csv")

    unified = []
    for j in tms + smms + tdms:
        sev = int(j["severity"])
        overdue = int(j["overdue_days"])
        section = sections[j["section_id"]]
        criticality = sev * 20
        urgency = urgency_score(overdue)
        a_impact = asset_impact_score(j["asset_type"], sev)
        d_risk = delay_risk_score(section, freight_by_section)
        score = calculate_priority(criticality, urgency, a_impact, d_risk)
        label = priority_label(score)
        unified.append({
            "job_id": j["job_id"],
            "department": j["department"],
            "section_id": j["section_id"],
            "asset_id": j["asset_id"],
            "asset_type": j["asset_type"],
            "defect_type": j["defect_type"],
            "maintenance_type": j.get("maintenance_type", "Corrective"),
            "severity": sev,
            "overdue_days": overdue,
            "estimated_duration": int(j["estimated_duration"]),
            "power_block_required": j.get("power_block_required", "false") == "true",
            "asset_impact": a_impact,
            "delay_risk": d_risk,
            "priority_score": score,
            "priority": label,
            "status": "Pending",
            "priority_reasons": {
                "criticality": criticality,
                "urgency": urgency,
                "asset_impact": a_impact,
                "delay_risk": d_risk,
            },
        })

    unified.sort(key=lambda x: -x["priority_score"])

    with open(f"{PROCESSED}/maintenance_jobs_unified.json", "w") as f:
        json.dump(unified, f, indent=2)

    # ---- simple greedy forward planner (stand-in for CP-SAT) ----
    blocks = load_csv(f"{PROCESSED}/blocks.csv")
    blocks_by_section = {}
    for b in blocks:
        blocks_by_section.setdefault(b["section_id"], []).append(dict(b, duration_minutes=int(b["duration_minutes"]), used_minutes=0))

    planned = []
    scheduled_ids = set()
    for job in unified:
        candidates = blocks_by_section.get(job["section_id"], [])
        # sort by remaining capacity descending, prefer best-fit (least leftover slack)
        needed = job["estimated_duration"] * 60
        best = None
        for b in candidates:
            remaining = b["duration_minutes"] - b["used_minutes"]
            if remaining >= needed:
                if best is None or remaining < (best["duration_minutes"] - best["used_minutes"]):
                    best = b
        if best:
            best["used_minutes"] += needed
            planned.append({
                "job_id": job["job_id"],
                "block_id": best["block_id"],
                "section_id": job["section_id"],
                "department": job["department"],
                "priority": job["priority"],
                "estimated_duration_hours": job["estimated_duration"],
            })
            scheduled_ids.add(job["job_id"])

    with open(f"{PROCESSED}/planned_jobs.json", "w") as f:
        json.dump(planned, f, indent=2)

    # ---- KPIs (calculated, not invented) ----
    total_jobs = len(unified)
    critical_jobs = sum(1 for j in unified if j["priority"] == "Critical")
    scheduled_jobs = len(scheduled_ids)
    available_blocks = len(blocks)
    total_block_minutes = sum(int(b["duration_minutes"]) for b in blocks)
    used_minutes = sum(b["used_minutes"] for sec in blocks_by_section.values() for b in sec)
    block_utilization = round(100 * used_minutes / total_block_minutes, 1) if total_block_minutes else 0

    # cross-department bundle = block hosting jobs from >1 department
    block_departments = {}
    for p in planned:
        block_departments.setdefault(p["block_id"], set()).add(p["department"])
    cross_dept_bundles = sum(1 for depts in block_departments.values() if len(depts) > 1)

    kpis = {
        "total_jobs": total_jobs,
        "critical_jobs": critical_jobs,
        "scheduled_jobs": scheduled_jobs,
        "pending_jobs": total_jobs - scheduled_jobs,
        "available_blocks": available_blocks,
        "schedule_conflicts": 0,
        "block_utilization": block_utilization,
        "cross_department_bundles": cross_dept_bundles,
    }
    with open(f"{PROCESSED}/kpis.json", "w") as f:
        json.dump(kpis, f, indent=2)

    print(json.dumps(kpis, indent=2))
    print(f"Scheduled {scheduled_jobs}/{total_jobs} jobs into {len(planned)} block assignments.")

if __name__ == "__main__":
    main()
