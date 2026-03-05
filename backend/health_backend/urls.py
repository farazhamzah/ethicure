from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from core.views import StaffTokenObtainView, PatientTokenObtainPairView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),

    # JWT AUTH - Staff login
    path("api/token/", StaffTokenObtainView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    
    # JWT AUTH - Patient login
    path("api/patient/token/", PatientTokenObtainPairView.as_view(), name="patient_token_obtain"),
]

