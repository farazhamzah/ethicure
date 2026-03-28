import json
import os
import threading
from collections import defaultdict
from datetime import timedelta, datetime, date
from random import Random
import re

from django.conf import settings
from django.db import transaction, connection, DatabaseError, ProgrammingError
from django.db.models import Avg, Max, Min, Count, OuterRef, Subquery
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import make_password
from django.contrib.auth.hashers import check_password
from django.db.models import Q

from .permissions import IsAdmin, IsDoctor, IsPatient, IsAdminOrDoctor
from .models import Staff, Patient, Device, Reading, ReadingDraft, Goal, Threshold, Alert, Notification, Report, Log, DoctorPatientRequest
from .serializers import (
    StaffSerializer,
    StaffCreateSerializer,
    PatientSerializer,
    PatientCreateSerializer,
    DeviceSerializer,
    ReadingSerializer,
    GoalSerializer,
    ThresholdSerializer,
    AlertSerializer,
    NotificationSerializer,
    ReportSerializer,
    CustomTokenObtainPairSerializer,
    PatientTokenSerializer,
    DoctorPatientRequestSerializer,
)

# Live reading generators keyed by patient id
_live_generators: dict[int, threading.Event] = {}
_live_generators_lock = threading.Lock()
_target_bootstrap_started = False
TARGET_AUTOGEN_EMAIL = "faraz722@hotmail.com"
AUTOGEN_INTERVAL_SECONDS = 120

MAX_DOCTOR_PATIENTS = 5


def _record_audit_event(request, actor_type: str, actor_id: int | None, payload: dict) -> None:
    """Persist lightweight audit events such as logins and password changes."""
    try:
        meta = {
            "ip": request.META.get("REMOTE_ADDR"),
            "user_agent": request.META.get("HTTP_USER_AGENT"),
        }
        meta.update(payload)
        Log.objects.create(
            actor_type=actor_type,
            actor_id=actor_id or 0,
            action=json.dumps(meta),
        )
    except Exception:
        # Audit failures should not break the primary flow
        pass


def _password_meets_rules(password: str) -> bool:
    if not password or len(password) < 8:
        return False
    return bool(
        re.search(r"[A-Z]", password)
        and re.search(r"[a-z]", password)
        and re.search(r"\d", password)
        and re.search(r"[\*\(\)@#?\$]", password)
    )


def _create_alerts_for_metrics(patient_id: int, metrics: list[dict], reading_id: int | None = None) -> None:
    """Persist alerts for metrics that violate a patient's active thresholds."""
    if not metrics:
        return

    def _default_anomaly(metric_type: str, value: float) -> tuple[str, str] | None:
        """Fallback anomaly detection when no patient thresholds are configured."""
        if metric_type == "heart_rate":
            if value > 140:
                return ("Heart rate is critically high", "critical")
            if value > 120:
                return ("Heart rate is high", "high")
            if value < 50:
                return ("Heart rate is low", "high")
        if metric_type == "glucose":
            if value > 250:
                return ("Glucose is critically high", "critical")
            if value > 180:
                return ("Glucose is high", "high")
            if value < 54:
                return ("Glucose is critically low", "critical")
            if value < 70:
                return ("Glucose is low", "high")
        if metric_type == "oxygen":
            if value < 88:
                return ("Oxygen saturation is critically low", "critical")
            if value < 94:
                return ("Oxygen saturation is low", "high")
        if metric_type == "calories":
            if value < 800:
                return ("Calories burned is unexpectedly low", "medium")
            if value > 5000:
                return ("Calories burned is unusually high", "medium")
        if metric_type == "steps":
            if value < 3000:
                return ("Steps are very low", "high")
            if value < 7500:
                return ("Steps are below daily goal", "medium")
            if value > 30000:
                return ("Steps are unusually high", "medium")
        return None

    # Normalize payloads and gather relevant metric types
    normalized = []
    metric_types: set[str] = set()
    for metric in metrics:
        metric_type = metric.get("metric_type")
        value = metric.get("value")
        if metric_type is None or value is None:
            continue
        try:
            numeric_value = float(value)
        except Exception:
            continue
        normalized.append({
            "metric_type": str(metric_type),
            "value": numeric_value,
            "device": metric.get("device"),
        })
        metric_types.add(str(metric_type))

    if not normalized:
        return

    thresholds_by_metric: dict[str, list[Threshold]] = defaultdict(list)
    for threshold in Threshold.objects.filter(
        patient_id=patient_id,
        is_active=True,
        metric_type__in=metric_types,
    ):
        thresholds_by_metric[threshold.metric_type].append(threshold)

    for metric in normalized:
        mt = metric["metric_type"]
        value = metric["value"]

        matched_threshold = False
        for threshold in thresholds_by_metric.get(mt, []):
            comparator = float(threshold.value)
            triggered = (
                (threshold.condition == "above" and value > comparator) or
                (threshold.condition == "below" and value < comparator) or
                (threshold.condition == "equal" and value == comparator)
            )
            if not triggered:
                continue
            matched_threshold = True

            baseline = comparator if comparator != 0 else 1.0
            diff_percent = abs(value - comparator) / baseline * 100
            if diff_percent > 50:
                severity = "critical"
            elif diff_percent > 25:
                severity = "high"
            elif diff_percent > 10:
                severity = "medium"
            else:
                severity = "low"

            try:
                message = (
                    f"{mt} reading of {value} is {threshold.condition} "
                    f"threshold of {threshold.value}"
                )

                Alert.objects.create(
                    patient_id=patient_id,
                    threshold_id=threshold.id,
                    reading_id=reading_id,
                    metric_type=mt,
                    message=message,
                    severity=severity,
                )
            except Exception:
                # Alerts should not block the request flow; log and continue
                print("Failed to create alert for metric", mt)

        # Fallback anomaly detection when no DB thresholds matched
        if matched_threshold:
            continue

        fallback = _default_anomaly(mt, value)
        if not fallback:
            continue

        fallback_message, fallback_severity = fallback
        try:
            message = f"{fallback_message} (value: {value})"
            Alert.objects.create(
                patient_id=patient_id,
                threshold_id=None,
                reading_id=reading_id,
                metric_type=mt,
                message=message,
                severity=fallback_severity,
            )
        except Exception:
            print("Failed to create fallback alert for metric", mt)


GOAL_TO_READING_FIELD = {
    "heart_rate": "heart_rate",
    "glucose": "glucose",
    "steps": "steps",
    "calories": "total_calories",
    "oxygen": "oxygen",
    "weight": None,
}


def _to_local_date(value) -> date:
    """Convert supported datetime/date values into a local date."""
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        if timezone.is_aware(value):
            return timezone.localtime(value).date()
        return value.date()
    return timezone.localdate()


def _build_daily_metric_max(
    rows,
    metrics_of_interest: set[str],
) -> dict[date, dict[str, float]]:
    """Build day->metric->max-value from readings_draft rows for goal checks."""
    field_by_metric = {
        metric: GOAL_TO_READING_FIELD.get(metric)
        for metric in metrics_of_interest
        if GOAL_TO_READING_FIELD.get(metric)
    }

    daily_metric_max: dict[date, dict[str, float]] = {}
    for row in rows:
        recorded_at = row.recorded_at or row.created_at
        if not recorded_at:
            continue
        day = _to_local_date(recorded_at)

        per_day = daily_metric_max.setdefault(day, {})
        for metric, field_name in field_by_metric.items():
            value = getattr(row, field_name, None)
            if value is None:
                continue
            try:
                numeric_value = float(value)
            except Exception:
                continue
            current = per_day.get(metric)
            if current is None or numeric_value > current:
                per_day[metric] = numeric_value

    return daily_metric_max


def _active_goals_for_day(patient_id: int, day: date):
    """Return the effective goal rows that apply for a specific day."""
    goals = list(
        Goal.objects.filter(
            patient_id=patient_id,
            start_date__lte=day,
        )
        .filter(Q(end_date__isnull=True) | Q(end_date__gt=day))
        .order_by("metric_type", "-start_date", "-created_at", "-id")
    )

    latest_by_metric: dict[str, Goal] = {}
    for goal in goals:
        metric = goal.metric_type
        if metric not in latest_by_metric:
            latest_by_metric[metric] = goal

    return latest_by_metric


def _active_goals_for_day_from_rows(goals: list[Goal], day: date) -> dict[str, Goal]:
    """Resolve the effective goal per metric for a day from an in-memory goal list."""
    latest_by_metric: dict[str, Goal] = {}
    for goal in goals:
        if goal.start_date > day:
            continue
        if goal.end_date is not None and goal.end_date <= day:
            continue
        metric = goal.metric_type
        if metric not in latest_by_metric:
            latest_by_metric[metric] = goal
    return latest_by_metric


def _is_goal_completed(goal: Goal, value: float) -> bool:
    """Determine whether a numeric reading satisfies the goal target."""
    try:
        target = float(goal.target_value)
    except Exception:
        return False
    return value >= target


def _update_goal_progress_for_day(
    patient_id: int,
    day: date,
    metric_values: dict[str, float] | None = None,
) -> bool:
    """Update goal.current_value values and return whether all day-goals were completed."""
    goals_by_metric = _active_goals_for_day(patient_id, day)
    if not goals_by_metric:
        return False

    metric_values = metric_values or {}
    completed_metrics = 0
    goal_count = 0

    for metric, goal in goals_by_metric.items():
        field_name = GOAL_TO_READING_FIELD.get(metric)
        if not field_name:
            continue
        goal_count += 1

        value = metric_values.get(metric)
        if value is None:
            aggregate = (
                ReadingDraft.objects.filter(
                    patient_id=patient_id,
                    recorded_at__date=day,
                )
                .exclude(**{f"{field_name}__isnull": True})
                .aggregate(max_value=Max(field_name))
            )
            raw_value = aggregate.get("max_value")
            if raw_value is not None:
                try:
                    value = float(raw_value)
                except Exception:
                    value = None

        if value is None:
            continue

        Goal.objects.filter(pk=goal.pk).update(current_value=value)
        if _is_goal_completed(goal, value):
            completed_metrics += 1

    if goal_count == 0:
        return False

    return completed_metrics == goal_count


def _clamp(value: float, low: float | None = None, high: float | None = None) -> float:
    if low is not None and value < low:
        return low
    if high is not None and value > high:
        return high
    return value


def _find_nearby_reading(patient_id: int, recorded_at: datetime, window_seconds: int = 55):
    """Return an existing reading very close in time to avoid duplicate inserts."""
    try:
        window_start = recorded_at - timedelta(seconds=window_seconds)
        window_end = recorded_at + timedelta(seconds=window_seconds)
        return (
            ReadingDraft.objects.filter(
                patient_id=patient_id,
                recorded_at__gte=window_start,
                recorded_at__lte=window_end,
            )
            .order_by("-recorded_at")
            .first()
        )
    except Exception:
        return None


