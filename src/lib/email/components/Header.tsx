import { Section, Text, Hr } from '@react-email/components';
import * as React from 'react';

interface EmailHeaderProps {
  subtitle?: string;
  dividerInset?: number;
}

/**
 * Shared APEXSTORAGE email header — gold wordmark + gold divider
 * with an optional kicker subtitle (e.g. "SECURE ACCOUNT").
 *
 * `dividerInset` controls the horizontal padding (in px) on each side
 * of the gold divider so it stays inset equally from both card edges.
 */
export default function EmailHeader({
  subtitle = 'SECURE ACCOUNT',
  dividerInset = 40,
}: EmailHeaderProps) {
  return (
    <>
      <Section style={{ textAlign: 'center' as const, padding: '36px 40px 8px' }}>
        <Text
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '6px',
            color: '#D4AF37',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          APEXSTORAGE
        </Text>
        {subtitle && (
          <Text
            style={{
              margin: '10px 0 0',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '4px',
              color: '#8A8A8E',
              textTransform: 'uppercase' as const,
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
          >
            {subtitle}
          </Text>
        )}
      </Section>
      <Section style={{ padding: `0 ${dividerInset}px` }}>
        <Hr
          style={{
            border: 'none',
            borderTop: '1px solid #D4AF37',
            opacity: 0.5,
            margin: '20px 0 0',
          }}
        />
      </Section>
    </>
  );
}
