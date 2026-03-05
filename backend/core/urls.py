from django.urls import path
from .views import (
    # General
    root,
    health_check,
    # Staff
    staff_list,
    staff_detail,
    # Patients
    patient_register,
    check_email_exists,
    patient_list,
    patient_profile,
    patient_change_password,
    patient_check_password,
    patient_login_attempts,
    patient_detail,
    patient_handle_request,
    patient_requests,
    patient_public,
    doctor_patients,
    doctor_request_patient,
    doctor_cancel_request,
    doctor_remove_patient,
    # Devices
    device_list,
    device_detail,
    # Readings
    reading_list,
    reading_live_start,
    reading_stats,
    reading_streaks,
    # Goals
    goal_list,
    goal_detail,
    # Thresholds
    threshold_list,
    threshold_detail,
    # Alerts
    alert_list,
    alert_mark_read,
    # Notifications
    notification_list,
    notification_mark_read,
    # Reports
    report_list,
    report_generate_pdf,
    # AI
    ai_summary,
    ai_chat,
    ai_recommendations,
    # Password Reset
    request_password_reset,
    verify_otp,
    reset_password,
)

urlpatterns = [
    # General
    path("", root),
    path("health/", health_check),
    
    # Staff management (admin only)
    path("staff/", staff_list),
    path("staff/<int:pk>/", staff_detail),
    
    # Patient endpoints
    path("register/", patient_register),  # Public registration
    path("register/check-email/", check_email_exists),
    path("patients/", patient_list),      # Admin: list/create
    path("profile/", patient_profile),    # Patient: own profile
    path("patients/profile/", patient_profile),  # Alias for patient profile (frontend expects this)
    path("patients/password/", patient_change_password),
    path("patients/password/check/", patient_check_password),
    path("patients/login-attempts/", patient_login_attempts),
    path("patients/requests/respond/", patient_handle_request),  # Patient: accept/reject doctor request
    path("patients/requests/", patient_requests),  # Patient: list doctor requests
    path("patients/<int:pk>/", patient_detail),  # Admin/Doctor: view patient
    path("patients/public/<int:pk>/", patient_public),  # Public minimal patient info (bmi)
    path("doctor/patients/", doctor_patients),   # Doctor: own patients
    path("doctor/patients/request/", doctor_request_patient),  # Doctor: request/claim patient
    path("doctor/patients/request/cancel/", doctor_cancel_request),  # Doctor: cancel pending request
    path("doctor/patients/remove/", doctor_remove_patient),  # Doctor: unassign/remove patient
    
    # Device endpoints
    path("devices/", device_list),
    path("devices/<int:pk>/", device_detail),
    
    # Reading endpoints
    path("readings/", reading_list),
    path("readings/live/start/", reading_live_start),
    path("readings/stats/", reading_stats),
    path("readings/streaks/", reading_streaks),
    
    # Goal endpoints
    path("goals/", goal_list),
    path("goals/<int:pk>/", goal_detail),
    
    # Threshold endpoints
    path("thresholds/", threshold_list),
    path("thresholds/<int:pk>/", threshold_detail),
    
    # Alert endpoints
    path("alerts/", alert_list),
    path("alerts/<int:pk>/read/", alert_mark_read),
    
    # Notification endpoints
    path("notifications/", notification_list),
    path("notifications/<int:pk>/read/", notification_mark_read),
    
    # Report endpoints
    path("reports/", report_list),
    path("reports/<int:pk>/pdf/", report_generate_pdf),

    # AI-powered recommendations
    path("ai/chat/", ai_chat),
    path("ai/summary/<int:user_id>/", ai_summary),
    path("recommendations/", ai_recommendations),
    
    # Password Reset (Forgot Password)
    path("password-reset/request/", request_password_reset),
    path("password-reset/verify/", verify_otp),
    path("password-reset/reset/", reset_password),
]
