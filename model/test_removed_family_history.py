import base64
import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
BANNED = tuple(
    base64.b64decode(value).decode("utf-8")
    for value in (
        "cGFyZW50YWxIaXBGcmFjdHVyZQ==",
        "cGFyZW50YWwgaGlwIGZyYWN0dXJl",
        "cGFyZW50YWwtaGlwLWZyYWN0dXJl",
        "cGFyZW50cyBldmVyIGZyYWN0dXJlIGEgaGlw",
        "cGFyZW50cyBoYWQgYSBoaXAgZnJhY3R1cmU=",
        "cGFyZW50IGJyb2tlIGEgaGlw",
    )
)
SKIP = {pathlib.Path(__file__).relative_to(ROOT).as_posix()}


class RemovedFamilyHistoryTest(unittest.TestCase):
    def test_tracked_repository_has_no_removed_references(self):
        tracked = subprocess.check_output(
            ["git", "ls-files"], cwd=ROOT, text=True
        ).splitlines()
        matches = []
        for relative in tracked:
            if relative in SKIP:
                continue
            path = ROOT / relative
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8", errors="ignore").lower()
            for term in BANNED:
                if term.lower() in text:
                    matches.append(f"{relative}: {term}")
        self.assertEqual(
            [], matches, "Removed references remain:\n" + "\n".join(matches)
        )