def _start_live_generator(patient_id: int, interval_seconds: int = 120) -> bool:
    with _live_generators_lock:
        existing = _live_generators.get(patient_id)
        if existing and not existing.is_set():
            return False

        stop_event = threading.Event()
        _live_generators[patient_id] = stop_event

    def loop():
        rng = Random(patient_id)
        while not stop_event.is_set():
            now = timezone.now()
            prior = (
                ReadingDraft.objects.filter(patient_id=patient_id)
                .order_by("-recorded_at")
                .first()
            )

            steps_prior = float(prior.steps) if prior and prior.steps is not None else 0.0
            calories_prior = float(prior.total_calories) if prior and prior.total_calories is not None else 0.0

            steps_increment = rng.randint(20, 90)
            calories_increment = rng.randint(2, 10)

            heart_rate = round(_clamp(72 + rng.normalvariate(0, 6), 50, 110), 1)
            systolic = round(_clamp(118 + rng.normalvariate(0, 10), 98, 155), 1)
            diastolic = round(_clamp(76 + rng.normalvariate(0, 7), 58, 105), 1)
            glucose = round(_clamp(102 + rng.normalvariate(0, 18), 70, 195), 1)
            oxygen = round(_clamp(98 + rng.normalvariate(0, 0.8), 94, 100), 1)

            steps_val = steps_prior + steps_increment
            calories_val = calories_prior + calories_increment

            # Skip this cycle if another writer already inserted a near-time row
            # (e.g., frontend 2-minute auto-generation hook).
            if _find_nearby_reading(patient_id=patient_id, recorded_at=now, window_seconds=55):
                stop_event.wait(interval_seconds)
                continue

            try:
                ReadingDraft.objects.create(
                    patient_id=patient_id,
                    recorded_at=now,
                    heart_device_id=1,
                    heart_rate=heart_rate,
                    heart_ecg="normal",
                    heart_afib=False,
                    heart_hrv_ms=round(_clamp(55 + rng.normalvariate(0, 25), 10, 150), 1),
                    heart_rr_interval_ms=round(_clamp(850 + rng.normalvariate(0, 120), 300, 1300), 1),
                    bp_device_id=2,
                    bp_systolic=systolic,
                    bp_diastolic=diastolic,
                    bp_mean=round(((systolic + 2 * diastolic) / 3), 1),
                    bp_pulse_pressure=round((systolic - diastolic), 1),
                    bp_irregular=False,
                    bp_body_position="sitting",
                    glucose_device_id=3,
                    glucose=glucose,
                    glucose_trend="stable",
                    glucose_hba1c=round(_clamp(5.6 + rng.normalvariate(0, 0.6), 4.5, 8.5), 1),
                    glucose_fasting=False,
                    steps_device_id=4,
                    steps=steps_val,
                    daily_steps=steps_val,
                    step_distance_km=round(steps_val * 0.00076, 2),
                    walking_pace=round(_clamp(4 + rng.normalvariate(0, 0.8), 2.5, 6), 2),
                    cadence=round(_clamp(103 + rng.normalvariate(0, 12), 80, 140), 0),
                    floors_climbed=max(0, int(round((steps_val / 2000) + rng.normalvariate(0, 1)))),
                    calories_device_id=5,
                    basal_calories=round(_clamp(1200 + rng.normalvariate(0, 150), 900, 1800), 1),
                    total_calories=calories_val,
                    metabolic_equivalent=round(_clamp(1.2 + rng.normalvariate(0, 0.4), 1.0, 3.5), 2),
                    oxygen_device_id=6,
                    oxygen=oxygen,
                    vo2_max=round(_clamp(36 + rng.normalvariate(0, 6), 20, 60), 1),
                    respiration_rate=round(_clamp(14 + rng.normalvariate(0, 2), 10, 24), 1),
                    oxygen_variability=round(_clamp(0.9 + rng.normalvariate(0, 0.4), 0.2, 2.5), 2),
                    sleep_stage="awake",
                    sleep_duration_minutes=0,
                    sleep_score=None,
                    body_temperature=round(_clamp(36.5 + rng.normalvariate(0, 0.3), 35.5, 37.8), 1),
                    skin_temperature=round(_clamp(33.5 + rng.normalvariate(0, 0.6), 31.5, 35.5), 1),
                )

                # Mirror generated metrics into alerts when thresholds are breached
                _create_alerts_for_metrics(patient_id, [
                    {"metric_type": "heart_rate", "value": heart_rate, "device": 1},
                    {"metric_type": "glucose", "value": glucose, "device": 3},
                    {"metric_type": "steps", "value": steps_val, "device": 4},
                    {"metric_type": "calories", "value": calories_val, "device": 5},
                    {"metric_type": "oxygen", "value": oxygen, "device": 6},
                ])

                _update_goal_progress_for_day(
                    patient_id=patient_id,
                    day=_to_local_date(now),
                    metric_values={
                        "heart_rate": float(heart_rate),
                        "glucose": float(glucose),
                        "steps": float(steps_val),
                        "calories": float(calories_val),
                        "oxygen": float(oxygen),
                    },
                )
            except Exception:
                # Intentionally swallow to keep the generator alive; logs handled by Django logger
                pass

            stop_event.wait(interval_seconds)

        with _live_generators_lock:
            _live_generators.pop(patient_id, None)

    t = threading.Thread(target=loop, daemon=True)
    t.start()
    return True


def ensure_target_email_autogen_started() -> bool:
    """Start 2-minute live generation for the configured target patient email once."""
    global _target_bootstrap_started
    with _live_generators_lock:
        if _target_bootstrap_started:
            return False
        _target_bootstrap_started = True

    try:
        patient = Patient.objects.filter(email__iexact=TARGET_AUTOGEN_EMAIL).only("id").first()
        if not patient:
            return False
        _start_live_generator(int(patient.id), interval_seconds=AUTOGEN_INTERVAL_SECONDS)
        return True
    except Exception:
        return False


# ============== Auth Views ==============

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class PatientTokenObtainPairView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        raw_identity = request.data.get("username") or request.data.get("email")
        identity = (raw_identity or "").strip()
        patient = Patient.objects.filter(Q(username__iexact=identity) | Q(email__iexact=identity)).first()

        serializer = PatientTokenSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception as exc:
            detail = getattr(exc, "detail", None)
            _record_audit_event(
                request,
                "patient",
                patient.id if patient else None,
                {
                    "context": "login",
                    "success": False,
                    "detail": str(detail or exc),
                },
            )
            raise

        data = serializer.validated_data
        patient_id = data.get("patient_id") or (patient.id if patient else None)
        _record_audit_event(
            request,
            "patient",
            patient_id,
            {
                "context": "login",
                "success": True,
            },
        )
        return Response(data)


class StaffTokenObtainView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_identity = request.data.get("username") or request.data.get("email")
        password = request.data.get("password")
        identity = (raw_identity or "").strip()

        if not identity or not password:
            return Response({"error": "Username and password are required"}, status=400)

        staff = Staff.objects.filter(Q(username__iexact=identity) | Q(email__iexact=identity)).first()
        # Accept hashed (normal) or legacy/plain-text (trimmed) passwords to avoid legacy data issues
        def password_matches(raw: str, stored: str) -> bool:
            try:
                if check_password(raw, stored):
                    return True
            except Exception:
                pass
            # Legacy/plain-text fallback (with trimmed variants)
            return raw == stored or raw.strip() == stored or raw == stored.strip()

        if not staff:
            return Response({"error": "Invalid credentials", "error_code": "no_user"}, status=401)

        if not password_matches(password or "", staff.password_hash or ""):
            return Response({"error": "Invalid credentials", "error_code": "invalid_password"}, status=401)

        if not staff.is_active:
            return Response({"error": "Account is inactive", "error_code": "inactive"}, status=403)

        refresh = RefreshToken()
        refresh["staff_id"] = staff.id
        refresh["role"] = staff.role
        refresh["username"] = staff.username
        refresh["user_type"] = "staff"

        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "staff_id": staff.id,
            "role": staff.role,
            "username": staff.username,
        })


# ============== General Endpoints ==============

@api_view(["GET"])
def root(request):
    return Response({
        "service": "Ethicare Health API",
        "status": "running",
        "version": "1.0.0"
    })
    

@api_view(["GET"])
def health_check(request):
    return Response({"status": "ok"})


# ============== Staff/Admin Endpoints ==============

@api_view(["GET", "POST"])
# TEMP: open access for now
@authentication_classes([])
@permission_classes([AllowAny])
def staff_list(request):
    """Admin: List all staff or create new staff"""
    if request.method == "GET":
        qs = Staff.objects.all()
        return Response(StaffSerializer(qs, many=True).data)
    
    if request.method == "POST":
        serializer = StaffCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        staff = serializer.save()
        return Response(StaffSerializer(staff).data, status=201)


@api_view(["GET", "PUT", "DELETE"])
# TEMP: open access for now
@authentication_classes([])
@permission_classes([AllowAny])
def staff_detail(request, pk):
    """Admin: Get, update, or deactivate staff member"""
    try:
        staff = Staff.objects.get(pk=pk)
    except Staff.DoesNotExist:
        return Response({"error": "Staff not found"}, status=404)
    
    if request.method == "GET":
        return Response(StaffSerializer(staff).data)
    
    if request.method == "PUT":
        # Only allow toggling active and changing password; ignore other fields
        updated = False
        if "is_active" in request.data:
            staff.is_active = bool(request.data.get("is_active"))
            updated = True

        new_password = request.data.get("password")
        if new_password:
            staff.password_hash = make_password(new_password)
            updated = True

        if updated:
            staff.save()

        return Response(StaffSerializer(staff).data)
    
    if request.method == "DELETE":
        # Soft delete - deactivate instead of delete
        staff.is_active = False
        staff.save()
        return Response({"message": "Staff deactivated"}, status=200)


# ============== Patient Endpoints ==============

@api_view(["POST"])
@permission_classes([AllowAny])
def patient_register(request):
    """Public: Patient self-registration"""
    serializer = PatientCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    patient = serializer.save()
    return Response(PatientSerializer(patient).data, status=201)


