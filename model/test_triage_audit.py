import math
import unittest

from model.triage_audit import audit_threshold, select_threshold


class TriageAuditTests(unittest.TestCase):
    def setUp(self):
        self.labels = [1, 1, 1, 0, 0, 0]
        self.probabilities = [0.09, 0.06, 0.04, 0.08, 0.03, 0.01]

    def test_selects_highest_validation_threshold_meeting_sensitivity_target(self):
        selected = select_threshold(
            self.labels,
            self.probabilities,
            candidates=[0.01, 0.03, 0.05, 0.07],
            min_sensitivity=2 / 3,
        )

        self.assertEqual(selected, 0.05)

    def test_audits_fixed_threshold_with_confidence_intervals(self):
        audit = audit_threshold(
            self.labels,
            self.probabilities,
            threshold=0.05,
            bootstrap_samples=200,
            random_state=7,
        )

        self.assertAlmostEqual(audit["sensitivity"], 2 / 3)
        self.assertAlmostEqual(audit["npv"], 2 / 3)
        self.assertEqual(audit["false_negatives"], 1)
        self.assertEqual(audit["true_negatives"], 2)
        self.assertGreaterEqual(audit["sensitivity_ci95"][0], 0)
        self.assertLessEqual(audit["sensitivity_ci95"][1], 1)
        self.assertGreaterEqual(audit["npv_ci95"][0], 0)
        self.assertLessEqual(audit["npv_ci95"][1], 1)
        self.assertEqual(len(audit["calibration_bins"]), 10)
        self.assertTrue(math.isfinite(audit["brier_score"]))


if __name__ == "__main__":
    unittest.main()
