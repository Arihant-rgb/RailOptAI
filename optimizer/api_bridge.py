#!/usr/bin/env python3
"""
api_bridge.py
-------------
Bridge script to connect the CP-SAT optimizer and AI priority engine
with the Node.js backend.
Reads a JSON request from stdin, processes it using optimizer.py or
ai_priority_engine, and prints the JSON response to stdout.
"""

import sys
import json
import os

# Add workstation root to sys.path so imports work smoothly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from optimizer.model import MaintenanceBlock, Train, AvailableBlockWindow
from optimizer.optimizer import replan_schedule, minutes_to_hhmm


def parse_hhmm_to_minutes(time_str):
    if not time_str or time_str == "None":
        return 0
    parts = time_str.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def run_replan(payload):
    jobs_data = payload.get("jobs", [])
    trains_data = payload.get("trains", [])
    windows_data = payload.get("available_windows", [])
    horizon = payload.get("horizon", 1440) # 24h default in minutes

    blocks = []
    for j in jobs_data:
        duration = int(float(j.get("estimated_duration", 2)) * 60)
        # Priority mapping: Critical=10, High=7, Medium=4, Low=1
        p_raw = j.get("priority", "Medium")
        p_map = {"Critical": 10, "High": 7, "Medium": 4, "Low": 1}
        priority_val = p_map.get(p_raw, 4)

        blocks.append(
            MaintenanceBlock(
                job_id=str(j.get("job_id")),
                block_id=str(j.get("section_id", "S01")),
                maintenance_duration=duration,
                deadline=int(j.get("deadline", horizon)),
                priority=priority_val,
                department=j.get("department", "TMS")
            )
        )

    trains = []
    for t in trains_data:
        arr = parse_hhmm_to_minutes(t.get("arrival_time", "00:00"))
        dep = parse_hhmm_to_minutes(t.get("departure_time", "00:30"))
        if dep <= arr:
            dep = arr + 15
        trains.append(
            Train(
                train_id=str(t.get("train_id")),
                block_id=str(t.get("section_id", "S01")),
                arrival=arr,
                departure=dep,
                priority=int(t.get("priority", 5)),
                can_be_affected=bool(t.get("can_be_affected", True))
            )
        )

    windows = []
    for w in windows_data:
        w_start = parse_hhmm_to_minutes(w.get("start_time", "02:00"))
        w_end = parse_hhmm_to_minutes(w.get("end_time", "04:00"))
        windows.append(
            AvailableBlockWindow(
                block_id=str(w.get("section_id", "S01")),
                window_start=w_start,
                window_end=w_end
            )
        )

    result = replan_schedule(
        blocks=blocks,
        trains=trains,
        horizon=horizon,
        available_windows=windows if windows else None,
        enable_reverse_planning=True
    )
    return result


def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"status": "ERROR", "message": "No input provided"}))
            return

        payload = json.loads(raw_input)
        action = payload.get("action", "replan")

        if action == "replan":
            res = run_replan(payload)
            print(json.dumps(res))
        else:
            print(json.dumps({"status": "ERROR", "message": f"Unknown action: {action}"}))
    except Exception as e:
        print(json.dumps({"status": "ERROR", "message": str(e)}))


if __name__ == "__main__":
    main()
