import { Section, Text } from '@react-email/components';
import * as React from 'react';
import EmailLayout from './layout';
import EmailButton from './components/Button';
import EmailFooter from './components/Footer';

interface WelcomeEmailProps {
  name: string;
  dashboardUrl: string;
  supportEmail: string;
}

export default function WelcomeEmail({ name, dashboardUrl, supportEmail }: WelcomeEmailProps) {
  return (
    <EmailLayout
      preview="Welcome to APEXSTORAGE"
      supportEmail={supportEmail}
      headerSubtitle="SECURE ACCOUNT"
      footer={<EmailFooter supportEmail={supportEmail} showBrand />}
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
          Welcome to APEXSTORAGE
        </Text>
        <Text
          style={{
            margin: '18px 0 0',
            fontSize: '14px',
            lineHeight: '24px',
            color: '#D8D8D8',
          }}
        >
          Dear {name || 'Valued Client'},
        </Text>
        <Text
          style={{
            margin: '10px 0 0',
            fontSize: '14px',
            lineHeight: '24px',
            color: '#D8D8D8',
          }}
        >
          Thank you for joining APEXSTORAGE — the institutional-grade platform for vaulted gold
          ownership, secure custody and global asset protection.
        </Text>
        <Text
          style={{
            margin: '10px 0 0',
            fontSize: '14px',
            lineHeight: '24px',
            color: '#D8D8D8',
          }}
        >
          Your email address has been verified. To get the most from your account, complete your
          profile and explore your secure vault dashboard.
        </Text>
      </Section>

      {/* The dashboard CTA is only rendered when a real public https URL is
          configured — outbound email must never contain localhost/dev links
          (mailbox providers spam-classify them). In dev the button is simply
          omitted and the email still stands alone with its support footer. */}
      {dashboardUrl && <EmailButton href={dashboardUrl}>Go to Dashboard</EmailButton>}

    </EmailLayout>
  );
}
