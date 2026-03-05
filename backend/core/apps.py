from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # import signal handlers to wire patient post_save seeding
        try:
            import core.signals  # noqa: F401
        except Exception:
            # don't let signal import errors break startup
            pass
