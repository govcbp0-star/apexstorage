import { Section, Text } from '@react-email/components';
import * as React from 'react';

/**
 * Shared security notice shown in every authentication email.
 */
export default function SecurityNotice() {
  return (
    <Section
      style={{
        margin: '24px 40px',
        padding: '16px 18px',
        backgroundColor: '#161616',
        border: '1px solid #333333',
        borderLeft: '3px solid #D4AF37',
        borderRadius: '8px',
      }}
    >
      <Text
        style={{
          margin: 0,
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '2px',
          color: '#D4AF37',
          textTransform: 'uppercase' as const,
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        Security Notice
      </Text>
      <Text
        style={{
          margin: '8px 0 0',
          fontSize: '11px',
          lineHeight: '18px',
          color: '#D8D8D8',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        APEXSTORAGE will never ask you for your password, verification codes, or recovery
        information by email.
      </Text>
      <Text
        style={{
          margin: '8px 0 0',
          fontSize: '11px',
          lineHeight: '18px',
          color: '#8A8A8E',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        If you receive a suspicious email claiming to be from APEXSTORAGE, contact our support
        team immediately.
      </Text>
    </Section>
  );
}
