# Generated manually to clean up orphaned file metadata

from django.db import migrations


def cleanup_orphaned_metadata(apps, schema_editor):
    """
    Remove metadata from outline_content when corresponding file fields are empty.
    This fixes the issue where metadata exists but actual files are missing.
    """
    CourseFolder = apps.get_model('course_folders', 'CourseFolder')
    
    cleaned_count = 0
    total_folders = CourseFolder.objects.count()
    
    print(f"\nCleaning up orphaned metadata in {total_folders} folders...")
    
    for folder in CourseFolder.objects.all():
        outline_content = folder.outline_content or {}
        modified = False
        
        # Check project report
        if 'projectReport' in outline_content and not folder.project_report_file:
            print(f"  - Removing orphaned projectReport metadata from folder {folder.id}")
            del outline_content['projectReport']
            modified = True
        
        # Check course result
        if 'courseResult' in outline_content and not folder.course_result_file:
            print(f"  - Removing orphaned courseResult metadata from folder {folder.id}")
            del outline_content['courseResult']
            modified = True
        
        # Check CLO assessment
        if 'cloAssessment' in outline_content and not folder.clo_assessment_file:
            print(f"  - Removing orphaned cloAssessment metadata from folder {folder.id}")
            del outline_content['cloAssessment']
            modified = True
        
        if modified:
            folder.outline_content = outline_content
            folder.save(update_fields=['outline_content'])
            cleaned_count += 1
    
    print(f"\nCleanup complete! Cleaned {cleaned_count} folders.")


def reverse_cleanup(apps, schema_editor):
    """
    This migration cannot be reversed as we're removing orphaned data.
    """
    print("This migration cannot be reversed. Orphaned metadata has been removed.")


class Migration(migrations.Migration):

    dependencies = [
        ('course_folders', '0012_coursefolder_clo_assessment_file_and_more'),
    ]

    operations = [
        migrations.RunPython(cleanup_orphaned_metadata, reverse_cleanup),
    ]
