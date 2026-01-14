from django.db import migrations
from django.db.models import Count


def dedupe_course_allocations(apps, schema_editor):
    CourseAllocation = apps.get_model('courses', 'CourseAllocation')

    # Find duplicate allocations grouped by course, faculty, section, term
    duplicates = (
        CourseAllocation.objects
        .values('course_id', 'faculty_id', 'section', 'term_id')
        .annotate(count=Count('id'))
        .filter(count__gt=1)
    )

    for dup in duplicates:
        # Obtain records for group ordered by creation time, keep earliest
        group_qs = CourseAllocation.objects.filter(
            course_id=dup['course_id'],
            faculty_id=dup['faculty_id'],
            section=dup['section'],
            term_id=dup['term_id']
        ).order_by('created_at')

        # Keep first, delete the rest
        keep = group_qs.first()
        to_delete = group_qs.exclude(id=keep.id)
        to_delete.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0004_coursecoordinatorassignment'),
    ]

    operations = [
        migrations.RunPython(dedupe_course_allocations, reverse_code=migrations.RunPython.noop),
        migrations.AlterUniqueTogether(
            name='courseallocation',
            unique_together={('course', 'faculty', 'section', 'term')},
        ),
    ]
