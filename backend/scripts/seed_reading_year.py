#!/usr/bin/env python
"""Seed ~1 year of daily readings_draft rows for a patient.

Usage:
    python backend/scripts/seed_reading_year.py <patient_id> [--days 365] [--replace]

Notes:
- Writes into the readings_draft table (not the normalized readings table).
- The --replace flag clears existing rows for the patient within the window before inserting.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import timedelta
from pathlib import Path
from random import Random

import django


BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "health_backend.settings")
django.setup()

from django.utils import timezone  # noqa: E402

from core.models import Patient, ReadingDraft  # noqa: E402


def clamp(value: float, low: float | None = None, high: float | None = None) -> float:
    if low is not None and value < low:
        return low
    if high is not None and value > high:
        return high
    return value


def generate_year(patient_id: int, days: int, replace: bool) -> tuple[int, int]:
    patient = Patient.objects.get(pk=patient_id)
    now = timezone.now()
    rng = Random(42)

    deleted = 0
    if replace:
        cutoff = now - timedelta(days=days + 5)
        deleted, _ = ReadingDraft.objects.filter(patient=patient, recorded_at__gte=cutoff).delete()

    created = 0
    for idx in range(days):
        ts = (now - timedelta(days=idx)).replace(hour=12, minute=0, second=0, microsecond=0)

        heart_rate = clamp(72 + rng.normalvariate(0, 6), 58, 96)
        systolic = clamp(120 + rng.normalvariate(0, 9), 102, 142)
        diastolic = clamp(78 + rng.normalvariate(0, 6), 62, 92)
        glucose = clamp(105 + rng.normalvariate(0, 12), 85, 150)
        steps = clamp(9000 + rng.normalvariate(0, 2600), 2500, 16000)
        calories = clamp(2200 + rng.normalvariate(0, 480), 1500, 3200)
        oxygen = clamp(98 + rng.normalvariate(0, 0.6), 95, 100)

        ReadingDraft.objects.create(
            patient=patient,
            recorded_at=ts,
            heart_device_id=1,
            heart_rate=round(heart_rate, 1),
            bp_device_id=2,
            bp_systolic=round(systolic, 1),
            bp_diastolic=round(diastolic, 1),
            glucose_device_id=3,
            glucose=round(glucose, 1),
            steps_device_id=4,
            steps=round(steps, 0),
            calories_device_id=5,
            total_calories=round(calories, 0),
            oxygen_device_id=6,
            oxygen=round(oxygen, 1),
        )
        created += 1

    return created, deleted


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed readings_draft data for a patient")
    parser.add_argument("patient_id", type=int, help="Patient ID to seed")
    parser.add_argument("--days", type=int, default=365, help="How many days back to generate")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete existing readings_draft rows for this patient within the window before inserting",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    try:
        created, deleted = generate_year(args.patient_id, args.days, args.replace)
        print(f"✅ Created {created} rows for patient {args.patient_id}. Deleted {deleted} existing rows within window.")
    except Patient.DoesNotExist:
        print(f"❌ Patient {args.patient_id} not found")


if __name__ == "__main__":
    main()
