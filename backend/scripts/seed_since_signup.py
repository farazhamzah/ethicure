#!/usr/bin/env python
"""Generate readings_draft every 6 hours since each patient's signup.

Usage:
    python backend/scripts/seed_since_signup.py [--replace]

- Writes into `readings_draft` (not `readings`).
- By default will skip timestamps that already have rows for the patient; pass
  `--replace` to delete existing rows in the window before inserting.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import timedelta, datetime, time
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


def daily_progress_cumulative(total: float, hour: int) -> float:
    """Return cumulative portion of `total` at given hour-of-day (0-23).

    Uses a skewed curve so activity is low at night, rises through morning,
    peaks in afternoon/evening and finishes near total at 23:59.
    """
    p = (hour + 1) / 24.0
    # power curve (1.6) to shift more mass later in day; add small morning bump
    frac = 0.05 + 0.95 * (p ** 1.6)
    return clamp(total * frac, 0, total)


def generate_for_patient(patient: Patient, replace: bool) -> tuple[int, int]:
    now = timezone.now()
    start = patient.created_at
    if start is None:
        return 0, 0

    # Align start to a 6-hour boundary (0,6,12,18) at or after created_at
    start = start.replace(minute=0, second=0, microsecond=0)
    hour = (start.hour + 5) // 6 * 6
    if hour >= 24:
        # move to next day 0:00
        start = (start + timedelta(days=1)).replace(hour=0)
    else:
        start = start.replace(hour=hour)

    deleted = 0
    if replace:
        deleted, _ = ReadingDraft.objects.filter(patient=patient, recorded_at__gte=start, recorded_at__lte=now).delete()

    rng = Random(patient.id or 1)

    # patient-specific daily profiles
    base_daily_steps = clamp(7000 + rng.normalvariate(0, 1800), 2500, 16000)
    base_daily_calories = clamp(2000 + rng.normalvariate(0, 400), 1500, 3500)

    created = 0
    ts = start
    while ts <= now:
        # Skip if a reading already exists at this timestamp (unless replace was used)
        if not replace and ReadingDraft.objects.filter(patient=patient, recorded_at=ts).exists():
            ts += timedelta(hours=6)
            continue

        hour_of_day = ts.astimezone(timezone.get_current_timezone()).hour

        # Steps and calories are cumulative for the day and reset at midnight
        day_start = ts.replace(hour=0, minute=0, second=0, microsecond=0)
        # sample a small daily variance so each day differs
        daily_steps = clamp(base_daily_steps + rng.normalvariate(0, 800), 2500, 16000)
        daily_calories = clamp(base_daily_calories + rng.normalvariate(0, 300), 1400, 4000)

        cumulative_steps = int(round(daily_progress_cumulative(daily_steps, hour_of_day) + rng.normalvariate(0, 80)))
        cumulative_calories = int(round(daily_progress_cumulative(daily_calories, hour_of_day) + rng.normalvariate(0, 30)))

        # Ensure monotonic non-decreasing within the same day by checking the
        # most recent prior reading for this patient on the same day and
        # clamping the cumulative values to be at least that prior value.
        prior = (
            ReadingDraft.objects.filter(patient=patient, recorded_at__gte=day_start, recorded_at__lt=ts)
            .order_by("-recorded_at")
            .first()
        )
        if prior is not None:
            try:
                prior_steps = int(prior.steps) if prior.steps is not None else None
            except Exception:
                prior_steps = None
            try:
                prior_cal = int(prior.total_calories) if prior.total_calories is not None else None
            except Exception:
                prior_cal = None

            if prior_steps is not None and cumulative_steps < prior_steps:
                cumulative_steps = prior_steps
            if prior_cal is not None and cumulative_calories < prior_cal:
                cumulative_calories = prior_cal

        # Vitals: small time-of-day modulation
        heart_base = 70 + rng.normalvariate(0, 6)
        heart_variation = -3 if 1 <= hour_of_day <= 5 else (3 if 15 <= hour_of_day <= 20 else 0)
        heart_rate = round(clamp(heart_base + heart_variation + rng.normalvariate(0, 4), 50, 110), 1)

        systolic = round(clamp(118 + rng.normalvariate(0, 9) + (1 if 12 <= hour_of_day <= 18 else 0), 98, 150), 1)
        diastolic = round(clamp(76 + rng.normalvariate(0, 6), 58, 100), 1)

        glucose = round(clamp(95 + rng.normalvariate(0, 14) + (10 if 7 <= hour_of_day <= 9 else 0), 70, 180), 1)

        oxygen = round(clamp(98 + rng.normalvariate(0, 0.8), 94, 100), 1)

        # extra fields to populate more columns for realistic coverage
        heart_ecg = "normal" if rng.random() > 0.02 else "arrhythmia"
        heart_afib = rng.random() > 0.995
        heart_hrv_ms = round(max(10, 50 + rng.normalvariate(0, 30)), 1)
        heart_rr_interval_ms = round(max(300, 800 + rng.normalvariate(0, 200)), 1)

        bp_mean = round(((systolic + 2 * diastolic) / 3), 1)
        bp_pulse_pressure = round((systolic - diastolic), 1)
        bp_irregular = rng.random() > 0.995
        bp_body_position = "sitting" if rng.random() > 0.5 else "standing"

        glucose_trend = rng.choice(["stable", "rising", "falling"]) if hasattr(rng, "choice") else ("stable" if rng.random() > 0.5 else "rising")
        glucose_hba1c = round(5.5 + rng.normalvariate(0, 1.0), 1)
        glucose_fasting = hour_of_day < 7

        # calories/activity extras
        basal_calories = int(round(daily_calories * 0.6))
        metabolic_equivalent = round(1 + rng.random() * 2, 2)
        daily_steps_val = int(round(daily_steps))
        step_distance_km = round(cumulative_steps * 0.00076, 2)
        walking_pace = round(4 + (rng.random() - 0.5) * 1.2, 2)
        cadence = int(round(100 + (rng.random() - 0.5) * 30))
        floors_climbed = max(0, int(round(cumulative_steps / 2000 + (rng.random() - 0.5) * 2)))

        vo2_max = round(35 + (rng.random() - 0.5) * 8, 1)
        respiration_rate = round(14 + (rng.random() - 0.5) * 3, 1)
        oxygen_variability = round(0.5 + rng.random() * 1.5, 1)

        sleep_stage = "rem" if rng.random() > 0.95 else ("light" if rng.random() > 0.5 else "deep")
        sleep_duration_minutes = int(round(max(0, (6 + (rng.random() - 0.5) * 2) * 60)))
        sleep_score = int(round(60 + (rng.random() - 0.5) * 20))

        body_temperature = round(36 + (rng.random() - 0.5) * 0.6, 1)
        skin_temperature = round(33 + (rng.random() - 0.5) * 1.2, 1)

        ReadingDraft.objects.create(
            patient=patient,
            recorded_at=ts,
            # heart
            heart_device_id=1,
            heart_rate=heart_rate,
            heart_ecg=heart_ecg,
            heart_afib=heart_afib,
            heart_hrv_ms=heart_hrv_ms,
            heart_rr_interval_ms=heart_rr_interval_ms,
            # blood pressure
            bp_device_id=2,
            bp_systolic=systolic,
            bp_diastolic=diastolic,
            bp_mean=bp_mean,
            bp_pulse_pressure=bp_pulse_pressure,
            bp_irregular=bp_irregular,
            bp_body_position=bp_body_position,
            # glucose
            glucose_device_id=3,
            glucose=glucose,
            glucose_trend=glucose_trend,
            glucose_hba1c=glucose_hba1c,
            glucose_fasting=glucose_fasting,
            # steps/calories
            steps_device_id=4,
            steps=cumulative_steps,
            daily_steps=daily_steps_val,
            step_distance_km=step_distance_km,
            walking_pace=walking_pace,
            cadence=cadence,
            floors_climbed=floors_climbed,
            calories_device_id=5,
            basal_calories=basal_calories,
            total_calories=cumulative_calories,
            metabolic_equivalent=metabolic_equivalent,
            # oxygen / other
            oxygen_device_id=6,
            oxygen=oxygen,
            vo2_max=vo2_max,
            respiration_rate=respiration_rate,
            oxygen_variability=oxygen_variability,
            # sleep / temp
            sleep_stage=sleep_stage,
            sleep_duration_minutes=sleep_duration_minutes,
            sleep_score=sleep_score,
            body_temperature=body_temperature,
            skin_temperature=skin_temperature,
        )
        created += 1
        ts += timedelta(hours=6)

    return created, deleted


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed readings_draft every 6 hours since patient signup")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete existing readings_draft rows within the generated window before inserting",
    )
    parser.add_argument(
        "--patient",
        type=int,
        default=None,
        help="If provided, only generate for the specified patient id",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    patients = Patient.objects.all()
    if args.patient is not None:
        patients = patients.filter(pk=args.patient)

    total_created = 0
    total_deleted = 0
    for p in patients:
        try:
            created, deleted = generate_for_patient(p, args.replace)
            print(f"Patient {p.id}: created={created} deleted={deleted}")
            total_created += created
            total_deleted += deleted
        except Exception as exc:
            print(f"Failed for patient {p.id}: {exc}")

    print(f"Done. Created {total_created} rows. Deleted {total_deleted} rows.")


if __name__ == "__main__":
    main()
