import { Section, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout from './layout';
import EmailButton from './components/Button';
import PasswordResetFooter from './components/PasswordResetFooter';

interface ResetPasswordEmailProps {
  resetUrl: string;
  supportEmail: string;
}

export default function ResetPasswordEmail({ resetUrl, supportEmail }: ResetPasswordEmailProps) {
  return (
    <EmailLayout
      preview="Reset your APEXSTORAGE password"
      supportEmail={supportEmail}
      headerSubtitle="SECURE ACCOUNT"
      headerDividerInset={80}
      footer={<PasswordResetFooter supportEmail={supportEmail} />}
    >
      <Section style={{ padding: '8px 40px 0' }}>
        <Text
          style={{
            margin: 0,
            fontSize: '26px',
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '0.5px',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          Reset Your Password
        </Text>
        <Text
          style={{
            margin: '18px 0 0',
            fontSize: '14px',
            lineHeight: '24px',
            color: '#D8D8D8',
          }}
        >
          We received a request to reset the password for your APEXSTORAGE account.
        </Text>
        <Text
          style={{
            margin: '10px 0 0',
            fontSize: '14px',
            lineHeight: '24px',
            color: '#D8D8D8',
          }}
        >
          If you requested this change, click the button below. If you did not request a password
          reset, simply ignore this email.
        </Text>
      </Section>

      <EmailButton href={resetUrl}>Reset Password</EmailButton>

      <Section style={{ padding: '0 40px' }}>
        <Text
          style={{
            margin: '18px 0 0',
            fontSize: '11px',
            lineHeight: '18px',
            color: '#8A8A8E',
            textAlign: 'center' as const,
          }}
        >
          This password link expires in 1 hour.
        </Text>
      </Section>
    </EmailLayout>
  );
}
