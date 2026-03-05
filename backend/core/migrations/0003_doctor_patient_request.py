from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_alert_goal_notification_readingdraft_report_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='DoctorPatientRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('doctor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='patient_requests', to='core.staff', db_column='doctor_id')),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='doctor_requests', to='core.patient', db_column='patient_id')),
            ],
            options={
                'db_table': 'doctor_patient_requests',
            },
        ),
    ]
