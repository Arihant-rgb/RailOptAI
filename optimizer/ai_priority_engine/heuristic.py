import os
# Optional yaml import; if unavailable, we fall back to defaults.
try:
    import yaml
except ImportError:
    yaml = None

# Default heuristic weights; can be overridden via config.yaml in this package.
DEFAULT_WEIGHTS = {
    "severity": 0.3,
    "overdue_days": 0.15,
    "asset_impact": 0.2,
    "delay_risk": 0.15,
    "criticality": 0.15,
    "maintenance_duration": 0.05,
}

# Normalization constants (approximate maximum values observed in data)
MAX_VALUES = {
    "severity": 5,
    "overdue_days": 30,
    "asset_impact": 100,
    "delay_risk": 100,
    "criticality": 5,
    "maintenance_duration": 365,
}

def load_weights():
    """Load custom weights from config.yaml if present and yaml is available, otherwise use defaults."""
    if yaml is None:
        return DEFAULT_WEIGHTS
    cfg_path = os.path.join(os.path.dirname(__file__), "config.yaml")
    if os.path.exists(cfg_path):
        with open(cfg_path, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
        return cfg.get("weights", DEFAULT_WEIGHTS)
    return DEFAULT_WEIGHTS

def compute_heuristic_score(job: dict):
    """Return a numeric priority score (0‑100) and a human‑readable explanation.

    The score is a weighted sum of normalized factors. The explanation lists each
    factor's contribution as a percentage of the final score.
    """
    weights = load_weights()
    raw_score = 0.0
    for factor, weight in weights.items():
        raw_value = job.get(factor, 0)
        max_val = MAX_VALUES.get(factor, 1)
        normalized = min(float(raw_value) / max_val, 1.0)
        raw_score += normalized * weight * 100
    final_score = min(max(raw_score, 0), 100)
    # Determine priority level
    level = priority_level(final_score)
    parts = [f"{factor}: {job.get(factor, 'N/A')} (weight {weights[factor]*100:.0f}%)" for factor in weights]
    explanation = (
        f"Score derived from factors -> "
        + ", ".join(parts)
        + f". Final priority_score = {final_score:.2f}. Priority level: {level}."
    )
    return final_score, explanation

def priority_level(score: float) -> str:
    """Map a numeric score to a priority level.

    Thresholds can be overridden in config.yaml under `level_thresholds`.
    """
    # Load optional thresholds from config
    try:
        import yaml
        cfg_path = os.path.join(os.path.dirname(__file__), "config.yaml")
        if yaml is not None and os.path.exists(cfg_path):
            with open(cfg_path, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f) or {}
            thresholds = cfg.get("level_thresholds", {
                "critical": 80,
                "high": 60,
                "medium": 40,
            })
        else:
            thresholds = {"critical": 80, "high": 60, "medium": 40}
    except Exception:
        thresholds = {"critical": 80, "high": 60, "medium": 40}

    if score >= thresholds.get("critical", 80):
        return "Critical"
    elif score >= thresholds.get("high", 60):
        return "High"
    elif score >= thresholds.get("medium", 40):
        return "Medium"
    else:
        return "Low"

