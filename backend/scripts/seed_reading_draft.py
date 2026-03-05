#!/usr/bin/env python
"""Seed sample rows into readings_draft for quick UI testing.

Usage:
    python backend/scripts/seed_reading_draft.py <patient_id>

Requires the Django environment to be configured (DJANGO_SETTINGS_MODULE is set automatically).
"""
from __future__ import annotations

import os
import sys
from datetime import timedelta

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "health_backend.settings")
django.setup()

from django.utils import timezone  # noqa: E402

from core.models import Patient, ReadingDraft  # noqa: E402


def seed(patient_id: int) -> int:
    patient = Patient.objects.get(pk=patient_id)
    now = timezone.now()

    # Create a spread of metrics so we can validate UI coverage
    samples = [
        {
            "recorded_at": now - timedelta(hours=6),
            "heart_device_id": 1,
            "heart_rate": 76,
            "bp_device_id": 2,
            "bp_systolic": 122,
            "bp_diastolic": 78,
            "glucose_device_id": 3,
            "glucose": 104.2,
            "steps_device_id": 4,
            "steps": 5600,
            "calories_device_id": 5,
            "total_calories": 2150,
            "oxygen_device_id": 6,
            "oxygen": 98.4,
        },
        {
            "recorded_at": now - timedelta(hours=3),
            "heart_device_id": 1,
            "heart_rate": 82,
            "bp_device_id": 2,
            "bp_systolic": 126,
            "bp_diastolic": 80,
            "glucose_device_id": 3,
            "glucose": 110.7,
            "steps_device_id": 4,
            "steps": 9200,
            "calories_device_id": 5,
            "total_calories": 2450,
            "oxygen_device_id": 6,
            "oxygen": 97.9,
        },
        {
            "recorded_at": now - timedelta(minutes=35),
            "heart_device_id": 1,
            "heart_rate": 74,
            "bp_device_id": 2,
            "bp_systolic": 118,
            "bp_diastolic": 76,
            "glucose_device_id": 3,
            "glucose": 95.5,
            "steps_device_id": 4,
            "steps": 11850,
            "calories_device_id": 5,
            "total_calories": 2610,
            "oxygen_device_id": 6,
            "oxygen": 99.1,
        },
    ]

    created = 0
    for payload in samples:
        ReadingDraft.objects.create(patient=patient, **payload)
        created += 1

    return created


def main(argv: list[str]) -> None:
    if len(argv) < 2:
        print("Usage: python backend/scripts/seed_reading_draft.py <patient_id>")
        sys.exit(1)

    try:
        patient_id = int(argv[1])
    except ValueError:
        print("patient_id must be an integer")
        sys.exit(1)

    try:
        created = seed(patient_id)
        print(f"✅ Created {created} readings_draft rows for patient {patient_id}")
    except Patient.DoesNotExist:
        print(f"❌ Patient {patient_id} not found")
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv)
