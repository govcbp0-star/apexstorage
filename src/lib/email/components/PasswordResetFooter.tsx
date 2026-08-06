import { Section, Text, Link } from '@react-email/components';
import * as React from 'react';

interface PasswordResetFooterProps {
  supportEmail: string;
}

/**
 * Minimal footer for the Password Reset email —
 * support contact, copyright, and automated message only.
 * Excludes the company taglines to keep the email focused.
 * Separation from the body relies on background contrast and spacing.
 */
export default function PasswordResetFooter({ supportEmail }: PasswordResetFooterProps) {
  const year = new Date().getFullYear();

  return (
    <Section
      style={{
        backgroundColor: '#0A0A0A',
        borderRadius: '0 0 12px 12px',
        padding: '28px 40px',
        textAlign: 'center' as const,
      }}
    >
      <Text
        style={{
          margin: 0,
          fontSize: '11px',
          lineHeight: '18px',
          color: '#8A8A8E',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        Need help? Contact us at{' '}
        <Link href={`mailto:${supportEmail}`} style={{ color: '#D4AF37', textDecoration: 'none' }}>
          {supportEmail}
        </Link>
      </Text>
      <Text
        style={{
          margin: '14px 0 0',
          fontSize: '10px',
          lineHeight: '16px',
          color: '#5A5A5E',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        © {year} APEXSTORAGE. All rights reserved.
        <br />
        This is an automated security message — please do not reply.
      </Text>
    </Section>
  );
}