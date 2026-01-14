from rest_framework import serializers
from .models import Term
from django.utils import timezone
import re


class TermSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)
    days_until_expiry = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Term
        fields = ('id', 'session_term', 'start_date', 'end_date', 'is_active', 
                  'is_expired', 'days_until_expiry', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at', 'is_expired', 'days_until_expiry')

    def validate_session_term(self, value: str):
        """Allow letters, numbers, spaces, dash, underscore and dot; must start alphanumeric."""
        if not value:
            raise serializers.ValidationError("Session term is required.")
        pattern = re.compile(r'^[A-Za-z0-9][A-Za-z0-9 _.-]*$')
        if not pattern.match(value):
            raise serializers.ValidationError(
                "Session term can only contain letters, numbers, spaces, dash, underscore and dot (must start with an alphanumeric)."
            )
        # collapse multiple spaces and trim
        return re.sub(r'\s{2,}', ' ', value).strip()

    def validate(self, attrs):
        start = attrs.get('start_date')
        end = attrs.get('end_date')
        is_active = attrs.get('is_active', False)
        
        # Validate date order
        if start and end and start >= end:
            raise serializers.ValidationError("End date must be after start date.")

        # Enforce minimum term length of 90 days
        if start and end:
            delta = (end - start).days
            if delta < 90:
                raise serializers.ValidationError("Term duration must be at least 90 days.")
        
        # Prevent activating terms with past end dates
        if is_active and end:
            today = timezone.now().date()
            if end < today:
                raise serializers.ValidationError({
                    'is_active': 'Cannot activate a term whose end date has already passed.'
                })
        
        return attrs
