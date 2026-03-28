from django.apps import AppConfig
import threading


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

        # Start server-side 2-minute auto-generation for the target patient.
        # This runs independently of browser login state.
        try:
            from core.views import ensure_target_email_autogen_started

            t = threading.Thread(target=ensure_target_email_autogen_started, daemon=True)
            t.start()
        except Exception:
            # Startup bootstrap should not block app initialization.
            pass
