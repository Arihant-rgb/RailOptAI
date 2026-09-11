import unittest
from ..heuristic import compute_heuristic_score

class TestHeuristic(unittest.TestCase):
    def test_score_and_explanation(self):
        job = {
            "severity": 5,
            "overdue_days": 10,
            "asset_impact": 80,
            "delay_risk": 70,
        }
        score, explanation = compute_heuristic_score(job)
        self.assertIsInstance(score, float)
        self.assertTrue(0 <= score <= 100)
        self.assertIsInstance(explanation, str)
        self.assertIn("severity", explanation)
        self.assertIn("overdue_days", explanation)

if __name__ == "__main__":
    unittest.main()
