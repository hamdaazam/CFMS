from django.db import migrations, models
from django.core.validators import FileExtensionValidator


class Migration(migrations.Migration):

    dependencies = [
        ('course_folders', '0015_coursefolder_folder_review_report_file'),
    ]

    operations = [
        migrations.AddField(
            model_name='coursefolder',
            name='uploaded_folder_pdf',
            field=models.FileField(
                blank=True,
                max_length=500,
                null=True,
                upload_to='uploaded_folder_pdfs/',
                validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
            ),
        ),
        migrations.AddField(
            model_name='coursefolder',
            name='uploaded_folder_pdf_checked_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='coursefolder',
            name='uploaded_folder_pdf_validation',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]


