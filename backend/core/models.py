from django.db import models

# Create your models here.
from django.db import models

class Staff(models.Model):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('doctor', 'Doctor'),
    )

    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=50, unique=True)
    password_hash = models.TextField()
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'staff'


class Patient(models.Model):
    doctor = models.ForeignKey(
        Staff,
        on_delete=models.SET_NULL,
        null=True,
        db_column='doctor_id'
    )

    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    gender = models.CharField(max_length=10, null=True)
    date_of_birth = models.DateField(null=True)
    age = models.IntegerField(null=True)
    height = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    weight = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    bmi = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=50, unique=True)
    password_hash = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'patients'


class DoctorPatientRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    )

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, db_column='patient_id', related_name='doctor_requests')
    doctor = models.ForeignKey(Staff, on_delete=models.CASCADE, db_column='doctor_id', related_name='patient_requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'doctor_patient_requests'


class Device(models.Model):
    DEVICE_TYPES = (
        ('heart', 'Heart'),
        ('blood_pressure', 'Blood Pressure'),
        ('glucose', 'Glucose'),
        ('steps', 'Step Count'),
        ('calories', 'Calories'),
        ('oxygen', 'Oxygen'),
        ('sleep', 'Sleep'),
        ('smart_watch', 'Smart Watch'),
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        db_column='patient_id'
    )
    device_type = models.CharField(max_length=20, choices=DEVICE_TYPES)
    label = models.CharField(max_length=64, blank=True, help_text="Short label for the device")
    brand = models.CharField(max_length=64, blank=True, help_text="Brand or model of the device")
    status = models.CharField(max_length=16, choices=[('online','Online'),('syncing','Syncing'),('offline','Offline')], default='offline')
    last_synced = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    registered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'devices'


class Reading(models.Model):
    device = models.ForeignKey(
        Device,
        on_delete=models.CASCADE,
        db_column='device_id'
    )
    metric_type = models.CharField(max_length=20)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'readings'


class ReadingDraft(models.Model):
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        db_column='patient_id'
    )

    # Heart
    heart_device_id = models.IntegerField(null=True, blank=True)
    heart_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    heart_ecg = models.JSONField(null=True, blank=True)
    heart_afib = models.BooleanField(null=True, blank=True)
    heart_hrv_ms = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    heart_rr_interval_ms = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Blood pressure
    bp_device_id = models.IntegerField(null=True, blank=True)
    bp_systolic = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    bp_diastolic = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    bp_mean = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    bp_pulse_pressure = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    bp_irregular = models.BooleanField(null=True, blank=True)
    bp_body_position = models.CharField(max_length=50, null=True, blank=True)

    # Glucose
    glucose_device_id = models.IntegerField(null=True, blank=True)
    glucose = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    glucose_trend = models.CharField(max_length=50, null=True, blank=True)
    glucose_hba1c = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    glucose_fasting = models.BooleanField(null=True, blank=True)

    # Calories / activity
    calories_device_id = models.IntegerField(null=True, blank=True)
    calories = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    basal_calories = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_calories = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    metabolic_equivalent = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Steps / activity
    steps_device_id = models.IntegerField(null=True, blank=True)
    steps = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    daily_steps = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    step_distance_km = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    walking_pace = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cadence = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    floors_climbed = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Oxygen / respiration / sleep
    oxygen_device_id = models.IntegerField(null=True, blank=True)
    oxygen = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    vo2_max = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    respiration_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    oxygen_variability = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    sleep_stage = models.CharField(max_length=50, null=True, blank=True)
    sleep_duration_minutes = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    sleep_score = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Temperature
    body_temperature = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    skin_temperature = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    recorded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'readings_draft'


class Log(models.Model):
    ACTOR_TYPES = (
        ('staff', 'Staff'),
        ('patient', 'Patient'),
    )

    actor_type = models.CharField(max_length=10, choices=ACTOR_TYPES)
    actor_id = models.IntegerField()
    action = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'logs'


class Goal(models.Model):
    METRIC_TYPES = (
        ('heart_rate', 'Heart Rate'),
        ('glucose', 'Glucose'),
        ('steps', 'Steps'),
        ('calories', 'Calories'),
        ('oxygen', 'Oxygen'),
        ('weight', 'Weight'),
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        db_column='patient_id',
        related_name='goals'
    )
    metric_type = models.CharField(max_length=20, choices=METRIC_TYPES)
    target_value = models.DecimalField(max_digits=10, decimal_places=2)
    current_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'goals'


class Threshold(models.Model):
    METRIC_TYPES = (
        ('heart_rate', 'Heart Rate'),
        ('glucose', 'Glucose'),
        ('steps', 'Steps'),
        ('calories', 'Calories'),
        ('oxygen', 'Oxygen'),
        ('weight', 'Weight'),
        ('bmi', 'BMI'),
    )
    
    CONDITION_CHOICES = (
        ('above', 'Above'),
        ('below', 'Below'),
        ('equal', 'Equal'),
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        db_column='patient_id',
        related_name='thresholds'
    )
    metric_type = models.CharField(max_length=20, choices=METRIC_TYPES)
    condition = models.CharField(max_length=10, choices=CONDITION_CHOICES)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'thresholds'


class Alert(models.Model):
    SEVERITY_CHOICES = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        db_column='patient_id',
        related_name='alerts'
    )
    threshold = models.ForeignKey(
        Threshold,
        on_delete=models.SET_NULL,
        null=True,
        db_column='threshold_id'
    )
    reading = models.ForeignKey(
        Reading,
        on_delete=models.SET_NULL,
        null=True,
        db_column='reading_id'
    )
    metric_type = models.CharField(max_length=20)
    message = models.TextField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='medium')
    is_read = models.BooleanField(default=False)
    triggered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'alerts'


class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('alert', 'Alert'),
        ('reminder', 'Reminder'),
        ('info', 'Info'),
        ('report', 'Report'),
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        db_column='patient_id',
        related_name='notifications',
        null=True,
        blank=True
    )
    staff = models.ForeignKey(
        Staff,
        on_delete=models.CASCADE,
        db_column='staff_id',
        related_name='notifications',
        null=True,
        blank=True
    )
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'notifications'


class Report(models.Model):
    REPORT_TYPES = (
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('custom', 'Custom'),
    )

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        db_column='patient_id',
        related_name='reports'
    )
    generated_by = models.ForeignKey(
        Staff,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='generated_by_id'
    )
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    title = models.CharField(max_length=200)
    start_date = models.DateField()
    end_date = models.DateField()
    file_path = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'reports'


class PasswordResetOTP(models.Model):
    USER_TYPES = (
        ('patient', 'Patient'),
        ('staff', 'Staff'),
    )

    user_type = models.CharField(max_length=10, choices=USER_TYPES)
    email = models.EmailField()
    otp_code = models.CharField(max_length=6)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'password_reset_otp'
