import { Section, Button } from '@react-email/components';
import * as React from 'react';

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
}

/**
 * Shared primary CTA — gold background, dark text, rounded,
 * large centered touch target.
 */
export default function EmailButton({ href, children }: EmailButtonProps) {
  return (
    <Section style={{ textAlign: 'center' as const, padding: '28px 40px 8px' }}>
      <Button
        href={href}
        style={{
          backgroundColor: '#D4AF37',
          color: '#111111',
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '1.5px',
          textTransform: 'uppercase' as const,
          textDecoration: 'none',
          padding: '16px 44px',
          borderRadius: '8px',
          display: 'inline-block',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        {children}
      </Button>
    </Section>
  );
}
