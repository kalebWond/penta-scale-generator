"""Other chord models, from ChordMini (https://github.com/ptnghia-j/ChordMini, MIT), to compare
with lv-chordia on the same songs.

ChordMini runs in its own environment (it pins older torch, numpy and librosa than ours), so
its command-line script is called as a separate program:

    CHORDMINI_DIR     the ChordMini clone          (default ~/models/ChordMini)
    CHORDMINI_PYTHON  that environment's python    (default ~/chordmini-env/bin/python)

Each model's output comes back as the same list of segments lv-chordia gives,
[{"start_time", "end_time", "chord"}], so postprocess.build_timeline takes it unchanged.
None of these models names a bass note: D/F# comes out as D.
"""
import os
import subprocess
import tempfile
from pathlib import Path

CHORDMINI_DIR = Path(os.environ.get("CHORDMINI_DIR", Path.home() / "models" / "ChordMini"))
CHORDMINI_PYTHON = Path(os.environ.get("CHORDMINI_PYTHON", Path.home() / "chordmini-env" / "bin" / "python"))

# name: (ChordMini model type, checkpoint, label shown in the app)
MODELS = {
    "btc": ("BTC", "btc_model_large_voca.pt", "BTC"),            # the original (2019)
    "btc-cl": ("BTC", "btc_model_best.pth", "BTC CL"),           # BTC retrained by ChordMini (2026)
    "chordnet": ("ChordNet", "2e1d_model_best.pth", "ChordNet"),  # ChordMini's own model
}

# ChordMini's recommended inference settings (its README), the same for every model so the
# comparison is fair. Short segments are left in: postprocess drops model flicker itself.
FLAGS = ["--smooth_logits", "--use_overlap", "--use_gaussian", "--kernel_size", "9",
         "--vote_aggregation", "logit"]


def available():
    """None if ChordMini can run, else why not."""
    if not (CHORDMINI_DIR / "src" / "evaluation" / "test.py").exists():
        return f"ChordMini not found at {CHORDMINI_DIR} (set CHORDMINI_DIR)"
    if not CHORDMINI_PYTHON.exists():
        return f"ChordMini's python not found at {CHORDMINI_PYTHON} (set CHORDMINI_PYTHON)"
    missing = [ckpt for _, ckpt, _ in MODELS.values() if not (CHORDMINI_DIR / "checkpoints" / ckpt).exists()]
    return f"ChordMini checkpoints missing: {', '.join(missing)}" if missing else None


def parse_lab(text):
    """A .lab file ("start end label" per line) -> [{"start_time", "end_time", "chord"}]."""
    segments = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 3:
            segments.append({"start_time": float(parts[0]), "end_time": float(parts[1]), "chord": parts[2]})
    return segments


def run(model, wav):
    """Chord segments for one audio file from one ChordMini model."""
    model_type, checkpoint, _ = MODELS[model]
    with tempfile.TemporaryDirectory(prefix="chordmini-") as out:
        proc = subprocess.run(
            [str(CHORDMINI_PYTHON), "src/evaluation/test.py", "--model_type", model_type,
             "--checkpoint", f"checkpoints/{checkpoint}", "--config", "config/ChordMini.yaml",
             "--audio_dir", str(wav), "--save_dir", out, *FLAGS],
            cwd=CHORDMINI_DIR, capture_output=True, text=True,
        )
        labs = list(Path(out).glob("*.lab"))
        if proc.returncode != 0 or not labs:
            lines = (proc.stderr or proc.stdout).strip().splitlines()
            raise RuntimeError(f"ChordMini {model} failed: {lines[-1] if lines else 'no output'}")
        return parse_lab(labs[0].read_text())
