from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from core.models import Staff


def custom_jwt_payload(user):
    try:
        staff = Staff.objects.get(username=user.username)
        return {
            "staff_id": staff.id,
            "role": staff.role,
        }
    except Staff.DoesNotExist:
        return {
            "staff_id": None,
            "role": None,
        }


class CustomUser:
    """A simple user-like object for JWT authentication"""
    def __init__(self, user_type, user_id, username, role):
        self.user_type = user_type
        self.id = user_id
        self.username = username
        self.role = role
        self.is_authenticated = True
        self.is_active = True


class CustomJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication that supports both staff and patient tokens.
    """
    
    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None
        
        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None
        
        try:
            validated_token = self.get_validated_token(raw_token)
        except InvalidToken:
            # Let DRF return 401 for invalid tokens instead of treating callers as admin.
            raise
        
        # Check if it's a patient token
        patient_id = validated_token.get('patient_id')
        if patient_id:
            user = CustomUser(
                user_type='patient',
                user_id=patient_id,
                username=validated_token.get('username'),
                role='patient'
            )
            return (user, validated_token)
        
        # Check if it's a staff token
        staff_id = validated_token.get('staff_id')
        if staff_id:
            user = CustomUser(
                user_type='staff',
                user_id=staff_id,
                username=validated_token.get('username', ''),
                role=validated_token.get('role')
            )
            return (user, validated_token)
        
        # Fall back to default user lookup
        return super().authenticate(request)
