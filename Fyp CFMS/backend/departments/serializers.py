from rest_framework import serializers
from .models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    # Sanitized fields; custom validation ensures no special characters
    class Meta:
        model = Department
        fields = ('id', 'name', 'short_code', 'description', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_name(self, value: str):
        """Allow only letters, numbers, spaces and -_. Limit consecutive spaces."""
        import re
        if not value:
            raise serializers.ValidationError("Name is required.")
        pattern = re.compile(r'^[A-Za-z0-9][A-Za-z0-9 _.-]*$')
        if not pattern.match(value):
            raise serializers.ValidationError("Department name can only contain letters, numbers, spaces, dash, underscore and dot (must start with an alphanumeric).")
        cleaned = re.sub(r'\s{2,}', ' ', value).strip()
        return cleaned

    def validate_short_code(self, value: str):
        import re
        if not value:
            raise serializers.ValidationError("Short code is required.")
        pattern = re.compile(r'^[A-Z0-9]{1,10}$')
        if not pattern.match(value):
            raise serializers.ValidationError("Short code must be UPPERCASE alphanumeric (max 10 chars, no spaces).")
        return value
