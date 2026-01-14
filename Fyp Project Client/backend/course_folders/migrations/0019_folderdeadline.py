# Generated manually

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('course_folders', '0018_folderaccessrequest'),
        ('terms', '0001_initial'),
        ('departments', '0001_initial'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='FolderDeadline',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('deadline_type', models.CharField(choices=[('FIRST_SUBMISSION', 'First Submission (After Midterm)'), ('FINAL_SUBMISSION', 'Final Submission (After Final Term)')], max_length=30)),
                ('deadline_date', models.DateTimeField(help_text='Deadline date and time for submission')),
                ('notes', models.TextField(blank=True, help_text='Additional notes about the deadline')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('department', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='folder_deadlines', to='departments.department')),
                ('set_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='set_deadlines', to='users.user')),
                ('term', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='folder_deadlines', to='terms.term')),
            ],
            options={
                'verbose_name': 'Folder Deadline',
                'verbose_name_plural': 'Folder Deadlines',
                'db_table': 'folder_deadlines',
                'ordering': ['-deadline_date'],
                'unique_together': {('deadline_type', 'term', 'department')},
            },
        ),
        migrations.AddIndex(
            model_name='folderdeadline',
            index=models.Index(fields=['deadline_type', 'term', 'department'], name='course_fold_deadlin_idx'),
        ),
        migrations.AddIndex(
            model_name='folderdeadline',
            index=models.Index(fields=['deadline_date'], name='course_fold_deadlin_date_idx'),
        ),
    ]

