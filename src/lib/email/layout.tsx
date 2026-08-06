import { Html, Head, Body, Container, Preview, Section } from '@react-email/components';
import * as React from 'react';
import EmailHeader from './components/Header';
import EmailFooter from './components/Footer';

interface EmailLayoutProps {
  preview: string;
  supportEmail: string;
  headerSubtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerDividerInset?: number;
}

/**
 * Shared APEXSTORAGE email layout — dark premium container,
 * gold-accented header, branded footer. Every authentication
 * email is built inside this shell so the design system is
 * never duplicated.
 */
export default function EmailLayout({
  preview,
  supportEmail,
  headerSubtitle,
  children,
  footer,
  headerDividerInset,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: '32px 16px',
          backgroundColor: '#111111',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <Container
          style={{
            margin: '0 auto',
            maxWidth: '600px',
            backgroundColor: '#1A1A1A',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <EmailHeader subtitle={headerSubtitle} dividerInset={headerDividerInset} />
          <Section style={{ padding: '12px 0 8px' }}>{children}</Section>
          {footer ?? <EmailFooter supportEmail={supportEmail} />}
        </Container>
      </Body>
    </Html>
  );
}
