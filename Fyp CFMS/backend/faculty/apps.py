from django.apps import AppConfig


class FacultyConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'faculty'

    def ready(self):  # pragma: no cover
        from . import signals  # noqa: F401
