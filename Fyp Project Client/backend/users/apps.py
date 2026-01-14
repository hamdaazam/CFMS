from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        # Import signals so they are registered when the app is ready
        try:
            import users.signals  # noqa: F401
        except Exception:
            pass
