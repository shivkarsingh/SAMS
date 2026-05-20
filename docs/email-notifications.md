# Email Notifications

SAMS sends email through SMTP using `nodemailer`. For local development, email is disabled by default and OTPs are returned in API responses as `devOtp`.

## Backend Environment

Add these values to `backend/.env`:

```env
EMAIL_ENABLED=true
EMAIL_FROM="SAMS Notifications <your-address@example.com>"
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your-address@example.com
EMAIL_PASSWORD=your-app-password
EMAIL_RETRY_COUNT=2
EMAIL_RETRY_DELAY_MS=2000
EMAIL_QUEUE_CONCURRENCY=3
EMAIL_CONNECTION_TIMEOUT_MS=30000
EMAIL_TEST_RECIPIENT=your-test-recipient@example.com
EMAIL_TEST_KEY=change-this-test-key
EMAIL_OTP_EXPIRES_MINUTES=10
EMAIL_EXPOSE_OTP_IN_RESPONSE=false
```

Gmail requires an app password, not the normal account password. Free SMTP sandboxes such as Mailtrap or Brevo can also be used by changing `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, and `EMAIL_PASSWORD`.

## Operational Checks

- `GET /api/v1/email/status` returns safe mailer status without exposing credentials.
- `POST /api/v1/email/verify` forces an SMTP connection check.
- `POST /api/v1/email/test` sends a protected test email. Send JSON like:

```json
{
  "testKey": "change-this-test-key",
  "to": "your-test-recipient@example.com"
}
```

The backend also verifies SMTP on startup, queues email work with limited concurrency, retries transient failures, and writes delivery logs to MongoDB.

## Notification Events

- Signup email verification OTP
- Welcome email after verification
- Password reset OTP
- Profile email update OTP
- Leave approval or rejection
- Exam attendance warnings
- Absent notifications to student and optional parent email
- Class cancellation bulk notice
