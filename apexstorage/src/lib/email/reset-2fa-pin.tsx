import { Section, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout from './layout';
import EmailButton from './components/Button';

interface ResetTwoFAPinEmailProps {
  resetUrl: string;
  supportEmail: string;
}

export default function ResetTwoFAPinEmail({ resetUrl, supportEmail }: ResetTwoFAPinEmailProps) {
  return (
    <EmailLayout
      preview="Reset your APEXSTORAGE two-factor PIN"
      supportEmail={supportEmail}
      headerSubtitle="SECURE ACCOUNT"
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
          Reset Your 2FA PIN
        </Text>
        <Text style={{ margin: '18px 0 0', fontSize: '14px', lineHeight: '24px', color: '#D8D8D8' }}>
          We received a request to reset the two-factor authentication PIN for your APEXSTORAGE account.
        </Text>
        <Text style={{ margin: '10px 0 0', fontSize: '14px', lineHeight: '24px', color: '#D8D8D8' }}>
          If you requested this change, use the secure button below. If you did not request a PIN reset, you can safely ignore this email.
        </Text>
      </Section>

      <EmailButton href={resetUrl}>Reset 2FA PIN</EmailButton>

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
          This secure link expires in 1 hour and can only be used once.
        </Text>
      </Section>
    </EmailLayout>
  );
}
