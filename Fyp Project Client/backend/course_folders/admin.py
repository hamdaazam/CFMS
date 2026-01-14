from django.contrib import admin
from .models import (
    CourseFolder, FolderComponent, Assessment, CourseLogEntry,
    AuditAssignment, FolderStatusHistory, Notification, FolderAccessRequest,
    FolderDeadline
)


@admin.register(CourseFolder)
class CourseFolderAdmin(admin.ModelAdmin):
    list_display = ['course', 'section', 'term', 'faculty', 'status', 'is_complete', 'created_at']
    list_filter = ['status', 'is_complete', 'term', 'department']
    search_fields = ['course__code', 'course__title', 'section', 'faculty__user__full_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(FolderComponent)
class FolderComponentAdmin(admin.ModelAdmin):
    list_display = ['folder', 'component_type', 'title', 'file_size', 'created_at']
    list_filter = ['component_type']
    search_fields = ['folder__course__code', 'title']


@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = ['folder', 'assessment_type', 'title', 'number', 'max_marks', 'weightage']
    list_filter = ['assessment_type']
    search_fields = ['folder__course__code', 'title']


@admin.register(CourseLogEntry)
class CourseLogEntryAdmin(admin.ModelAdmin):
    list_display = ['folder', 'lecture_number', 'date', 'duration', 'topics_covered']
    list_filter = ['date']
    search_fields = ['folder__course__code', 'topics_covered']


@admin.register(AuditAssignment)
class AuditAssignmentAdmin(admin.ModelAdmin):
    list_display = ['folder', 'auditor', 'assigned_by', 'feedback_submitted', 'assigned_at']
    list_filter = ['feedback_submitted']
    search_fields = ['folder__course__code', 'auditor__full_name']


@admin.register(FolderStatusHistory)
class FolderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ['folder', 'status', 'changed_by', 'created_at']
    list_filter = ['status']
    search_fields = ['folder__course__code']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'notification_type', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read']
    search_fields = ['user__full_name', 'title', 'message']


@admin.register(FolderAccessRequest)
class FolderAccessRequestAdmin(admin.ModelAdmin):
    list_display = ['folder', 'requested_by', 'status', 'requested_at', 'approved_by', 'approved_at']
    list_filter = ['status', 'requested_at']
    search_fields = ['folder__course__code', 'requested_by__full_name']


@admin.register(FolderDeadline)
class FolderDeadlineAdmin(admin.ModelAdmin):
    list_display = ['deadline_type', 'term', 'department', 'deadline_date', 'set_by', 'is_passed', 'created_at']
    list_filter = ['deadline_type', 'department', 'deadline_date']
    search_fields = ['term__session_term', 'department__name', 'set_by__full_name']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'deadline_date'
    
    def is_passed(self, obj):
        return obj.is_passed()
    is_passed.boolean = True
    is_passed.short_description = 'Deadline Passed'

