from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allow access only to admin staff"""
    def has_permission(self, request, view):
        if not request.auth:
            return False
        return request.auth.get("role") == "admin"


class IsDoctor(BasePermission):
    """Allow access only to doctor staff"""
    def has_permission(self, request, view):
        if not request.auth:
            return False
        return request.auth.get("role") == "doctor"


class IsPatient(BasePermission):
    """Allow access only to patients"""
    def has_permission(self, request, view):
        if not request.auth:
            return False
        return request.auth.get("patient_id") is not None


class IsAdminOrDoctor(BasePermission):
    """Allow access to admin or doctor staff"""
    def has_permission(self, request, view):
        if not request.auth:
            return False
        role = request.auth.get("role")
        return role in ["admin", "doctor"]


class IsStaff(BasePermission):
    """Allow access to any staff member"""
    def has_permission(self, request, view):
        if not request.auth:
            return False
        return request.auth.get("staff_id") is not None
