import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(private mailerService: MailerService) {}

  private readonly brandColor = '#4f46e5'; 

  async sendResetCode(email: string, resetCode: string) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `${resetCode} is your password reset code`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937; line-height: 1.6;">
            <div style="text-align: center; padding-bottom: 20px;">
              <h1 style="color: ${this.brandColor}; margin: 0; font-size: 24px;">Password Reset</h1>
            </div>
            
            <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <p style="font-size: 16px; margin-bottom: 24px;">Hello,</p>
              <p style="font-size: 16px; margin-bottom: 24px;">
                We received a request to reset the password for your account. Use the verification code below to proceed:
              </p>
              
              <div style="background-color: #f9fafb; border: 2px dashed #e5e7eb; padding: 20px; text-align: center; margin-bottom: 24px; border-radius: 8px;">
                <span style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #111827;">
                  ${resetCode}
                </span>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; text-align: center; margin-bottom: 32px;">
                This code is valid for <strong>15 minutes</strong>.
              </p>
              
              <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
              
              <p style="font-size: 13px; color: #9ca3af;">
                <strong>Security Note:</strong> If you did not request a password reset, please ignore this email or contact support if you have concerns about your account security.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af;">
              &copy; ${new Date().getFullYear()} Your App Name. All rights reserved.
            </div>
          </div>
        `,
      });
      console.log(`Email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  async sendPasswordChangedConfirmation(email: string) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Security Alert: Your password was changed',
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
            <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 40px;">
              <h2 style="color: #111827; font-size: 20px; margin-top: 0;">Password Successfully Changed</h2>
              <p style="font-size: 16px; color: #4b5563;">
                This is a confirmation that the password for your account <strong>${email}</strong> has been successfully updated.
              </p>
              
              <div style="margin: 32px 0; padding: 16px; background-color: #fff7ed; border-left: 4px solid #f97316; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #9a3412;">
                  <strong>Didn't make this change?</strong><br />
                  If you didn't change your password, please contact our security team immediately to secure your account.
                </p>
              </div>
              
              <p style="font-size: 14px; color: #6b7280;">
                For your security, you may be logged out of other active sessions.
              </p>
            </div>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send confirmation:', error);
    }
  }
}