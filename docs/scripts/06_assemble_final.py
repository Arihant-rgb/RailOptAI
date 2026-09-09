import csv, json

RAW = "/home/claude/work/build/data/raw"
PROCESSED = "/home/claude/work/build/data/processed"
OUT = "/home/claude/work/build/RailOptAI_full_dataset.json"

def load_csv(path):
    with open(path) as f:
        return list(csv.DictReader(f))

def main():
    stations_raw = load_csv(f"{RAW}/stations.csv")
    sections_raw = load_csv(f"{RAW}/sections.csv")
    trains_unified = load_csv(f"{PROCESSED}/trains_unified.csv")
    movements = load_csv(f"{PROCESSED}/train_movements.csv")
    blocks = load_csv(f"{PROCESSED}/blocks.csv")
    with open(f"{PROCESSED}/maintenance_jobs_unified.json") as f:
        jobs = json.load(f)
    with open(f"{PROCESSED}/planned_jobs.json") as f:
        planned = json.load(f)
    with open(f"{PROCESSED}/kpis.json") as f:
        kpis = json.load(f)

    stations = [{
        "station_id": s["Station_Code"],
        "station_code": s["Station_Code"],
        "station_name": s["Station_Name"],
        "latitude": float(s["Latitude"]),
        "longitude": float(s["Longitude"]),
        "zone": s["Zone"],
    } for s in stations_raw]

    sections = [{
        "section_id": s["section_id"],
        "from_station": s["from_station"],
        "to_station": s["to_station"],
        "distance_km": float(s["distance_km"]),
        "electrified": s["electrified"] == "true",
        "observed_train_traversals": int(s["observed_train_traversals"]),
    } for s in sections_raw]

    trains = [{
        "train_id": t["train_id"],
        "train_name": t["train_name"],
        "train_type": t["train_type"],
        "zone": t["zone"],
        "from_station": t["from_station"],
        "to_station": t["to_station"],
    } for t in trains_unified]

    train_movements = [{
        "movement_id": m["movement_id"],
        "train_id": m["train_id"],
        "section_id": m["section_id"],
        "date": m["date"],
        "arrival_time": m["arrival_time"],
        "departure_time": m["departure_time"],
        "direction": m["direction"],
    } for m in movements]

    blocks_out = [{
        "block_id": b["block_id"],
        "section_id": b["section_id"],
        "date": b["date"],
        "start_time": b["start_time"],
        "end_time": b["end_time"],
        "duration_minutes": int(b["duration_minutes"]),
        "status": b["status"],
    } for b in blocks]

    final = {
        "_provenance": {
            "stations": "Public dataset (as provided in raw/stations.csv) - SWR Bengaluru division",
            "trains": "Public dataset (as provided in raw/trains.csv), filtered to trains observed on the local station network",
            "timetable": "Public dataset (as provided in raw/timetable.csv)",
            "sections": "Derived/calculated: adjacency pairs and distances computed directly from real station coordinates and observed consecutive stops in the public timetable (edges seen only once treated as anomalies and dropped)",
            "trainMovements": "Derived/calculated from the public timetable, pinned to reference date 2026-09-05",
            "blocks": "Calculated: candidate maintenance windows found from gaps between train movements per section, with a 10-min safety buffer and 45-min minimum block length",
            "maintenanceJobs": "Synthetic (TMS/SMMS/TDMS), generated against real section_ids/station codes; NOT live railway operational data",
            "freightDemand": "Synthetic scenario data, NOT live COA data",
            "plannedJobs": "Calculated via a simple greedy best-fit planner (stand-in for the full OR-Tools CP-SAT optimizer described in the blueprint)",
            "kpis": "Calculated from the above generated data, not hand-entered",
        },
        "maintenanceJobs": jobs,
        "sections": sections,
        "stations": stations,
        "trains": trains,
        "trainMovements": train_movements,
        "blocks": blocks_out,
        "plannedJobs": planned,
        "kpis": kpis,
    }

    with open(OUT, "w") as f:
        json.dump(final, f, indent=2)

    print(f"Wrote {OUT}")
    print(f"stations={len(stations)} sections={len(sections)} trains={len(trains)} "
          f"movements={len(train_movements)} blocks={len(blocks_out)} jobs={len(jobs)} planned={len(planned)}")

if __name__ == "__main__":
    main()
