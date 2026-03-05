from django.contrib import admin
from .models import Staff, Patient, Device, Reading, Log


@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "role", "is_active", "created_at")
    list_filter = ("role", "is_active")
    search_fields = ("username", "email", "first_name", "last_name")


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "doctor", "created_at")
    list_filter = ("doctor",)
    search_fields = ("username", "email", "first_name", "last_name")


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("id", "device_type", "patient", "is_active", "registered_at")
    list_filter = ("device_type", "is_active")


@admin.register(Reading)
class ReadingAdmin(admin.ModelAdmin):
    list_display = ("id", "device", "value", "recorded_at")
    list_filter = ("device__device_type",)


@admin.register(Log)
class LogAdmin(admin.ModelAdmin):
    list_display = ("id", "actor_type", "actor_id", "action", "timestamp")
    list_filter = ("actor_type",)
