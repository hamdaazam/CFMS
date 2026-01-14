# Generated migration for adding hod_final_feedback field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('course_folders', '0019_folderdeadline'),
    ]

    operations = [
        migrations.AddField(
            model_name='coursefolder',
            name='hod_final_feedback',
            field=models.TextField(blank=True, help_text='Final feedback for faculty member'),
        ),
    ]

