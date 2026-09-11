import os
from pathlib import Path

# Attempt to import joblib; if unavailable, ML model will be disabled.
try:
    import joblib
except ImportError:
    joblib = None

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "priority_model.pkl"

def load_model():
    """Load the trained ML model if it exists and joblib is available.

    Returns:
        The deserialized model object or ``None`` if the model file is missing
        or joblib is not installed.
    """
    if joblib is None:
        return None
    if MODEL_PATH.is_file():
        try:
            return joblib.load(str(MODEL_PATH))
        except Exception as e:
            print(f"[ml_model] Failed to load model: {e}. Falling back to heuristic.")
            return None
    return None

def predict_score(job: dict, model):
    """Predict a priority score using the supplied ML model.

    Args:
        job: The maintenance job dictionary.
        model: Loaded ML model (e.g., scikit‑learn regressor).

    Returns:
        A tuple ``(score, explanation)``. If prediction fails or the model is
        unavailable, the function falls back to the heuristic implementation.
    """
    if model is None:
        # Fallback to heuristic
        from .heuristic import compute_heuristic_score
        return compute_heuristic_score(job)

    # Feature order expected by the training script.
    feature_names = ["severity", "overdue_days", "asset_impact", "delay_risk", "criticality", "maintenance_duration"]
    features = [float(job.get(name, 0)) for name in feature_names]
    try:
        raw_pred = model.predict([features])[0]
        score = max(0.0, min(float(raw_pred), 100.0))
        explanation = f"ML model prediction based on features {dict(zip(feature_names, features))}."
        return score, explanation
    except Exception as e:
        explanation = f"ML prediction failed ({e}); using heuristic fallback."
        from .heuristic import compute_heuristic_score
        return compute_heuristic_score(job)
