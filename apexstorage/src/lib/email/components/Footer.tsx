import { Section, Text, Link } from '@react-email/components';
import * as React from 'react';

interface EmailFooterProps {
  supportEmail: string;
  /** Render the gold wordmark + taglines above the support line (Welcome Email only). */
  showBrand?: boolean;
}

/**
 * Shared APEXSTORAGE email footer — support contact and legal line
 * on the deep-black footer band. No divider lines.
 */
export default function EmailFooter({ supportEmail, showBrand = false }: EmailFooterProps) {
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
      {showBrand && (
        <>
          <Text
            style={{
              margin: 0,
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '3px',
              color: '#D4AF37',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            APEXSTORAGE
          </Text>
          <Text
            style={{
              margin: '10px 0 0',
              fontSize: '11px',
              lineHeight: '18px',
              color: '#D8D8D8',
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
          >
            Premium Precious Metals Storage · Secure Vault Management
            <br />
            Global Asset Protection
          </Text>
        </>
      )}
      <Text
        style={{
          margin: showBrand ? '20px 0 0' : 0,
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
