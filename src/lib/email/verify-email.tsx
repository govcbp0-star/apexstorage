import { Section, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout from './layout';
import EmailButton from './components/Button';
import EmailDivider from './components/Divider';
import SecurityNotice from './components/SecurityNotice';

interface VerifyEmailProps {
  verificationUrl: string;
  supportEmail: string;
}

export default function VerifyEmail({ verificationUrl, supportEmail }: VerifyEmailProps) {
  return (
    <EmailLayout
      preview="Verify your APEXSTORAGE account"
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
          Verify Your Email
        </Text>
        <Text
          style={{
            margin: '18px 0 0',
            fontSize: '14px',
            lineHeight: '24px',
            color: '#D8D8D8',
          }}
        >
          Welcome to APEXSTORAGE.
        </Text>
        <Text
          style={{
            margin: '10px 0 0',
            fontSize: '14px',
            lineHeight: '24px',
            color: '#D8D8D8',
          }}
        >
          Before accessing your secure vault dashboard, please verify your email address.
        </Text>
      </Section>

      <EmailButton href={verificationUrl}>Verify Email</EmailButton>

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
          This verification link expires according to Firebase&apos;s secure verification settings.
        </Text>
      </Section>

      <EmailDivider />
      <SecurityNotice />
    </EmailLayout>
  );
}
