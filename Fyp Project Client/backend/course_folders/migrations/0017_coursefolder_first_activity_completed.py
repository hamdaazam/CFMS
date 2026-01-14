# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('course_folders', '0016_coursefolder_uploaded_folder_pdf'),
    ]

    operations = [
        migrations.AddField(
            model_name='coursefolder',
            name='first_activity_completed',
            field=models.BooleanField(default=False, help_text='True when first submission cycle (after midterm) is approved by HOD'),
        ),
    ]

