from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from django.db.models import Q
from django.contrib.auth.hashers import check_password
from .models import Staff, Patient, Device, Reading, Goal, Threshold, Alert, Notification, Report, DoctorPatientRequest


GOAL_REALISTIC_RANGES = {
    "heart_rate": (40, 220),
    "glucose": (50, 400),
    "steps": (1000, 50000),
    "calories": (500, 8000),
    "oxygen": (80, 100),
    "weight": (30, 300),
}

THRESHOLD_REALISTIC_RANGES = {
    "heart_rate": (30, 220),
    "glucose": (50, 400),
    "steps": (0, 100000),
    "calories": (0, 12000),
    "oxygen": (80, 100),
    "weight": (20, 400),
    "bmi": (10, 80),
}


class StaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Staff
        exclude = ['password_hash']
        read_only_fields = ['id', 'created_at']


class StaffCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = Staff
        fields = ['first_name', 'last_name', 'email', 'username', 'password', 'role']

    def validate_email(self, value):
        email = value.strip()
        if Patient.objects.filter(Q(email__iexact=email) | Q(username__iexact=email)).exists():
            raise serializers.ValidationError('Email already exists for a patient')
        return email
    
    def create(self, validated_data):
        from django.contrib.auth.hashers import make_password
        password = validated_data.pop('password')
        validated_data['password_hash'] = make_password(password)
        return Staff.objects.create(**validated_data)


class PatientSerializer(serializers.ModelSerializer):
    request_status = serializers.SerializerMethodField()
    request_created_at = serializers.SerializerMethodField()
    request_updated_at = serializers.SerializerMethodField()
    request_doctor_id = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        exclude = ['password_hash']
        read_only_fields = ['id', 'created_at', 'bmi']

    def get_request_status(self, obj):
        # Prefer annotated value when provided by the queryset to avoid an extra query per row
        if hasattr(obj, "request_status") and obj.request_status is not None:
            try:
                return str(obj.request_status).lower()
            except Exception:
                return obj.request_status

        request = self.context.get('request') if hasattr(self, 'context') else None
        if not request or not getattr(request, 'auth', None):
            return None
        doctor_id = request.auth.get('staff_id') if isinstance(request.auth, dict) else None
        if not doctor_id:
            return None

        req = DoctorPatientRequest.objects.filter(patient_id=obj.id, doctor_id=doctor_id).order_by('-created_at').first()
        if not req:
            return None
        status_val = req.status
        try:
            return str(status_val).lower()
        except Exception:
            return status_val

    def _latest_request(self, obj, doctor_id):
        return DoctorPatientRequest.objects.filter(patient_id=obj.id, doctor_id=doctor_id).order_by('-created_at').first()

    def get_request_created_at(self, obj):
        # Prefer annotated value
        if hasattr(obj, "request_created_at"):
            return obj.request_created_at

        request = self.context.get('request') if hasattr(self, 'context') else None
        doctor_id = request.auth.get('staff_id') if request and getattr(request, 'auth', None) else None
        if not doctor_id:
            return None

        req = self._latest_request(obj, doctor_id)
        return req.created_at if req else None

    def get_request_updated_at(self, obj):
        if hasattr(obj, "request_updated_at"):
            return obj.request_updated_at

        request = self.context.get('request') if hasattr(self, 'context') else None
        doctor_id = request.auth.get('staff_id') if request and getattr(request, 'auth', None) else None
        if not doctor_id:
            return None

        req = self._latest_request(obj, doctor_id)
        return req.updated_at if req else None

    def get_request_doctor_id(self, obj):
        if hasattr(obj, "request_doctor_id"):
            return obj.request_doctor_id

        request = self.context.get('request') if hasattr(self, 'context') else None
        doctor_id = request.auth.get('staff_id') if request and getattr(request, 'auth', None) else None
        if not doctor_id:
            return obj.doctor_id

        req = self._latest_request(obj, doctor_id)
        return req.doctor_id if req else obj.doctor_id


class DoctorPatientRequestSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    doctor_email = serializers.SerializerMethodField()

    class Meta:
        model = DoctorPatientRequest
        fields = ["id", "patient", "doctor", "status", "created_at", "updated_at", "doctor_name", "doctor_email"]

    def get_doctor_name(self, obj):
        if getattr(obj, "doctor", None):
            return f"{obj.doctor.first_name} {obj.doctor.last_name}".strip()
        return None

    def get_doctor_email(self, obj):
        if getattr(obj, "doctor", None):
            return obj.doctor.email
        return None


class PatientCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = Patient
        fields = ['first_name', 'last_name', 'email', 'username', 'password', 
                  'gender', 'date_of_birth', 'height', 'weight']

    def validate_email(self, value):
        email = value.strip()
        if Staff.objects.filter(Q(email__iexact=email) | Q(username__iexact=email)).exists():
            raise serializers.ValidationError('Email already exists for a staff member')
        return email
    
    def create(self, validated_data):
        from django.contrib.auth.hashers import make_password

        password = validated_data.pop('password')
        email = validated_data['email']

        # Keep provided username; default to email if not present
        validated_data['username'] = validated_data.get('username') or email
        validated_data['password_hash'] = make_password(password)
        
        # Calculate BMI if height and weight provided
        height = validated_data.get('height')
        weight = validated_data.get('weight')
        if height and weight and height > 0:
            height_m = float(height) / 100  # assuming height in cm
            validated_data['bmi'] = round(float(weight) / (height_m ** 2), 2)
        
        patient = Patient.objects.create(**validated_data)

        # Auto-provision default devices for the patient
        from .models import Device
        for dtype in ['heart', 'glucose', 'steps', 'oxygen']:
            Device.objects.create(patient=patient, device_type=dtype, is_active=True)

        return patient


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = [
            'id', 'patient', 'device_type', 'label', 'brand', 'status', 'last_synced', 'is_active', 'registered_at'
        ]
        read_only_fields = ['id', 'registered_at']
        validators = [
            UniqueTogetherValidator(
                queryset=Device.objects.all(),
                fields=['patient', 'device_type'],
                message='Device type already exists for this patient'
            )
        ]


class ReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reading
        fields = "__all__"
        read_only_fields = ['id', 'recorded_at']


class GoalSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)

        metric_type = attrs.get('metric_type') or getattr(self.instance, 'metric_type', None)
        target_value = attrs.get('target_value')
        if target_value is None and self.instance is not None:
            target_value = getattr(self.instance, 'target_value', None)

        if metric_type in GOAL_REALISTIC_RANGES and target_value is not None:
            min_value, max_value = GOAL_REALISTIC_RANGES[metric_type]
            if target_value < min_value or target_value > max_value:
                raise serializers.ValidationError({
                    'target_value': (
                        f"Unrealistic goal for {metric_type}. "
                        f"Expected between {min_value} and {max_value}."
                    )
                })

        return attrs

    class Meta:
        model = Goal
        fields = "__all__"
        read_only_fields = ['id', 'created_at']


class ThresholdSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)

        patient = attrs.get('patient') or getattr(self.instance, 'patient', None)
        metric_type = attrs.get('metric_type') or getattr(self.instance, 'metric_type', None)
        condition = attrs.get('condition') or getattr(self.instance, 'condition', None)
        value = attrs.get('value')
        if value is None and self.instance is not None:
            value = getattr(self.instance, 'value', None)

        if metric_type in THRESHOLD_REALISTIC_RANGES and value is not None:
            min_value, max_value = THRESHOLD_REALISTIC_RANGES[metric_type]
            if value < min_value or value > max_value:
                raise serializers.ValidationError({
                    'value': (
                        f"Unrealistic threshold for {metric_type}. "
                        f"Expected between {min_value} and {max_value}."
                    )
                })

        # Guard against inverted low/high pairs for core vitals.
        if (
            patient is not None
            and metric_type in {'heart_rate', 'glucose'}
            and condition in {'above', 'below'}
            and value is not None
        ):
            opposite_condition = 'above' if condition == 'below' else 'below'
            existing_qs = Threshold.objects.filter(
                patient=patient,
                metric_type=metric_type,
                condition=opposite_condition,
                is_active=True,
            ).order_by('-created_at', '-id')
            if self.instance is not None:
                existing_qs = existing_qs.exclude(pk=self.instance.pk)

            opposite_threshold = existing_qs.first()
            if opposite_threshold is not None:
                opposite_value = opposite_threshold.value
                if condition == 'below' and value >= opposite_value:
                    raise serializers.ValidationError({
                        'value': f"Low threshold must be lower than active high threshold ({opposite_value})."
                    })
                if condition == 'above' and value <= opposite_value:
                    raise serializers.ValidationError({
                        'value': f"High threshold must be higher than active low threshold ({opposite_value})."
                    })

        return attrs

    class Meta:
        model = Threshold
        fields = "__all__"
        read_only_fields = ['id', 'created_at']


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = "__all__"
        read_only_fields = ['id', 'triggered_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = ['id', 'created_at']


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = "__all__"
        read_only_fields = ['id', 'created_at']


class CustomTokenObtainPairSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    default_error_messages = {
        "invalid_credentials": "Invalid credentials",
        "inactive": "User is inactive",
    }

    def validate(self, attrs):
        identity = attrs.get("username")
        password = attrs.get("password")

        staff = Staff.objects.filter(Q(username=identity) | Q(email=identity)).first()
        if not staff:
            self.fail("invalid_credentials")

        if not staff.is_active:
            self.fail("inactive")

        if not check_password(password, staff.password_hash):
            self.fail("invalid_credentials")

        refresh = RefreshToken()
        refresh["staff_id"] = staff.id
        refresh["role"] = staff.role
        refresh["username"] = staff.username

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "staff_id": staff.id,
            "role": staff.role,
            "username": staff.username,
        }


class PatientTokenSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        # Allow login with either username or email to match registration behavior
        identity = (username or "").strip()
        patient = Patient.objects.filter(Q(username__iexact=identity) | Q(email__iexact=identity)).first()
        if not patient:
            raise serializers.ValidationError('Invalid credentials')

        # Support normal hashed passwords and legacy plain-text rows
        if not check_password(password, patient.password_hash) and password != patient.password_hash:
            raise serializers.ValidationError('Invalid credentials')
        
        # Generate tokens manually
        refresh = RefreshToken()
        refresh['patient_id'] = patient.id
        refresh['role'] = 'patient'
        refresh['username'] = patient.username
        
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'patient_id': patient.id,
            'username': patient.username,
        }
