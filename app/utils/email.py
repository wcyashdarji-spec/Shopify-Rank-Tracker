import os
import smtplib
from email.mime.text import MIMEText
from app.core.logger import get_logger
from email.mime.multipart import MIMEMultipart

logger = get_logger(__name__)

def send_invitation_email(to_email: str, app_name: str, inviter_email: str):
    """
    Send a collaboration invitation email using the configured SMTP server.

    This function composes an HTML email containing the application
    details and instructions for accepting the invitation. SMTP
    configuration is loaded from environment variables, and the email
    is sent securely using TLS. If the required SMTP credentials are
    not configured, the email is skipped gracefully.

    Args:
        to_email: Recipient's email address.
        app_name: Name of the application being shared.
        inviter_email: Email address of the user sending the invitation.

    Returns:
        bool:
            - True if the email was sent successfully.
            - False if SMTP is not configured or an error occurs while
              sending the email.
    """
    host = os.getenv("SMTP_HOST")
    port = os.getenv("SMTP_PORT", "587")
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM", username)

    if not all([host, port, username, password]):
        logger.warning("SMTP credentials are not fully configured in .env. Skipping email.")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = sender
        msg["To"] = to_email
        msg["Subject"] = f"Invitation to collaborate on '{app_name}'"

        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2>Collaboration Invite</h2>
                <p>Hello,</p>
                <p><strong>{inviter_email}</strong> has invited you to collaborate on their application <strong>{app_name}</strong> on Shopify Rank Tracker.</p>
                <p>To accept or decline the invitation:</p>
                <ol>
                    <li>Log into your Rank Tracker account (or register if you don't have one).</li>
                    <li>Go to your <strong>Profile Settings</strong> page.</li>
                    <li>Find the invitation under the <strong>"Pending Collaborator Invitations"</strong> section.</li>
                </ol>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 11px; color: #999;">This is an automated message, please do not reply directly.</p>
            </body>
        </html>
        """
        msg.attach(MIMEText(body, "html"))

        with smtplib.SMTP(host, int(port)) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(msg)

        logger.info(f"Successfully sent invitation email to {to_email}")
        return True

    except Exception as e:
        logger.exception(f"Failed to send email to {to_email}: {str(e)}")
        return False
