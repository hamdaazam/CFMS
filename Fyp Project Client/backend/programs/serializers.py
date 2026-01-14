from rest_framework import serializers
from .models import Program
from departments.serializers import DepartmentSerializer
import re


class ProgramSerializer(serializers.ModelSerializer):
    department_details = DepartmentSerializer(source='department', read_only=True)

    class Meta:
        model = Program
        fields = (
            'id', 'title', 'short_code', 'department', 'department_details',
            'description', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_title(self, value: str):
        """Allow letters, numbers, spaces, dash, underscore and dot; must start alphanumeric."""
        if not value:
            raise serializers.ValidationError("Title is required.")
        pattern = re.compile(r'^[A-Za-z0-9][A-Za-z0-9 _.-]*$')
        if not pattern.match(value):
            raise serializers.ValidationError(
                "Program title can only contain letters, numbers, spaces, dash, underscore and dot (must start with an alphanumeric)."
            )
        # collapse multiple spaces
        return re.sub(r'\s{2,}', ' ', value).strip()

    def validate_short_code(self, value: str):
        if not value:
            raise serializers.ValidationError("Short code is required.")
        pattern = re.compile(r'^[A-Z0-9]{1,12}$')
        if not pattern.match(value):
            raise serializers.ValidationError("Short code must be UPPERCASE alphanumeric (max 12 chars, no spaces).")
        return value