@api_view(["GET"])
@permission_classes([AllowAny])
def check_email_exists(request):
    """Public: check if an email is already registered"""
    raw_email = request.query_params.get("email")
    if not raw_email:
        return Response({"error": "Email is required"}, status=400)

    email = raw_email.strip()
    if not email:
        return Response({"error": "Email is required"}, status=400)

    patient_exists = Patient.objects.filter(
        Q(email__iexact=email) | Q(username__iexact=email)
    ).exists()
    staff_exists = Staff.objects.filter(
        Q(email__iexact=email) | Q(username__iexact=email)
    ).exists()
    exists = patient_exists or staff_exists
    return Response({
        "exists": exists,
        "patient_exists": patient_exists,
        "staff_exists": staff_exists,
    })


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def patient_list(request):
    """List patients (admin/doctor) or create (admin only)"""
    role = request.auth.get("role") if request.auth else None
    staff_id = request.auth.get("staff_id") if request.auth else None
    has_doctor_patient_requests = _table_exists(DoctorPatientRequest._meta.db_table)

    if request.method == "GET":
        qs = Patient.objects.all()

        # If a staff_id is present (doctor token), annotate latest request status so pending shows after refresh
        if staff_id and has_doctor_patient_requests:
            try:
                latest_status = DoctorPatientRequest.objects.filter(
                    patient_id=OuterRef("pk"), doctor_id=staff_id
                ).order_by("-created_at").values("status")[:1]
                qs = qs.annotate(request_status=Subquery(latest_status))
            except (ProgrammingError, DatabaseError):
                pass

        return Response(PatientSerializer(qs, many=True, context={"request": request}).data)

    if request.method == "POST":
        if role != "admin":
            return Response({"error": "Only admins can create patients"}, status=403)
        serializer = PatientCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = serializer.save()
        return Response(PatientSerializer(patient).data, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_request_patient(request):
    """Doctor sends a request to connect to a patient. Does not auto-assign; patient must accept."""
    staff_id = request.auth.get("staff_id") if request.auth else None
    if not staff_id:
        return Response({"error": "Not authorized"}, status=403)

    has_doctor_patient_requests = _table_exists(DoctorPatientRequest._meta.db_table)

    patient_id = request.data.get("patient_id") or request.query_params.get("patient_id")
    if not patient_id:
        return Response({"error": "patient_id is required"}, status=400)

    try:
        patient_obj = Patient.objects.get(pk=patient_id)
    except Patient.DoesNotExist:
        return Response({"error": "Patient not found"}, status=404)

    # If already assigned to another doctor, block
    if patient_obj.doctor_id and patient_obj.doctor_id != staff_id:
        return Response({"error": "Patient already assigned to another doctor"}, status=409)

    # Enforce roster cap before creating a pending request
    current_count = Patient.objects.filter(doctor_id=staff_id).count()
    if current_count >= MAX_DOCTOR_PATIENTS:
        return Response({"error": f"Roster full (max {MAX_DOCTOR_PATIENTS})"}, status=400)

    if not has_doctor_patient_requests:
        # Legacy DB fallback: table missing, so assign directly.
        patient_obj.doctor_id = staff_id
        patient_obj.save(update_fields=["doctor_id"])
        serializer = PatientSerializer(patient_obj, context={"request": request})
        return Response({"message": "Patient assigned", "patient": serializer.data}, status=200)

    try:
        pending = DoctorPatientRequest.objects.filter(patient_id=patient_id, doctor_id=staff_id, status="pending").first()
    except (ProgrammingError, DatabaseError):
        pending = None
        has_doctor_patient_requests = False

    if not has_doctor_patient_requests:
        patient_obj.doctor_id = staff_id
        patient_obj.save(update_fields=["doctor_id"])
        serializer = PatientSerializer(patient_obj, context={"request": request})
        return Response({"message": "Patient assigned", "patient": serializer.data}, status=200)

    if pending:
        # Surface pending request metadata to the serializer so the frontend sees it immediately
        patient_obj.request_status = pending.status
        patient_obj.request_created_at = pending.created_at
        patient_obj.request_updated_at = pending.updated_at
        patient_obj.request_doctor_id = pending.doctor_id
        serializer = PatientSerializer(patient_obj, context={"request": request})
        return Response({"message": "Request already pending", "patient": serializer.data})

    try:
        req = DoctorPatientRequest.objects.create(patient_id=patient_id, doctor_id=staff_id, status="pending")
    except (ProgrammingError, DatabaseError):
        patient_obj.doctor_id = staff_id
        patient_obj.save(update_fields=["doctor_id"])
        serializer = PatientSerializer(patient_obj, context={"request": request})
        return Response({"message": "Patient assigned", "patient": serializer.data}, status=200)

    # Annotate the patient object in-memory with the latest request fields for the response
    patient_obj.request_status = req.status
    patient_obj.request_created_at = req.created_at
    patient_obj.request_updated_at = req.updated_at
    patient_obj.request_doctor_id = req.doctor_id

    serializer = PatientSerializer(patient_obj, context={"request": request})
    return Response({"message": "Request sent", "patient": serializer.data}, status=202)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_cancel_request(request):
    """Doctor cancels a pending request to connect to a patient."""
    staff_id = request.auth.get("staff_id") if request.auth else None
    if not staff_id:
        return Response({"error": "Not authorized"}, status=403)

    if not _table_exists(DoctorPatientRequest._meta.db_table):
        return Response({"error": "Request workflow unavailable on current schema"}, status=503)

    patient_id = request.data.get("patient_id") or request.query_params.get("patient_id")
    if not patient_id:
        return Response({"error": "patient_id is required"}, status=400)

    try:
        pending = DoctorPatientRequest.objects.filter(patient_id=patient_id, doctor_id=staff_id, status="pending").first()
    except (ProgrammingError, DatabaseError):
        return Response({"error": "Request workflow unavailable on current schema"}, status=503)
    if not pending:
        return Response({"error": "No pending request to cancel"}, status=404)

    pending.delete()
    return Response({"message": "Request cancelled"}, status=200)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_remove_patient(request):
    """Doctor removes/unassigns a patient they are connected to."""
    staff_id = request.auth.get("staff_id") if request.auth else None
    if not staff_id:
        return Response({"error": "Not authorized"}, status=403)

    patient_id = request.data.get("patient_id") or request.query_params.get("patient_id")
    if not patient_id:
        return Response({"error": "patient_id is required"}, status=400)

    try:
        patient_obj = Patient.objects.get(pk=patient_id)
    except Patient.DoesNotExist:
        return Response({"error": "Patient not found"}, status=404)

    if patient_obj.doctor_id != staff_id:
        return Response({"error": "You are not assigned to this patient"}, status=403)

    patient_obj.doctor_id = None
    patient_obj.save(update_fields=["doctor_id"])

    # Keep request history; do not delete DoctorPatientRequest rows
    serializer = PatientSerializer(patient_obj, context={"request": request})
    return Response({"message": "Patient removed", "patient": serializer.data})


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def patient_profile(request):
    """Patient: Get or update own profile"""
    patient_id = request.auth.get("patient_id")
    if not patient_id:
        return Response({"error": "Not a patient"}, status=403)
    
    try:
        patient = Patient.objects.get(pk=patient_id)
    except Patient.DoesNotExist:
        return Response({"error": "Patient not found"}, status=404)
    
    if request.method == "GET":
        return Response(PatientSerializer(patient, context={"request": request}).data)

    # PUT: update profile
    def _parse_number(value):
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        try:
            return float(value)
        except Exception:
            return None

    incoming_height = _parse_number(request.data.get("height"))
    incoming_weight = _parse_number(request.data.get("weight"))

    # Apply sensible bounds (cm/kg) to avoid unrealistic or overflow values
    MIN_HEIGHT_CM, MAX_HEIGHT_CM = 50, 300
    MIN_WEIGHT_KG, MAX_WEIGHT_KG = 1, 400

    # Normalize payload to avoid decimal coercion errors on empty strings
    payload = {k: v for k, v in request.data.items()}

    if "height" in request.data:
        payload["height"] = incoming_height
    if "weight" in request.data:
        payload["weight"] = incoming_weight
    if "email" in payload and isinstance(payload["email"], str):
        email_clean = payload["email"].strip()
        payload["email"] = email_clean
    if "username" in payload and isinstance(payload["username"], str):
        payload["username"] = payload["username"].strip()

    if incoming_height is not None and not (MIN_HEIGHT_CM <= incoming_height <= MAX_HEIGHT_CM):
        return Response({"error": f"Height must be between {MIN_HEIGHT_CM} and {MAX_HEIGHT_CM} cm."}, status=400)
    if incoming_weight is not None and not (MIN_WEIGHT_KG <= incoming_weight <= MAX_WEIGHT_KG):
        return Response({"error": f"Weight must be between {MIN_WEIGHT_KG} and {MAX_WEIGHT_KG} kg."}, status=400)

    serializer = PatientSerializer(patient, data=payload, partial=True)
    serializer.is_valid(raise_exception=True)
    patient = serializer.save()

    # Recalculate BMI if height/weight changed and values are valid
    if "height" in request.data or "weight" in request.data:
        try:
            if patient.height is None or patient.weight is None:
                patient.bmi = None
                patient.save(update_fields=["bmi"])
            else:
                height_cm = float(patient.height)
                weight_kg = float(patient.weight)
                bmi = weight_kg / ((height_cm / 100) ** 2)
                patient.bmi = round(bmi, 2)
                patient.save(update_fields=["bmi"])
        except Exception:
            return Response({"error": "Unable to calculate BMI with the provided values."}, status=400)

    return Response(PatientSerializer(patient, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def patient_handle_request(request):
    """Patient accepts or rejects a doctor request."""
    patient_id = request.auth.get("patient_id") if request.auth else None
    if not patient_id:
        return Response({"error": "Not a patient"}, status=403)

    if not _table_exists(DoctorPatientRequest._meta.db_table):
        return Response({"error": "Request workflow unavailable on current schema"}, status=503)

    decision = (request.data.get("decision") or "").strip().lower()
    if decision not in {"accept", "reject"}:
        return Response({"error": "decision must be 'accept' or 'reject'"}, status=400)

    doctor_id = request.data.get("doctor_id") or request.query_params.get("doctor_id")
    if not doctor_id:
        return Response({"error": "doctor_id is required"}, status=400)

    try:
        doctor_id_int = int(doctor_id)
    except Exception:
        return Response({"error": "doctor_id must be an integer"}, status=400)

    try:
        req = DoctorPatientRequest.objects.filter(patient_id=patient_id, doctor_id=doctor_id_int, status="pending").order_by("-created_at").first()
    except (ProgrammingError, DatabaseError):
        return Response({"error": "Request workflow unavailable on current schema"}, status=503)
    if not req:
        return Response({"error": "No pending request found"}, status=404)

    if decision == "reject":
        req.status = "rejected"
        req.save(update_fields=["status", "updated_at"])
        return Response({"message": "Request rejected"})

    # Accept path: enforce roster limits and assignment conflicts
    try:
        patient_obj = Patient.objects.get(pk=patient_id)
    except Patient.DoesNotExist:
        return Response({"error": "Patient not found"}, status=404)

    if patient_obj.doctor_id and patient_obj.doctor_id != doctor_id_int:
        req.status = "rejected"
        req.save(update_fields=["status", "updated_at"])
        return Response({"error": "Patient already assigned to another doctor"}, status=409)

    current_count = Patient.objects.filter(doctor_id=doctor_id_int).count()
    if current_count >= MAX_DOCTOR_PATIENTS:
        req.status = "rejected"
        req.save(update_fields=["status", "updated_at"])
        return Response({"error": f"Doctor roster full (max {MAX_DOCTOR_PATIENTS})"}, status=400)

    patient_obj.doctor_id = doctor_id_int
    patient_obj.save(update_fields=["doctor_id"])

    req.status = "accepted"
    req.save(update_fields=["status", "updated_at"])

    return Response({"message": "Request accepted", "patient": PatientSerializer(patient_obj, context={"request": request}).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def patient_requests(request):
    """Patient: list all doctor access requests for this patient."""
    patient_id = request.auth.get("patient_id") if request.auth else None
    if not patient_id:
        return Response({"error": "Not a patient"}, status=403)

    if not _table_exists(DoctorPatientRequest._meta.db_table):
        return Response([])

    try:
        qs = DoctorPatientRequest.objects.filter(patient_id=patient_id).select_related("doctor")
    except (ProgrammingError, DatabaseError):
        return Response([])
    serialized = DoctorPatientRequestSerializer(qs, many=True).data
    return Response(serialized)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def patient_change_password(request):
    """Patient: change password after verifying the current one."""
    patient_id = request.auth.get("patient_id")
    if not patient_id:
        return Response({"error": "Not a patient"}, status=403)

    try:
        patient = Patient.objects.get(pk=patient_id)
    except Patient.DoesNotExist:
        return Response({"error": "Patient not found"}, status=404)

    current_password = request.data.get("old_password") or request.data.get("current_password")
    new_password = request.data.get("new_password")
    confirm_password = request.data.get("confirm_password") or request.data.get("confirm")

    if not current_password or not new_password:
        return Response({"error": "Current and new passwords are required."}, status=400)

    def _password_matches(raw: str, stored: str | None) -> bool:
        try:
            if stored and check_password(raw, stored):
                return True
        except Exception:
            pass
        stored_val = stored or ""
        return raw == stored_val or raw.strip() == stored_val or raw == stored_val.strip()

    if not _password_matches(current_password, patient.password_hash):
        _record_audit_event(
            request,
            "patient",
            patient.id,
            {"context": "password_change", "success": False, "detail": "incorrect_current"},
        )
        return Response({"error": "Incorrect current password."}, status=400)

    if confirm_password is None or new_password != confirm_password:
        return Response({"error": "Passwords do not match."}, status=400)

    if not _password_meets_rules(new_password):
        return Response({"error": "Password must be at least 8 characters and include upper, lower, number, and special (*()@#?$) characters."}, status=400)

    patient.password_hash = make_password(new_password)
    patient.save(update_fields=["password_hash"])

    _record_audit_event(
        request,
        "patient",
        patient.id,
        {"context": "password_change", "success": True},
    )

    return Response({"detail": "Password updated successfully."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def patient_check_password(request):
    """Patient: validate current password without changing it."""
    patient_id = request.auth.get("patient_id")
    if not patient_id:
        return Response({"valid": False, "error": "Not a patient"}, status=403)

    try:
        patient = Patient.objects.get(pk=patient_id)
    except Patient.DoesNotExist:
        return Response({"valid": False, "error": "Patient not found"}, status=404)

    current_password = request.data.get("password") or request.data.get("current_password") or request.data.get("old_password")
    if not current_password:
        return Response({"valid": False, "error": "Password is required"}, status=400)

    def _password_matches(raw: str, stored: str | None) -> bool:
        try:
            if stored and check_password(raw, stored):
                return True
        except Exception:
            pass
        stored_val = stored or ""
        return raw == stored_val or raw.strip() == stored_val or raw == stored_val.strip()

    is_valid = _password_matches(current_password, patient.password_hash)
    status_code = 200 if is_valid else 401
    return Response({"valid": is_valid}, status=status_code)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def patient_login_attempts(request):
    """Patient: list recent login attempts for the authenticated user."""
    patient_id = request.auth.get("patient_id")
    if not patient_id:
        return Response({"error": "Not a patient"}, status=403)

    try:
        raw_limit = int(request.query_params.get("limit", 15))
        limit = max(1, min(raw_limit, 50))
    except Exception:
        limit = 15

    qs = Log.objects.filter(actor_type="patient", actor_id=patient_id).order_by("-timestamp")[:limit]
    attempts = []
    for entry in qs:
        payload: dict = {}
        if entry.action:
            try:
                payload = json.loads(entry.action)
            except Exception:
                payload = {"detail": entry.action}
        attempts.append({
            "id": entry.id,
            "success": bool(payload.get("success")),
            "timestamp": entry.timestamp,
            "ip": payload.get("ip"),
            "user_agent": payload.get("user_agent"),
            "detail": payload.get("detail") or payload.get("context"),
        })

    return Response(attempts)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminOrDoctor])
def patient_detail(request, pk):
    """Admin/Doctor: Get specific patient details"""
    try:
        patient = Patient.objects.get(pk=pk)
    except Patient.DoesNotExist:
        return Response({"error": "Patient not found"}, status=404)
    
    # Doctors can only view their own patients
    role = request.auth.get("role")
    if role == "doctor":
        staff_id = request.auth.get("staff_id")
        if patient.doctor_id and patient.doctor_id != staff_id:
            return Response({"error": "Not authorized to view this patient"}, status=403)
    
    return Response(PatientSerializer(patient, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def patient_public(request, pk):
    """Public: minimal patient info (BMI only) for frontend display fallback"""
    try:
        patient = Patient.objects.get(pk=pk)
    except Patient.DoesNotExist:
        return Response({"error": "Patient not found"}, status=404)

    return Response({
        "id": patient.id,
        "bmi": float(patient.bmi) if patient.bmi is not None else None,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsDoctor])
def doctor_patients(request):
    """Doctor: List own assigned patients plus pending requests the doctor created."""
    staff_id = request.auth.get("staff_id")
    if not staff_id:
        return Response({"error": "Not authorized"}, status=403)

    has_doctor_patient_requests = _table_exists(DoctorPatientRequest._meta.db_table)

    if not has_doctor_patient_requests:
        qs = Patient.objects.filter(doctor_id=staff_id)
        serialized = PatientSerializer(qs, many=True, context={"request": request}).data
        return Response(serialized)

    try:
        latest_request = DoctorPatientRequest.objects.filter(
            patient_id=OuterRef("pk"), doctor_id=staff_id
        ).order_by("-created_at")

        requested_ids = DoctorPatientRequest.objects.filter(doctor_id=staff_id).values("patient_id")
        qs = Patient.objects.filter(
            Q(doctor_id=staff_id) | Q(id__in=Subquery(requested_ids))
        ).distinct()

        qs = qs.annotate(
            request_status=Subquery(latest_request.values("status")[:1]),
            request_created_at=Subquery(latest_request.values("created_at")[:1]),
            request_updated_at=Subquery(latest_request.values("updated_at")[:1]),
            request_doctor_id=Subquery(latest_request.values("doctor_id")[:1]),
        )
    except (ProgrammingError, DatabaseError):
        qs = Patient.objects.filter(doctor_id=staff_id)

    serialized = PatientSerializer(qs, many=True, context={"request": request}).data
    return Response(serialized)


# ============== Device Endpoints ==============

DEVICE_REQUIRED_COLUMNS = {"label", "brand", "status", "last_synced"}
READINGS_DRAFT_REQUIRED_COLUMNS = {
    field.column
    for field in ReadingDraft._meta.concrete_fields
    if getattr(field, "column", None)
}


def _table_exists(table_name: str) -> bool:
    try:
        with connection.cursor() as cursor:
            return table_name in connection.introspection.table_names(cursor)
    except Exception:
        # Don't block requests when introspection fails.
        return True


def _readings_draft_supports_model_columns() -> bool:
    """Detect whether readings_draft has all columns expected by the current model."""
    try:
        with connection.cursor() as cursor:
            description = connection.introspection.get_table_description(cursor, ReadingDraft._meta.db_table)
    except Exception:
        return True

    column_names = {col.name for col in description}
    return READINGS_DRAFT_REQUIRED_COLUMNS.issubset(column_names)


def _schema_outdated_response(table_name: str) -> Response:
    return Response(
        {
            "error": (
                f"Database schema for '{table_name}' is outdated. "
                "Apply backend/schema_patch_add_missing_columns.sql and backend/new_tables.sql, then retry."
            )
        },
        status=503,
    )


def _devices_support_extended_fields() -> bool:
    """Detect whether the devices table includes recently added columns."""
    try:
        with connection.cursor() as cursor:
            description = connection.introspection.get_table_description(cursor, Device._meta.db_table)
    except Exception:
        # If introspection fails, do not block normal behavior.
        return True

    column_names = {col.name for col in description}
    return DEVICE_REQUIRED_COLUMNS.issubset(column_names)


def _serialize_legacy_devices(qs):
    """Serialize devices when optional columns are absent in older schemas."""
    rows = qs.values("id", "patient_id", "device_type", "is_active", "registered_at")
    return [
        {
            "id": row["id"],
            "patient": row["patient_id"],
            "device_type": row["device_type"],
            "label": row["device_type"],
            "brand": "",
            "status": "offline",
            "last_synced": None,
            "is_active": row["is_active"],
            "registered_at": row["registered_at"],
        }
        for row in rows
    ]


def _get_supported_device_types() -> set[str]:
    """Return allowed enum values for devices.device_type (legacy-safe)."""
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT e.enumlabel
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname IN (
                    SELECT udt_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = %s
                      AND column_name = 'device_type'
                )
                ORDER BY e.enumsortorder
                """,
                [Device._meta.db_table],
            )
            rows = cursor.fetchall()
    except Exception:
        return {choice for choice, _ in Device.DEVICE_TYPES}

    enum_values = {row[0] for row in rows if row and row[0]}
    return enum_values or {choice for choice, _ in Device.DEVICE_TYPES}

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def device_list(request):
    """List devices (filtered by role) or register new device"""
    patient_id = request.auth.get("patient_id")
    role = request.auth.get("role")
    
    if request.method == "GET":
        if patient_id:
            # Patient sees own devices
            qs = Device.objects.filter(patient_id=patient_id)
        elif role == "admin":
            # Admin sees all
            qs = Device.objects.all()
        elif role == "doctor":
            # Doctor sees devices of their patients
            staff_id = request.auth.get("staff_id")
            patient_ids = Patient.objects.filter(doctor_id=staff_id).values_list('id', flat=True)
            qs = Device.objects.filter(patient_id__in=patient_ids)
        else:
            qs = Device.objects.none()
        
        try:
            return Response(DeviceSerializer(qs, many=True).data)
        except (ProgrammingError, DatabaseError):
            # Backward compatibility for databases missing newer device columns.
            return Response(_serialize_legacy_devices(qs))
    
    if request.method == "POST":
        if not patient_id:
            return Response({"error": "Only patients can register devices"}, status=403)
        if not _devices_support_extended_fields():
            return Response(
                {
                    "error": "Devices schema is outdated. Apply backend/schema_patch_add_missing_columns.sql and retry."
                },
                status=503,
            )
        data = request.data.copy()
        data['patient'] = patient_id
        requested_type = str(data.get('device_type') or '').strip()
        if not requested_type:
            return Response({"error": "device_type is required"}, status=400)

        supported_types = _get_supported_device_types()
        if requested_type not in supported_types:
            return Response(
                {
                    "error": "Unsupported device_type for current database schema",
                    "device_type": requested_type,
                    "supported_device_types": sorted(supported_types),
                },
                status=400,
            )
        # Optionally set default label if not provided
        if not data.get('label'):
            data['label'] = data.get('device_type', '')
        serializer = DeviceSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save()
        except (ProgrammingError, DatabaseError):
            return Response(
                {
                    "error": "Devices schema is outdated. Apply backend/schema_patch_add_missing_columns.sql and retry."
                },
                status=503,
            )
        return Response(serializer.data, status=201)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def device_detail(request, pk):
    """Get, update, or deactivate a device"""
    try:
        device = Device.objects.get(pk=pk)
    except Device.DoesNotExist:
        return Response({"error": "Device not found"}, status=404)
    except (ProgrammingError, DatabaseError):
        legacy_device = Device.objects.filter(pk=pk).values(
            "id", "patient_id", "device_type", "is_active", "registered_at"
        ).first()
        if not legacy_device:
            return Response({"error": "Device not found"}, status=404)
        if request.method != "GET":
            return Response(
                {
                    "error": "Devices schema is outdated. Apply backend/schema_patch_add_missing_columns.sql and retry."
                },
                status=503,
            )
        return Response(
            {
                "id": legacy_device["id"],
                "patient": legacy_device["patient_id"],
                "device_type": legacy_device["device_type"],
                "label": legacy_device["device_type"],
                "brand": "",
                "status": "offline",
                "last_synced": None,
                "is_active": legacy_device["is_active"],
                "registered_at": legacy_device["registered_at"],
            }
        )
    
    patient_id = request.auth.get("patient_id")
    role = request.auth.get("role")
    
    # Check authorization
    if patient_id and device.patient_id != patient_id:
        return Response({"error": "Not authorized"}, status=403)
    
    if request.method == "GET":
        return Response(DeviceSerializer(device).data)
    
    if request.method == "PUT":
        import logging
        logger = logging.getLogger("django")
        logger.info(f"PUT /api/devices/{pk}/ data: {request.data}")
        serializer = DeviceSerializer(device, data=request.data, partial=True)
        if not serializer.is_valid():
            logger.error(f"DeviceSerializer errors: {serializer.errors}")
            return Response(serializer.errors, status=400)
        try:
            serializer.save()
        except (ProgrammingError, DatabaseError):
            return Response(
                {
                    "error": "Devices schema is outdated. Apply backend/schema_patch_add_missing_columns.sql and retry."
                },
                status=503,
            )
        return Response(serializer.data)
    
    if request.method == "DELETE":
        device.delete()
        return Response({"message": "Device deleted"})


# ============== Reading Endpoints ==============

@api_view(["GET", "POST"])
@permission_classes([AllowAny])  # auth optional for demo; GET still scopes to patient_id
def reading_list(request):
    """List or create readings against the readings_draft table"""
    if not _table_exists(ReadingDraft._meta.db_table) or not _readings_draft_supports_model_columns():
        return _schema_outdated_response(ReadingDraft._meta.db_table)

    auth_payload = request.auth or {}
    patient_id = auth_payload.get("patient_id")
    role = auth_payload.get("role")

    # Allow explicit patient id from payload as a fallback (e.g., when token lacks patient_id but client supplies it)
    body_patient_id = None
    try:
        body_patient_id = int(request.data.get("patient") or request.data.get("patient_id"))
    except Exception:
        body_patient_id = None
    # Prefer token, then body-provided patient id
    if request.method == "POST" and not patient_id and body_patient_id:
        patient_id = body_patient_id

    def parse_recorded_at(value):
        """Parse ISO strings or datetimes into an aware datetime; fallback to now on failure."""
        if isinstance(value, datetime):
            return value if timezone.is_aware(value) else timezone.make_aware(value)
        if isinstance(value, str):
            try:
                normalized = value.strip()
                if normalized.endswith("Z"):
                    normalized = normalized[:-1] + "+00:00"
                parsed = datetime.fromisoformat(normalized)
                return parsed if timezone.is_aware(parsed) else timezone.make_aware(parsed)
            except Exception:
                return timezone.now()
        return timezone.now()

    def duplicate_response(existing):
        return Response({
            "id": getattr(existing, "id", None),
            "recorded_at": getattr(existing, "recorded_at", None),
            "duplicate_skipped": True,
        }, status=200)

    def clean_value(val):
        """Normalize empty/blank payload values to None so we can detect missing metrics."""
        if val is None:
            return None
        if isinstance(val, str) and val.strip() == "":
            return None
        return val

    # Base queryset scoped by role; if unauthenticated, require explicit patient_id
    requested_patient_id = request.query_params.get("patient_id")

    if patient_id:
        qs = ReadingDraft.objects.filter(patient_id=patient_id)
    elif role == "doctor":
        staff_id = auth_payload.get("staff_id")
        patient_ids = Patient.objects.filter(doctor_id=staff_id).values_list('id', flat=True)
        qs = ReadingDraft.objects.filter(patient_id__in=patient_ids)
    elif role == "admin":
        qs = ReadingDraft.objects.all()
    else:
        # Unauthenticated: allow read only when patient_id is supplied
        if requested_patient_id:
            qs = ReadingDraft.objects.filter(patient_id=requested_patient_id)
        else:
            return Response({"error": "patient_id required"}, status=400)

    # Optional query filter for admins/doctors or unauthenticated callers
    if requested_patient_id:
        qs = qs.filter(patient_id=requested_patient_id)

    metric_map = [
        ("heart_rate", "heart_rate", "heart_device_id"),
        ("bp_systolic", "bp_systolic", "bp_device_id"),
        ("bp_diastolic", "bp_diastolic", "bp_device_id"),
        ("glucose", "glucose", "glucose_device_id"),
        ("steps", "steps", "steps_device_id"),
        ("calories", "total_calories", "calories_device_id"),
        ("oxygen", "oxygen", "oxygen_device_id"),
    ]

    if request.method == "POST":
        # Re-evaluate in case body contained patient/patient_id but earlier parsing failed
        if not patient_id and body_patient_id:
            patient_id = body_patient_id

        if not patient_id:
            return Response({"error": "patient_id is required to create readings"}, status=400)

        metric_type = request.data.get("metric_type")
        value = request.data.get("value")
        device = request.data.get("device")
        recorded_at = parse_recorded_at(request.data.get("recorded_at"))

        # Full multi-metric payload (used by the auto-generation hook)
        def handle_multi_metric_payload():
            metric_fields = [
                "heart_rate", "heart_ecg", "heart_afib", "heart_hrv_ms", "heart_rr_interval_ms",
                "bp_systolic", "bp_diastolic", "bp_mean", "bp_pulse_pressure", "bp_irregular", "bp_body_position",
                "glucose", "glucose_trend", "glucose_hba1c", "glucose_fasting",
                "steps", "daily_steps", "step_distance_km", "walking_pace", "cadence", "floors_climbed",
                "calories", "basal_calories", "total_calories", "metabolic_equivalent",
                "oxygen", "vo2_max", "respiration_rate", "oxygen_variability",
                "sleep_stage", "sleep_duration_minutes", "sleep_score",
                "body_temperature", "skin_temperature",
            ]
            device_fields = [
                "heart_device_id", "bp_device_id", "glucose_device_id", "steps_device_id", "calories_device_id", "oxygen_device_id",
            ]

            fields = {"patient_id": patient_id, "recorded_at": recorded_at}
            for key in metric_fields + device_fields:
                if key in request.data:
                    fields[key] = clean_value(request.data.get(key))

            metrics_present = []
            for metric_key, value_field, device_field in metric_map:
                val = fields.get(value_field)
                # Allow plain calories fallback
                if metric_key == "calories" and val is None:
                    val = fields.get("calories")
                if val is not None:
                    metrics_present.append({
                        "metric_type": metric_key,
                        "value": val,
                        "device": fields.get(device_field),
                    })

            if not metrics_present:
                provided_keys = list(request.data.keys()) if hasattr(request.data, 'keys') else []
                return Response({"error": "No metric values provided", "provided_keys": provided_keys}, status=400)

            existing = _find_nearby_reading(patient_id=patient_id, recorded_at=recorded_at, window_seconds=55)
            if existing is not None:
                return duplicate_response(existing)

            reading = ReadingDraft.objects.create(**fields)

            # Store alerts for any metrics that breach thresholds
            _create_alerts_for_metrics(patient_id, metrics_present)

            metric_values = {}
            for metric in metrics_present:
                try:
                    metric_values[str(metric["metric_type"])] = float(metric["value"])
                except Exception:
                    continue

            _update_goal_progress_for_day(
                patient_id=patient_id,
                day=_to_local_date(reading.recorded_at or recorded_at),
                metric_values=metric_values,
            )

            response_metrics = [{
                "metric_type": m["metric_type"],
                "value": m["value"],
                "recorded_at": reading.recorded_at or recorded_at,
                "device": m["device"],
            } for m in metrics_present]

            return Response({
                "id": getattr(reading, "id", None),
                "recorded_at": reading.recorded_at or recorded_at,
                "metrics": response_metrics,
            }, status=201)

        # Always try multi-metric first; if it saves rows, we're done. If it reports no metrics, fall through to single.
        multi_result = handle_multi_metric_payload()
        if isinstance(multi_result, Response) and multi_result.status_code != 400:
            return multi_result

        # If multi-metric payload failed to detect metrics, try to infer a single metric_type/value
        if (not metric_type or value is None) and isinstance(multi_result, Response) and multi_result.status_code == 400:
            for metric_key, value_field, device_field in metric_map:
                candidate_val = clean_value(request.data.get(value_field))
                if metric_key == "calories" and candidate_val is None:
                    candidate_val = clean_value(request.data.get("calories"))
                if candidate_val is None:
                    continue
                metric_type = metric_type or metric_key
                if value is None:
                    value = candidate_val
                if device is None:
                    device = clean_value(request.data.get(device_field))
                break
        # Special handling for composite blood pressure submissions
        if metric_type in {"blood_pressure", "bp"}:
            systolic = request.data.get("systolic") or request.data.get("bp_systolic")
            diastolic = request.data.get("diastolic") or request.data.get("bp_diastolic")
            if systolic is None or diastolic is None:
                return Response({"error": "systolic and diastolic are required for blood_pressure"}, status=400)

            fields = {
                "patient_id": patient_id,
                "bp_systolic": systolic,
                "bp_diastolic": diastolic,
                "recorded_at": recorded_at or timezone.now(),
            }
            if device is not None:
                fields["bp_device_id"] = device

            existing = _find_nearby_reading(patient_id=patient_id, recorded_at=fields["recorded_at"], window_seconds=55)
            if existing is not None:
                return duplicate_response(existing)

            reading = ReadingDraft.objects.create(**fields)
            return Response({
                "id": getattr(reading, "id", None),
                "metric_type": "blood_pressure",
                "value": None,
                "systolic": systolic,
                "diastolic": diastolic,
                "recorded_at": reading.recorded_at,
                "device": device,
            }, status=201)

        metric_lookup = {
            "heart": ("heart_rate", "heart_device_id"),
            "heart_rate": ("heart_rate", "heart_device_id"),
            "bp_systolic": ("bp_systolic", "bp_device_id"),
            "bp_diastolic": ("bp_diastolic", "bp_device_id"),
            "glucose": ("glucose", "glucose_device_id"),
            "steps": ("steps", "steps_device_id"),
            "calories": ("total_calories", "calories_device_id"),
            "oxygen": ("oxygen", "oxygen_device_id"),
        }

        if metric_type not in metric_lookup:
            # If we got here, multi-metric had no values; surface a clearer message (include known keys for debugging)
            provided_keys = list(request.data.keys()) if hasattr(request.data, 'keys') else []
            return Response({"error": "Unsupported metric_type and no metrics provided", "provided_keys": provided_keys}, status=400)

        value_field, device_field = metric_lookup[metric_type]
        fields = {
            "patient_id": patient_id,
            value_field: value,
            "recorded_at": recorded_at or timezone.now(),
        }

        if device is not None:
            fields[device_field] = device

        existing = _find_nearby_reading(patient_id=patient_id, recorded_at=fields["recorded_at"], window_seconds=55)
        if existing is not None:
            return duplicate_response(existing)

        reading = ReadingDraft.objects.create(**fields)

        # Store alerts for the single-metric submission
        _create_alerts_for_metrics(patient_id, [{
            "metric_type": metric_type,
            "value": value,
            "device": device,
        }])

        try:
            metric_value = float(value)
            _update_goal_progress_for_day(
                patient_id=patient_id,
                day=_to_local_date(reading.recorded_at or recorded_at),
                metric_values={str(metric_type): metric_value},
            )
        except Exception:
            pass

        return Response({
            "id": getattr(reading, "id", None),
            "metric_type": metric_type,
            "value": value,
            "recorded_at": reading.recorded_at,
            "device": device,
        }, status=201)

    # GET request handling
    metric_filter = request.query_params.get('metric_type')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    limit = int(request.query_params.get('limit', 100))

    if start_date:
        qs = qs.filter(recorded_at__gte=start_date)
    if end_date:
        qs = qs.filter(recorded_at__lte=end_date)

    qs = qs.order_by('-recorded_at')

    flattened = []
    for row in qs:
        for metric_key, value_field, device_field in metric_map:
            if metric_filter and metric_key != metric_filter:
                continue
            val = getattr(row, value_field)
            if val is None:
                continue
            flattened.append({
                "id": getattr(row, "id", None),
                "metric_type": metric_key,
                "value": val,
                "recorded_at": row.recorded_at,
                "device": getattr(row, device_field),
            })

    flattened.sort(key=lambda r: r["recorded_at"] or timezone.now(), reverse=True)

    if limit:
        flattened = flattened[:limit]

    return Response(flattened)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reading_stats(request):
    """Get aggregated stats from readings_draft"""
    if not _table_exists(ReadingDraft._meta.db_table) or not _readings_draft_supports_model_columns():
        return _schema_outdated_response(ReadingDraft._meta.db_table)

    patient_id = request.auth.get("patient_id")

    if not patient_id:
        patient_id = request.query_params.get('patient_id')
        if not patient_id:
            return Response({"error": "patient_id required"}, status=400)

    days = int(request.query_params.get('days', 7))
    since = timezone.now() - timedelta(days=days)

    qs = ReadingDraft.objects.filter(patient_id=patient_id, recorded_at__gte=since)

    metric_fields = {
        "heart_rate": "heart_rate",
        "bp_systolic": "bp_systolic",
        "bp_diastolic": "bp_diastolic",
        "glucose": "glucose",
        "steps": "steps",
        "calories": "total_calories",
        "oxygen": "oxygen",
    }

    aggregates = {}
    for row in qs:
        for metric_key, field_name in metric_fields.items():
            val = getattr(row, field_name)
            if val is None:
                continue
            val = float(val)
            if metric_key not in aggregates:
                aggregates[metric_key] = {
                    "metric_type": metric_key,
                    "total": 0.0,
                    "count": 0,
                    "max_value": val,
                    "min_value": val,
                }
            agg = aggregates[metric_key]
            agg["total"] += val
            agg["count"] += 1
            agg["max_value"] = max(agg["max_value"], val)
            agg["min_value"] = min(agg["min_value"], val)

    stats = []
    for metric_key, agg in aggregates.items():
        stats.append({
            "metric_type": metric_key,
            "avg_value": agg["total"] / agg["count"] if agg["count"] else None,
            "max_value": agg["max_value"],
            "min_value": agg["min_value"],
            "count": agg["count"],
        })

    return Response(stats)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reading_streaks(request):
    """Return goal-completed dates (or reading dates when no goals) and streak counts for a patient."""
    if not _table_exists(ReadingDraft._meta.db_table) or not _readings_draft_supports_model_columns():
        return _schema_outdated_response(ReadingDraft._meta.db_table)

    patient_id = request.auth.get("patient_id")
    if not patient_id:
        patient_id = request.query_params.get("patient_id")
        if not patient_id:
            return Response({"error": "patient_id required"}, status=400)

    def parse_date(value):
        if not value:
            return None
        try:
            return datetime.fromisoformat(value).date()
        except ValueError:
            return None

    today = timezone.localdate()
    start_date = parse_date(request.query_params.get("start_date"))
    end_date = parse_date(request.query_params.get("end_date")) or today

    if request.query_params.get("start_date") and start_date is None:
        return Response({"error": "Invalid start_date"}, status=400)
    if request.query_params.get("end_date") and parse_date(request.query_params.get("end_date")) is None:
        return Response({"error": "Invalid end_date"}, status=400)

    if not start_date:
        start_date = end_date - timedelta(days=90)

    rows = ReadingDraft.objects.filter(
        patient_id=patient_id,
        recorded_at__isnull=False,
        recorded_at__date__gte=start_date,
        recorded_at__date__lte=end_date,
    ).order_by("recorded_at")

    goals_in_window = list(
        Goal.objects.filter(patient_id=patient_id, start_date__lte=end_date)
        .filter(Q(end_date__isnull=True) | Q(end_date__gt=start_date))
        .order_by("metric_type", "-start_date", "-created_at", "-id")
    )

    if not goals_in_window:
        date_values = rows.values_list("recorded_at__date", flat=True).distinct()
        unique_dates = {d for d in date_values if d}
    else:
        tracked_metrics = {
            goal.metric_type
            for goal in goals_in_window
            if GOAL_TO_READING_FIELD.get(goal.metric_type)
        }

        if not tracked_metrics:
            date_values = rows.values_list("recorded_at__date", flat=True).distinct()
            unique_dates = {d for d in date_values if d}
            sorted_dates = sorted(unique_dates)

            # Current streak counts back from the most recent day within the window (default today)
            window_end = min(end_date, today)
            current_streak = 0
            cursor = window_end
            while cursor in unique_dates:
                current_streak += 1
                cursor -= timedelta(days=1)

            # Longest streak in the window
            longest_streak = 0
            if sorted_dates:
                run = 1
                for prev, curr in zip(sorted_dates, sorted_dates[1:]):
                    if curr == prev + timedelta(days=1):
                        run += 1
                    else:
                        longest_streak = max(longest_streak, run)
                        run = 1
                longest_streak = max(longest_streak, run)

            return Response({
                "dates": [d.isoformat() for d in sorted_dates],
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            })

        daily_metric_max = _build_daily_metric_max(rows, tracked_metrics)

        unique_dates: set[date] = set()
        cursor = start_date
        while cursor <= end_date:
            goals_by_metric = _active_goals_for_day_from_rows(goals_in_window, cursor)
            evaluable_goals = [
                (metric, goal)
                for metric, goal in goals_by_metric.items()
                if metric in tracked_metrics
            ]
            if evaluable_goals:
                all_met = True
                for metric, goal in evaluable_goals:
                    value = daily_metric_max.get(cursor, {}).get(metric)
                    if value is None or not _is_goal_completed(goal, value):
                        all_met = False
                        break
                if all_met:
                    unique_dates.add(cursor)
            cursor += timedelta(days=1)

    sorted_dates = sorted(unique_dates)

    # Current streak counts back from the most recent day within the window (default today)
    window_end = min(end_date, today)
    current_streak = 0
    cursor = window_end
    while cursor in unique_dates:
        current_streak += 1
        cursor -= timedelta(days=1)

    # Longest streak in the window
    longest_streak = 0
    if sorted_dates:
        run = 1
        for prev, curr in zip(sorted_dates, sorted_dates[1:]):
            if curr == prev + timedelta(days=1):
                run += 1
            else:
                longest_streak = max(longest_streak, run)
                run = 1
        longest_streak = max(longest_streak, run)

    return Response({
        "dates": [d.isoformat() for d in sorted_dates],
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
    })


# ============== AI Recommendations ==============

def _compute_patient_summary(patient_id: int, days: int) -> dict:
    """Compute a compact summary over readings_draft rows for a patient."""
    since = timezone.now() - timedelta(days=days)

    rows = list(
        ReadingDraft.objects.filter(patient_id=patient_id, recorded_at__gte=since)
        .order_by("recorded_at")
    )
    if not rows:
        rows = list(ReadingDraft.objects.filter(patient_id=patient_id).order_by("recorded_at"))
    if not rows:
        return {
            "period": {"start": since.isoformat(), "end": timezone.now().isoformat()},
            "summary": {},
            "risk_flags": [],
        }

    def _series(field: str):
        data = []
        for row in rows:
            val = getattr(row, field)
            if val is None:
                continue
            ts = row.recorded_at or row.created_at or timezone.now()
            data.append((ts, float(val)))
        return data

    def _summarize_numeric(field: str):
        series = _series(field)
        if not series:
            return {"avg": None, "trend": "no_data"}
        series.sort(key=lambda item: item[0])
        values = [v for _, v in series]
        avg_val = sum(values) / len(values)
        first, last = values[0], values[-1]
        trend = "stable"
        if len(values) > 1:
            baseline = first if first != 0 else 1.0
            delta_ratio = (last - first) / baseline
            if delta_ratio > 0.05:
                trend = "increasing"
            elif delta_ratio < -0.05:
                trend = "decreasing"
        return {"avg": round(avg_val, 2), "trend": trend}

    def _latest_value(field: str):
        for row in reversed(rows):
            val = getattr(row, field)
            if val is not None:
                return val
        return None

    def _count_true(field: str) -> int:
        return sum(1 for row in rows if getattr(row, field) is True)

    # Numeric summaries
    heart_rate = _summarize_numeric("heart_rate")
    heart_hrv = _summarize_numeric("heart_hrv_ms")
    heart_rr = _summarize_numeric("heart_rr_interval_ms")
    bp_systolic = _summarize_numeric("bp_systolic")
    bp_diastolic = _summarize_numeric("bp_diastolic")
    bp_mean = _summarize_numeric("bp_mean")
    bp_pulse_pressure = _summarize_numeric("bp_pulse_pressure")
    glucose = _summarize_numeric("glucose")
    glucose_hba1c = _summarize_numeric("glucose_hba1c")
    steps = _summarize_numeric("steps")
    daily_steps = _summarize_numeric("daily_steps")
    step_distance = _summarize_numeric("step_distance_km")
    walking_pace = _summarize_numeric("walking_pace")
    cadence = _summarize_numeric("cadence")
    floors_climbed = _summarize_numeric("floors_climbed")
    calories = _summarize_numeric("calories")
    basal_calories = _summarize_numeric("basal_calories")
    total_calories = _summarize_numeric("total_calories")
    met = _summarize_numeric("metabolic_equivalent")
    oxygen = _summarize_numeric("oxygen")
    oxygen_variability = _summarize_numeric("oxygen_variability")
    vo2_max = _summarize_numeric("vo2_max")
    respiration_rate = _summarize_numeric("respiration_rate")
    sleep_duration = _summarize_numeric("sleep_duration_minutes")
    sleep_score = _summarize_numeric("sleep_score")
    body_temperature = _summarize_numeric("body_temperature")
    skin_temperature = _summarize_numeric("skin_temperature")

    latest_stage = _latest_value("sleep_stage")
    latest_glucose_trend = _latest_value("glucose_trend")
    latest_bp_position = _latest_value("bp_body_position")
    latest_ecg = _latest_value("heart_ecg")

    risk_flags = []
    if heart_rate.get("avg") and heart_rate["avg"] > 100:
        risk_flags.append("elevated_resting_hr")
    if glucose.get("avg"):
        if glucose["avg"] > 180:
            risk_flags.append("high_glucose")
        elif glucose["avg"] < 70:
            risk_flags.append("low_glucose")
    if bp_systolic.get("avg") and bp_systolic["avg"] >= 140:
        risk_flags.append("high_bp_systolic")
    if oxygen.get("avg") and oxygen["avg"] < 94:
        risk_flags.append("low_oxygen")
    if steps.get("avg") and steps["avg"] < 5000:
        risk_flags.append("low_activity")
    if sleep_duration.get("avg") and sleep_duration["avg"] < 360:
        risk_flags.append("low_sleep_duration")

    latest_devices = {
        "heart_device_id": _latest_value("heart_device_id"),
        "bp_device_id": _latest_value("bp_device_id"),
        "glucose_device_id": _latest_value("glucose_device_id"),
        "calories_device_id": _latest_value("calories_device_id"),
        "steps_device_id": _latest_value("steps_device_id"),
        "oxygen_device_id": _latest_value("oxygen_device_id"),
    }

    latest_ts = rows[-1].recorded_at or rows[-1].created_at or timezone.now()

    summary = {
        "heart": {
            "avg_rate": heart_rate["avg"],
            "trend_rate": heart_rate["trend"],
            "afib_events": _count_true("heart_afib"),
            "avg_hrv_ms": heart_hrv["avg"],
            "avg_rr_interval_ms": heart_rr["avg"],
            "latest_ecg": latest_ecg,
        },
        "blood_pressure": {
            "avg_systolic": bp_systolic["avg"],
            "avg_diastolic": bp_diastolic["avg"],
            "avg_mean": bp_mean["avg"],
            "avg_pulse_pressure": bp_pulse_pressure["avg"],
            "trend_systolic": bp_systolic["trend"],
            "trend_diastolic": bp_diastolic["trend"],
            "irregular_events": _count_true("bp_irregular"),
            "latest_body_position": latest_bp_position,
        },
        "glucose": {
            "avg": glucose["avg"],
            "trend": glucose["trend"],
            "avg_hba1c": glucose_hba1c["avg"],
            "latest_trend": latest_glucose_trend,
            "fasting_events": _count_true("glucose_fasting"),
        },
        "activity": {
            "avg_steps": steps["avg"],
            "trend_steps": steps["trend"],
            "avg_daily_steps": daily_steps["avg"],
            "avg_distance_km": step_distance["avg"],
            "avg_walking_pace": walking_pace["avg"],
            "avg_cadence": cadence["avg"],
            "avg_floors_climbed": floors_climbed["avg"],
        },
        "calories": {
            "avg_total": total_calories["avg"],
            "trend_total": total_calories["trend"],
            "avg_basal": basal_calories["avg"],
            "avg_active": calories["avg"],
            "avg_metabolic_equivalent": met["avg"],
        },
        "oxygen": {
            "avg": oxygen["avg"],
            "trend": oxygen["trend"],
            "avg_variability": oxygen_variability["avg"],
            "avg_vo2_max": vo2_max["avg"],
            "avg_respiration_rate": respiration_rate["avg"],
        },
        "sleep": {
            "avg_duration_minutes": sleep_duration["avg"],
            "trend_duration": sleep_duration["trend"],
            "avg_sleep_score": sleep_score["avg"],
            "latest_stage": latest_stage,
        },
        "temperature": {
            "avg_body_temperature": body_temperature["avg"],
            "trend_body_temperature": body_temperature["trend"],
            "avg_skin_temperature": skin_temperature["avg"],
            "trend_skin_temperature": skin_temperature["trend"],
        },
        "metadata": {
            "latest_recorded_at": latest_ts.isoformat(),
            "devices": latest_devices,
        },
    }

    return {
        "period": {
            "start": since.isoformat(),
            "end": timezone.now().isoformat(),
        },
        "summary": summary,
        "risk_flags": risk_flags,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ai_summary(request, user_id):
    """Return a lightweight summary over readings_draft for the logged-in user."""
    auth_payload = request.auth or {}
    role = auth_payload.get("role")
    patient_id = auth_payload.get("patient_id")
    staff_id = auth_payload.get("staff_id")

    # Enforce that patients can only read their own summary; doctors must own the patient; admins are allowed.
    if patient_id:
        if int(patient_id) != int(user_id):
            return Response({"error": "Not authorized for this patient"}, status=403)
    elif role == "doctor":
        if not Patient.objects.filter(id=user_id, doctor_id=staff_id).exists():
            return Response({"error": "Not authorized for this patient"}, status=403)
    elif role != "admin":
        return Response({"error": "Not authorized"}, status=403)

    days = int(request.query_params.get("days", 7))
    result = _compute_patient_summary(user_id, days)
    return Response(result)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_chat(request):
    """Chat endpoint that builds context from patient summaries and forwards to OpenAI."""
    auth_payload = request.auth or {}
    role = auth_payload.get("role")
    patient_id = auth_payload.get("patient_id")
    staff_id = auth_payload.get("staff_id")

    # Determine target patient
    target_patient = patient_id
    if not target_patient:
        target_patient = request.data.get("patient_id") or request.query_params.get("patient_id")

    if target_patient:
        try:
            target_patient = int(target_patient)
        except Exception:
            return Response({"error": "invalid patient_id"}, status=400)

    # Access control: patients only self; doctors must own; admins allowed if patient_id provided
    if patient_id:
        if target_patient is None:
            target_patient = int(patient_id)
        elif int(patient_id) != int(target_patient):
            return Response({"error": "Not authorized for this patient"}, status=403)
    elif role == "doctor":
        if target_patient is None:
            return Response({"error": "patient_id required"}, status=400)
        if not Patient.objects.filter(id=target_patient, doctor_id=staff_id).exists():
            return Response({"error": "Not authorized for this patient"}, status=403)
    elif role == "admin":
        if target_patient is None:
            return Response({"error": "patient_id required"}, status=400)
    else:
        return Response({"error": "Not authorized"}, status=403)

    message = request.data.get("message") if hasattr(request, "data") else None
    if not message or not str(message).strip():
        return Response({"error": "message is required"}, status=400)
    message = str(message).strip()

    days = int(request.query_params.get("days", 7))
    summary_payload = _compute_patient_summary(int(target_patient), days)

    # Build a compact context string for the LLM
    summary = summary_payload.get("summary", {})
    risk_flags = summary_payload.get("risk_flags", [])
    core_context = {
        "heart": summary.get("heart"),
        "blood_pressure": summary.get("blood_pressure"),
        "glucose": summary.get("glucose"),
        "activity": summary.get("activity"),
        "oxygen": summary.get("oxygen"),
        "sleep": summary.get("sleep"),
        "risk_flags": risk_flags,
    }

    api_key = getattr(settings, "OPENAI_API_KEY", None) or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return Response({
            "answer": "AI is unavailable right now. Try again later.",
            "summary": summary,
            "risk_flags": risk_flags,
        })

    try:
        from openai import OpenAI
    except ImportError:
        return Response({
            "answer": "AI is unavailable right now. Try again later.",
            "summary": summary,
            "risk_flags": risk_flags,
        })

    client = OpenAI(api_key=api_key)

    system_prompt = (
        "You are a concise health coach. Use the provided patient metrics and risk flags to answer the user's question. "
        "Stay within lifestyle, activity, nutrition, and monitoring guidance. Do not diagnose or give emergency advice."
    )
    user_prompt = (
        "Patient context (compact JSON):\n"
        f"{json.dumps(core_context, default=str)}\n\n"
        f"User message: {message}"
    )

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=320,
        )
        answer = completion.choices[0].message.content.strip() if completion.choices else ""
    except Exception as exc:
        print(f"OpenAI error (ai_chat): {exc}")
        answer = "AI is unavailable right now. Please try again later."

    return Response({
        "answer": answer,
        "summary": summary,
        "risk_flags": risk_flags,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ai_recommendations(request):
    """Generate short lifestyle recommendations using OpenAI"""
    if not _table_exists(ReadingDraft._meta.db_table) or not _readings_draft_supports_model_columns():
        return _schema_outdated_response(ReadingDraft._meta.db_table)

    patient_id = request.auth.get("patient_id")
    if not patient_id:
        patient_id = request.query_params.get("patient_id") or None
    if not patient_id:
        patient_id = Patient.objects.values_list("id", flat=True).first()
    if not patient_id:
        return Response({"recommendations": []})

    days = int(request.query_params.get("days", 7))
    since = timezone.now() - timedelta(days=days)

    metric_fields = {
        "heart_rate": "heart_rate",
        "heart_hrv_ms": "heart_hrv_ms",
        "heart_rr_interval_ms": "heart_rr_interval_ms",
        "bp_systolic": "bp_systolic",
        "bp_diastolic": "bp_diastolic",
        "bp_mean": "bp_mean",
        "bp_pulse_pressure": "bp_pulse_pressure",
        "glucose": "glucose",
        "glucose_hba1c": "glucose_hba1c",
        "steps": "steps",
        "daily_steps": "daily_steps",
        "step_distance_km": "step_distance_km",
        "walking_pace": "walking_pace",
        "cadence": "cadence",
        "floors_climbed": "floors_climbed",
        "calories": "total_calories",
        "basal_calories": "basal_calories",
        "metabolic_equivalent": "metabolic_equivalent",
        "oxygen": "oxygen",
        "oxygen_variability": "oxygen_variability",
        "vo2_max": "vo2_max",
        "respiration_rate": "respiration_rate",
        "sleep_duration_minutes": "sleep_duration_minutes",
        "sleep_score": "sleep_score",
    }

    rows = ReadingDraft.objects.filter(patient_id=patient_id, recorded_at__gte=since)

    aggregates = {}
    latest = {}
    for row in rows:
        for metric_key, field_name in metric_fields.items():
            val = getattr(row, field_name)
            if val is None:
                continue
            val = float(val)
            agg = aggregates.setdefault(metric_key, {"total": 0.0, "count": 0})
            agg["total"] += val
            agg["count"] += 1
            if metric_key not in latest or (row.recorded_at and row.recorded_at > latest[metric_key]["recorded_at"]):
                latest[metric_key] = {"value": val, "recorded_at": row.recorded_at}

    metric_lines = []
    for metric_key, agg in aggregates.items():
        avg_val = agg["total"] / agg["count"] if agg["count"] else None
        latest_val = latest.get(metric_key, {}).get("value")
        latest_time = latest.get(metric_key, {}).get("recorded_at")
        avg_text = f"{avg_val:.1f}" if avg_val is not None else "n/a"
        latest_text = f"{latest_val:.1f}" if latest_val is not None else "n/a"
        time_text = latest_time.isoformat() if latest_time else "n/a"
        metric_lines.append(f"{metric_key}: avg {avg_text}, latest {latest_text} at {time_text}")

    metrics_summary = "\n".join(metric_lines) if metric_lines else "No recent readings recorded."

    def build_basic_recs() -> list[dict]:
        """Generate simple, deterministic recommendations from aggregated metrics; always returns >=3 items."""
        recs: list[dict] = []

        def push(metric: str, text: str) -> None:
            recs.append({"metric": metric, "text": text})

        def avg(metric: str) -> float | None:
            agg = aggregates.get(metric)
            if not agg or not agg.get("count"):
                return None
            return agg["total"] / agg["count"]

        heart_avg = avg("heart_rate")
        if heart_avg is not None:
            if heart_avg > 95:
                push("Heart Rate", "Your average heart rate is elevated; add a 10-minute relaxation or breathing session today.")
            elif heart_avg < 55:
                push("Heart Rate", "Resting heart rate is on the low side; stay hydrated and avoid sudden intense exertion today.")

        glucose_avg = avg("glucose")
        if glucose_avg is not None:
            if glucose_avg > 170:
                push("Glucose", "Glucose has been high; plan a balanced meal with fiber and a 15-minute walk after eating.")
            elif glucose_avg < 80:
                push("Glucose", "Glucose is trending low; keep a quick carb snack handy and avoid skipping meals.")

        steps_avg = avg("steps")
        if steps_avg is not None:
            if steps_avg < 6000:
                push("Steps", "Aim for one extra 1,500-step walk this afternoon to close the activity gap.")
            else:
                push("Steps", "Nice activity trend; include 5-10 minutes of stretching to aid recovery today.")

        calories_avg = avg("calories")
        if calories_avg is not None:
            if calories_avg < 1600:
                push("Calories", "Calories look low; add a protein-rich snack to support energy.")
            elif calories_avg > 3200:
                push("Calories", "Calorie burn is high; hydrate well and refuel with balanced carbs and protein.")

        oxygen_avg = avg("oxygen")
        if oxygen_avg is not None and oxygen_avg < 95:
            push("Oxygen", "Oxygen readings dip below 95%; take breaks and monitor if you feel breathless.")

        # Ensure at least three recommendations with supportive defaults
        fallback_texts = [
            ("Sleep", "Aim for a consistent 7-9 hour sleep window tonight to support recovery."),
            ("Hydration", "Carry water and target 6-8 glasses spaced through the day."),
            ("Routine", "Schedule two short movement breaks (5-10 minutes) to reduce sedentary time."),
        ]
        i = 0
        while len(recs) < 3 and i < len(fallback_texts):
            metric, text = fallback_texts[i]
            push(metric, text)
            i += 1

        return recs[:5]

    api_key = getattr(settings, "OPENAI_API_KEY", None) or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return Response({"recommendations": build_basic_recs()})

    try:
        from openai import OpenAI
    except ImportError:
        return Response({"recommendations": build_basic_recs()})

    client = OpenAI(api_key=api_key)

    prompt = (
        "You are a concise clinical health coach. "
        "Using the patient metrics below from the last "
        f"{days} days, write exactly 5 distinct recommendations, each under 25 words. "
        "For each, pick the most relevant metric title from: Heart Rate, Glucose, Steps, Calories, Oxygen. "
        "Be specific, safe, and practical. If data is missing, note it briefly. "
        "Return JSON: {\"recommendations\": [{\"metric\":\"Heart Rate\",\"text\":\"...\"}, ...]}.\n\n"
        f"Metrics:\n{metrics_summary}"
    )

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a clinician providing brief, actionable health advice. Keep each item under 25 words and avoid guarantees.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=260,
            temperature=0.55,
            response_format={"type": "json_object"},
        )
        content = completion.choices[0].message.content.strip() if completion.choices else "{}"
        parsed = json.loads(content)
        recs = parsed.get("recommendations") if isinstance(parsed, dict) else None
        if not isinstance(recs, list):
            recs = []
        cleaned = []
        for r in recs:
            metric = None
            text = None
            if isinstance(r, dict):
                metric = str(r.get("metric", "")).strip()
                text = str(r.get("text", "")).strip()
            else:
                text = str(r).strip()
            if text:
                cleaned.append({
                    "metric": metric or "Recommendations",
                    "text": text,
                })
        recs = cleaned
    except Exception as exc:
        print(f"OpenAI error: {exc}")
        recs = []

    if not recs:
        recs = build_basic_recs()

    return Response({"recommendations": recs})


# ============== Goal Endpoints ==============

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def goal_list(request):
    """List or create goals"""
    if not _table_exists(Goal._meta.db_table):
        return _schema_outdated_response(Goal._meta.db_table)

    patient_id = request.auth.get("patient_id")
    
    if request.method == "GET":
        if patient_id:
            qs = Goal.objects.filter(patient_id=patient_id)
        else:
            pid = request.query_params.get('patient_id')
            qs = Goal.objects.filter(patient_id=pid) if pid else Goal.objects.none()

        qs = qs.order_by('-created_at', '-id')
        
        return Response(GoalSerializer(qs, many=True).data)
    
    if request.method == "POST":
        if not patient_id:
            return Response({"error": "Only patients can create goals"}, status=403)
        
        data = request.data.copy()
        data['patient'] = patient_id
        metric_type = data.get('metric_type')

        raw_start_date = data.get('start_date')
        effective_start_date = None
        if isinstance(raw_start_date, str):
            effective_start_date = parse_date(raw_start_date)

        if effective_start_date is None:
            effective_start_date = timezone.now().date()
            data['start_date'] = effective_start_date.isoformat()

        with transaction.atomic():
            same_day_goal = None
            if metric_type:
                same_day_goal = (
                    Goal.objects.filter(
                        patient_id=patient_id,
                        metric_type=metric_type,
                        start_date=effective_start_date,
                    )
                    .order_by('-created_at', '-id')
                    .first()
                )

            # If a goal already exists for this metric on this day, update it in place.
            if same_day_goal:
                serializer = GoalSerializer(same_day_goal, data=data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                return Response(serializer.data)

            # Keep one active goal per patient + metric by closing prior active rows.
            if metric_type:
                Goal.objects.filter(
                    patient_id=patient_id,
                    metric_type=metric_type,
                    is_active=True,
                ).update(is_active=False, end_date=effective_start_date)

            serializer = GoalSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()

        return Response(serializer.data, status=201)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def goal_detail(request, pk):
    """Get, update, or delete a goal"""
    try:
        goal = Goal.objects.get(pk=pk)
    except Goal.DoesNotExist:
        return Response({"error": "Goal not found"}, status=404)
    
    patient_id = request.auth.get("patient_id")
    if patient_id and goal.patient_id != patient_id:
        return Response({"error": "Not authorized"}, status=403)
    
    if request.method == "GET":
        return Response(GoalSerializer(goal).data)
    
    if request.method == "PUT":
        serializer = GoalSerializer(goal, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    if request.method == "DELETE":
        goal.delete()
        return Response({"message": "Goal deleted"})


@api_view(["POST"])
@permission_classes([AllowAny])
def reading_live_start(request):
    """Start a background generator that writes readings_draft every ~2 minutes for a patient.

    - If authenticated as patient: uses their id
    - If staff/admin/doctor: may provide patient_id in body
    - If unauthenticated (demo): must provide patient_id
    """
    auth_payload = request.auth or {}
    patient_id = auth_payload.get("patient_id")
    role = auth_payload.get("role")

    try:
        body_patient = request.data.get("patient_id") or request.data.get("patient")
        body_patient = int(body_patient) if body_patient is not None else None
    except Exception:
        body_patient = None

    if not patient_id:
        if role in {"admin", "doctor"} and body_patient:
            patient_id = body_patient
        elif body_patient:
            patient_id = body_patient

    if not patient_id:
        return Response({"error": "patient_id missing"}, status=400)

    # Ensure patient exists to avoid runaway threads on bad ids
    if not Patient.objects.filter(pk=patient_id).exists():
        return Response({"error": "patient not found"}, status=404)

    try:
        interval = int(request.data.get("interval", 120))
    except Exception:
        interval = 120

    interval = max(30, min(interval, 600))

    started = _start_live_generator(int(patient_id), interval_seconds=interval)
    return Response({
        "patient_id": patient_id,
        "interval_seconds": interval,
        "status": "started" if started else "already-running",
    })


# ============== Threshold Endpoints ==============

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def threshold_list(request):
    """List or create thresholds"""
    patient_id = request.auth.get("patient_id")
    
    if request.method == "GET":
        if patient_id:
            qs = Threshold.objects.filter(patient_id=patient_id)
        else:
            pid = request.query_params.get('patient_id')
            qs = Threshold.objects.filter(patient_id=pid) if pid else Threshold.objects.none()

        qs = qs.order_by('-created_at', '-id')
        
        return Response(ThresholdSerializer(qs, many=True).data)
    
    if request.method == "POST":
        if not patient_id:
            return Response({"error": "Only patients can create thresholds"}, status=403)
        
        data = request.data.copy()
        data['patient'] = patient_id

        metric_type = data.get('metric_type')
        condition = data.get('condition')
        today = timezone.now().date()

        with transaction.atomic():
            same_day_threshold = None
            if metric_type and condition:
                same_day_threshold = (
                    Threshold.objects.filter(
                        patient_id=patient_id,
                        metric_type=metric_type,
                        condition=condition,
                        created_at__date=today,
                    )
                    .order_by('-created_at', '-id')
                    .first()
                )

            # If a threshold already exists today for this metric/condition, update in place.
            if same_day_threshold:
                serializer = ThresholdSerializer(same_day_threshold, data=data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                return Response(serializer.data)

            # Keep one active threshold per patient + metric + condition.
            if metric_type and condition:
                Threshold.objects.filter(
                    patient_id=patient_id,
                    metric_type=metric_type,
                    condition=condition,
                    is_active=True,
                ).update(is_active=False)

            serializer = ThresholdSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()

        return Response(serializer.data, status=201)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def threshold_detail(request, pk):
    """Get, update, or delete a threshold"""
    try:
        threshold = Threshold.objects.get(pk=pk)
    except Threshold.DoesNotExist:
        return Response({"error": "Threshold not found"}, status=404)
    
    patient_id = request.auth.get("patient_id")
    if patient_id and threshold.patient_id != patient_id:
        return Response({"error": "Not authorized"}, status=403)
    
    if request.method == "GET":
        return Response(ThresholdSerializer(threshold).data)
    
    if request.method == "PUT":
        serializer = ThresholdSerializer(threshold, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    
    if request.method == "DELETE":
        threshold.delete()
        return Response({"message": "Threshold deleted"})


# ============== Alert Endpoints ==============

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def alert_list(request):
    """List alerts"""
    if not _table_exists(Alert._meta.db_table):
        return _schema_outdated_response(Alert._meta.db_table)

    patient_id = request.auth.get("patient_id")
    role = request.auth.get("role")
    # Default: only show alerts for the current day unless caller opts out
    today_only = request.query_params.get("all") not in {"true", "1", "false"} and not request.query_params.get("since")
    # Default: surface the latest alert per metric type to avoid flooding the UI
    latest_per_metric = request.query_params.get("latest_per_metric") not in {"false", "0"}
    
    if patient_id:
        qs = Alert.objects.filter(patient_id=patient_id)
    elif role == "doctor":
        staff_id = request.auth.get("staff_id")
        patient_ids = Patient.objects.filter(doctor_id=staff_id).values_list('id', flat=True)
        qs = Alert.objects.filter(patient_id__in=patient_ids)
    elif role == "admin":
        qs = Alert.objects.all()
    else:
        qs = Alert.objects.none()
    
    # Filter by read status
    is_read = request.query_params.get('is_read')
    if is_read is not None:
        qs = qs.filter(is_read=is_read.lower() == 'true')

    # Restrict to today's alerts unless the client asked for all
    if today_only:
        today = timezone.now().date()
        qs = qs.filter(triggered_at__date=today)
    
    qs = qs.order_by('metric_type', '-triggered_at')

    if latest_per_metric:
        # Postgres distinct on metric_type to keep the latest per type, then re-sort by time desc
        qs = qs.distinct('metric_type')

    alerts = list(qs[:50])
    alerts.sort(key=lambda a: a.triggered_at, reverse=True)

    return Response(AlertSerializer(alerts, many=True).data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def alert_mark_read(request, pk):
    """Mark alert as read"""
    try:
        alert = Alert.objects.get(pk=pk)
    except Alert.DoesNotExist:
        return Response({"error": "Alert not found"}, status=404)
    
    patient_id = request.auth.get("patient_id")
    if patient_id and alert.patient_id != patient_id:
        return Response({"error": "Not authorized"}, status=403)
    
    alert.is_read = True
    alert.save()
    return Response(AlertSerializer(alert).data)


def check_thresholds_and_alert(reading):
    """Check if reading exceeds thresholds and create alert"""
    try:
        device = Device.objects.get(pk=reading.device_id)
        patient_id = device.patient_id
        
        thresholds = Threshold.objects.filter(
            patient_id=patient_id,
            metric_type=reading.metric_type,
            is_active=True
        )
        
        for threshold in thresholds:
            triggered = False
            if threshold.condition == 'above' and reading.value > threshold.value:
                triggered = True
            elif threshold.condition == 'below' and reading.value < threshold.value:
                triggered = True
            elif threshold.condition == 'equal' and reading.value == threshold.value:
                triggered = True
            
            if triggered:
                # Determine severity based on how much threshold is exceeded
                diff_percent = abs(float(reading.value) - float(threshold.value)) / float(threshold.value) * 100
                if diff_percent > 50:
                    severity = 'critical'
                elif diff_percent > 25:
                    severity = 'high'
                elif diff_percent > 10:
                    severity = 'medium'
                else:
                    severity = 'low'
                
                Alert.objects.create(
                    patient_id=patient_id,
                    threshold=threshold,
                    reading=reading,
                    metric_type=reading.metric_type,
                    message=f"{reading.metric_type} reading of {reading.value} is {threshold.condition} threshold of {threshold.value}",
                    severity=severity
                )
    except Exception as e:
        # Log the error but don't fail the reading creation
        print(f"Error checking thresholds: {e}")


# ============== Notification Endpoints ==============

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notification_list(request):
    """List notifications"""
    patient_id = request.auth.get("patient_id")
    staff_id = request.auth.get("staff_id")
    
    if patient_id:
        qs = Notification.objects.filter(patient_id=patient_id)
    elif staff_id:
        qs = Notification.objects.filter(staff_id=staff_id)
    else:
        qs = Notification.objects.none()
    
    qs = qs.order_by('-created_at')[:50]
    return Response(NotificationSerializer(qs, many=True).data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def notification_mark_read(request, pk):
    """Mark notification as read"""
    try:
        notification = Notification.objects.get(pk=pk)
    except Notification.DoesNotExist:
        return Response({"error": "Notification not found"}, status=404)
    
    notification.is_read = True
    notification.save()
    return Response(NotificationSerializer(notification).data)


# ============== Report Endpoints ==============

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def report_list(request):
    """List or generate reports"""
    patient_id = request.auth.get("patient_id")
    role = request.auth.get("role")
    staff_id = request.auth.get("staff_id")
    
    if request.method == "GET":
        if patient_id:
            qs = Report.objects.filter(patient_id=patient_id)
        elif role in ["doctor", "admin"]:
            pid = request.query_params.get('patient_id')
            qs = Report.objects.filter(patient_id=pid) if pid else Report.objects.all()
        else:
            qs = Report.objects.none()
        
        return Response(ReportSerializer(qs, many=True).data)
    
    if request.method == "POST":
        data = request.data.copy()
        
        # Determine patient
        if patient_id:
            data['patient'] = patient_id
        elif 'patient' not in data:
            return Response({"error": "patient_id required"}, status=400)
        
        if staff_id:
            data['generated_by'] = staff_id
        
        serializer = ReportSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save()
        
        return Response(ReportSerializer(report).data, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_generate_pdf(request, pk):
    """Generate PDF for a report"""
    try:
        report = Report.objects.get(pk=pk)
    except Report.DoesNotExist:
        return Response({"error": "Report not found"}, status=404)
    
    patient_id = request.auth.get("patient_id")
    if patient_id and report.patient_id != patient_id:
        return Response({"error": "Not authorized"}, status=403)
    
    # Get patient info
    patient = Patient.objects.get(pk=report.patient_id)
    
    # Get readings for the report period from readings_draft
    draft_rows = ReadingDraft.objects.filter(
        patient_id=report.patient_id,
        recorded_at__date__gte=report.start_date,
        recorded_at__date__lte=report.end_date
    )

    metric_fields = {
        # Heart
        "heart_rate": "heart_rate",
        "heart_hrv_ms": "heart_hrv_ms",
        "heart_rr_interval_ms": "heart_rr_interval_ms",
        # Blood pressure
        "bp_systolic": "bp_systolic",
        "bp_diastolic": "bp_diastolic",
        "bp_mean": "bp_mean",
        "bp_pulse_pressure": "bp_pulse_pressure",
        # Glucose
        "glucose": "glucose",
        "glucose_hba1c": "glucose_hba1c",
        # Steps / activity
        "steps": "steps",
        "daily_steps": "daily_steps",
        "step_distance_km": "step_distance_km",
        "walking_pace": "walking_pace",
        "cadence": "cadence",
        "floors_climbed": "floors_climbed",
        # Calories
        "calories": "total_calories",
        "basal_calories": "basal_calories",
        "metabolic_equivalent": "metabolic_equivalent",
        # Oxygen / respiration / fitness
        "oxygen": "oxygen",
        "oxygen_variability": "oxygen_variability",
        "vo2_max": "vo2_max",
        "respiration_rate": "respiration_rate",
        # Sleep
        "sleep_duration_minutes": "sleep_duration_minutes",
        "sleep_score": "sleep_score",
    }

    flattened = []
    aggregates = {
        key: {
            "total": 0.0,
            "count": 0,
            "max_value": None,
            "min_value": None,
        }
        for key in metric_fields.keys()
    }
    for row in draft_rows:
        for metric_key, field_name in metric_fields.items():
            val = getattr(row, field_name)
            if val is None:
                continue
            val = float(val)
            flattened.append({
                "metric_type": metric_key,
                "value": val,
                "recorded_at": row.recorded_at,
            })

            agg = aggregates[metric_key]
            agg["total"] += val
            agg["count"] += 1
            agg["max_value"] = val if agg["max_value"] is None else max(agg["max_value"], val)
            agg["min_value"] = val if agg["min_value"] is None else min(agg["min_value"], val)

    stats = []
    for metric_key, agg in aggregates.items():
        stats.append({
            "metric_type": metric_key,
            "avg_value": agg["total"] / agg["count"] if agg["count"] else None,
            "max_value": agg["max_value"],
            "min_value": agg["min_value"],
            "count": agg["count"],
        })
    
    # Get alerts during period
    alerts = Alert.objects.filter(
        patient_id=report.patient_id,
        triggered_at__date__gte=report.start_date,
        triggered_at__date__lte=report.end_date
    )
    
    # Build report data
    report_data = {
        "report_id": report.id,
        "title": report.title,
        "report_type": report.report_type,
        "period": {
            "start": str(report.start_date),
            "end": str(report.end_date)
        },
        "patient": {
            "name": f"{patient.first_name} {patient.last_name}",
            "email": patient.email,
            "age": patient.age,
            "gender": patient.gender,
            "bmi": float(patient.bmi) if patient.bmi else None
        },
        "summary": {
            "total_readings": len(flattened),
            "total_alerts": alerts.count(),
            "metrics": list(stats)
        },
        "alerts": AlertSerializer(alerts, many=True).data,
        "generated_at": timezone.now().isoformat()
    }
    
    # In production, you'd generate actual PDF here
    # For now, return JSON that can be converted to PDF on frontend
    return Response(report_data)


# ===========================
# Password Reset / Forgot Password
# ===========================

@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset(request):
    """
    Send OTP to user's email for password reset.
    Expects: {"email": "user@example.com"}
    """
    from django.core.mail import send_mail
    from django.conf import settings as django_settings
    from random import randint
    from .models import PasswordResetOTP
    
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'error': 'Email is required'}, status=400)
    
    # Check if user exists
    user_type = None
    user_exists = False
    
    if Patient.objects.filter(email=email).exists():
        user_type = 'patient'
        user_exists = True
    elif Staff.objects.filter(email=email).exists():
        user_type = 'staff'
        user_exists = True
    
    if not user_exists:
        # Don't reveal if user exists or not for security
        return Response({'message': 'If an account with this email exists, an OTP has been sent.'})
    
    # Generate 6-digit OTP
    otp_code = str(randint(100000, 999999))
    
    # Set expiration (10 minutes)
    expires_at = timezone.now() + timedelta(minutes=10)
    
    # Store OTP
    PasswordResetOTP.objects.create(
        user_type=user_type,
        email=email,
        otp_code=otp_code,
        expires_at=expires_at
    )
    
    # Send email (fail gracefully if email is not configured)
    try:
        send_mail(
            subject='Password Reset OTP - Ethicure',
            message=f'Your password reset OTP is: {otp_code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.',
            from_email=django_settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as e:
        # Log the error but don't fail the request
        # In production, this should be properly configured
        # For development, the OTP is stored in DB and can be retrieved
        print(f"Email sending failed: {str(e)}")
        pass
    
    return Response({'message': 'If an account with this email exists, an OTP has been sent.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    """
    Verify OTP code.
    Expects: {"email": "user@example.com", "otp": "123456"}
    """
    from .models import PasswordResetOTP
    
    email = request.data.get('email', '').strip().lower()
    otp = request.data.get('otp', '').strip()
    
    if not email or not otp:
        return Response({'error': 'Email and OTP are required'}, status=400)
    
    # Find valid OTP
    try:
        otp_record = PasswordResetOTP.objects.filter(
            email=email,
            otp_code=otp,
            is_used=False,
            expires_at__gt=timezone.now()
        ).order_by('-created_at').first()
        
        if not otp_record:
            return Response({'error': 'Invalid or expired OTP'}, status=400)
        
        # Don't mark as used yet - wait until password is actually reset
        return Response({
            'valid': True,
            'message': 'OTP verified successfully'
        })
    except Exception as e:
        return Response({'error': 'Verification failed'}, status=500)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """
    Reset password using verified OTP.
    Expects: {"email": "user@example.com", "otp": "123456", "new_password": "NewPass123!"}
    """
    from .models import PasswordResetOTP
    
    email = request.data.get('email', '').strip().lower()
    otp = request.data.get('otp', '').strip()
    new_password = request.data.get('new_password', '')
    
    if not email or not otp or not new_password:
        return Response({'error': 'Email, OTP, and new password are required'}, status=400)
    
    # Validate password
    if not _password_meets_rules(new_password):
        return Response({
            'error': 'Password must be at least 8 characters and contain uppercase, lowercase, digit, and special character (*()@#?$)'
        }, status=400)
    
    # Verify OTP
    try:
        otp_record = PasswordResetOTP.objects.filter(
            email=email,
            otp_code=otp,
            is_used=False,
            expires_at__gt=timezone.now()
        ).order_by('-created_at').first()
        
        if not otp_record:
            return Response({'error': 'Invalid or expired OTP'}, status=400)
        
        # Update password based on user type
        if otp_record.user_type == 'patient':
            patient = Patient.objects.get(email=email)
            patient.password_hash = make_password(new_password)
            patient.save()
        else:  # staff
            staff = Staff.objects.get(email=email)
            staff.password_hash = make_password(new_password)
            staff.save()
        
        # Mark OTP as used
        otp_record.is_used = True
        otp_record.save()
        
        # Log the password reset
        _record_audit_event(
            request,
            otp_record.user_type,
            None,
            {"event": "password_reset", "email": email}
        )
        
        return Response({'message': 'Password reset successfully'})
    except (Patient.DoesNotExist, Staff.DoesNotExist):
        return Response({'error': 'User not found'}, status=404)
    except Exception as e:
        return Response({'error': 'Password reset failed'}, status=500)

