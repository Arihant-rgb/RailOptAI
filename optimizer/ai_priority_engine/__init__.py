import json, os
from .heuristic import compute_heuristic_score, priority_level
from .ml_model import load_model, predict_score

def compute_priority(json_path: str) -> dict:
    """Read the shared contract JSON, compute priority_score and explanation for each maintenance job,
    and return the enriched data structure.

    If a trained ML model file exists at `optimizer/models/priority_model.pkl`,
    it will be used for scoring; otherwise the heuristic is applied.
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
