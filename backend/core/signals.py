from __future__ import annotations

import threading
from datetime import timedelta
from random import Random

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import Patient, ReadingDraft


def clamp(value: float, low: float | None = None, high: float | None = None) -> float:
    if low is not None and value < low:
        return low
    if high is not None and value > high:
        return high
    return value


def daily_progress_cumulative(total: float, hour: int) -> float:
    p = (hour + 1) / 24.0
    frac = 0.05 + 0.95 * (p ** 1.6)
    return clamp(total * frac, 0, total)


def generate_for_patient(patient_id: int) -> None:
    try:
        patient = Patient.objects.get(pk=patient_id)
    except Patient.DoesNotExist:
        return

    now = timezone.now()
    start = patient.created_at
    if start is None:
        return

    start = start.replace(minute=0, second=0, microsecond=0)
    hour = (start.hour + 5) // 6 * 6
    if hour >= 24:
        start = (start + timedelta(days=1)).replace(hour=0)
    else:
        start = start.replace(hour=hour)

    rng = Random(patient.id or 1)
    base_daily_steps = clamp(7000 + rng.normalvariate(0, 1800), 2500, 16000)
    base_daily_calories = clamp(2000 + rng.normalvariate(0, 400), 1500, 3500)

    ts = start
    while ts <= now:
        # don't overwrite existing rows; skip when present
        if ReadingDraft.objects.filter(patient=patient, recorded_at=ts).exists():
            ts += timedelta(hours=6)
            continue

        hour_of_day = ts.astimezone(timezone.get_current_timezone()).hour
        daily_steps = clamp(base_daily_steps + rng.normalvariate(0, 800), 2500, 16000)
        daily_calories = clamp(base_daily_calories + rng.normalvariate(0, 300), 1400, 4000)

        cumulative_steps = int(round(daily_progress_cumulative(daily_steps, hour_of_day) + rng.normalvariate(0, 80)))
        cumulative_calories = int(round(daily_progress_cumulative(daily_calories, hour_of_day) + rng.normalvariate(0, 30)))

        # ensure monotonic per day
        day_start = ts.replace(hour=0, minute=0, second=0, microsecond=0)
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

        heart_base = 70 + rng.normalvariate(0, 6)
        heart_variation = -3 if 1 <= hour_of_day <= 5 else (3 if 15 <= hour_of_day <= 20 else 0)
        heart_rate = round(clamp(heart_base + heart_variation + rng.normalvariate(0, 4), 50, 110), 1)

        systolic = round(clamp(118 + rng.normalvariate(0, 9) + (1 if 12 <= hour_of_day <= 18 else 0), 98, 150), 1)
        diastolic = round(clamp(76 + rng.normalvariate(0, 6), 58, 100), 1)
        glucose = round(clamp(95 + rng.normalvariate(0, 14) + (10 if 7 <= hour_of_day <= 9 else 0), 70, 180), 1)
        oxygen = round(clamp(98 + rng.normalvariate(0, 0.8), 94, 100), 1)

        heart_ecg = "normal" if rng.random() > 0.02 else "arrhythmia"
        heart_afib = rng.random() > 0.995
        heart_hrv_ms = round(max(10, 50 + rng.normalvariate(0, 30)), 1)
        heart_rr_interval_ms = round(max(300, 800 + rng.normalvariate(0, 200)), 1)

        bp_mean = round(((systolic + 2 * diastolic) / 3), 1)
        bp_pulse_pressure = round((systolic - diastolic), 1)
        bp_irregular = rng.random() > 0.995
        bp_body_position = "sitting" if rng.random() > 0.5 else "standing"

        glucose_trend = "stable" if rng.random() > 0.5 else ("rising" if rng.random() > 0.5 else "falling")
        glucose_hba1c = round(5.5 + rng.normalvariate(0, 1.0), 1)
        glucose_fasting = hour_of_day < 7

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
            heart_device_id=1,
            heart_rate=heart_rate,
            heart_ecg=heart_ecg,
            heart_afib=heart_afib,
            heart_hrv_ms=heart_hrv_ms,
            heart_rr_interval_ms=heart_rr_interval_ms,
            bp_device_id=2,
            bp_systolic=systolic,
            bp_diastolic=diastolic,
            bp_mean=bp_mean,
            bp_pulse_pressure=bp_pulse_pressure,
            bp_irregular=bp_irregular,
            bp_body_position=bp_body_position,
            glucose_device_id=3,
            glucose=glucose,
            glucose_trend=glucose_trend,
            glucose_hba1c=glucose_hba1c,
            glucose_fasting=glucose_fasting,
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
            oxygen_device_id=6,
            oxygen=oxygen,
            vo2_max=vo2_max,
            respiration_rate=respiration_rate,
            oxygen_variability=oxygen_variability,
            sleep_stage=sleep_stage,
            sleep_duration_minutes=sleep_duration_minutes,
            sleep_score=sleep_score,
            body_temperature=body_temperature,
            skin_temperature=skin_temperature,
        )

        ts += timedelta(hours=6)


@receiver(post_save, sender=Patient)
def on_patient_created(sender, instance: Patient, created: bool, **kwargs):
    if not created:
        return

    # Run seeding in background to avoid blocking the request thread
    t = threading.Thread(target=generate_for_patient, args=(instance.id,), daemon=True)
    t.start()
