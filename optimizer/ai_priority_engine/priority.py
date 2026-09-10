import json
import os
from .heuristic import compute_heuristic_score, priority_level, load_weights
from .ml_model import load_model, predict_score


def compute_priority(json_path: str) -> dict:
    """Read the contract JSON, compute priority score, explanation and level for each job.

    Args:
        json_path: Path to the JSON file containing a "maintenanceJobs" list.

    Returns:
        The enriched JSON data with ``priority_score``, ``explanation`` and ``priority_level``
        added to each job entry.
    """
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    jobs = data.get("maintenanceJobs", [])
    model = load_model()
    enriched_jobs = []
    for job in jobs:
        if model is not None:
            score, explanation = predict_score(job, model)
        else:
            score, explanation = compute_heuristic_score(job)
        level = priority_level(score)
        job["priority_score"] = round(score, 2)
        job["explanation"] = explanation
        job["priority_level"] = level
        enriched_jobs.append(job)
    data["maintenanceJobs"] = enriched_jobs
    return data
