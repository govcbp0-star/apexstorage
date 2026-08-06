import { Hr } from '@react-email/components';
import * as React from 'react';

/**
 * Shared hairline divider (#333333).
 */
export default function EmailDivider() {
  return (
    <Hr
      style={{
        border: 'none',
        borderTop: '1px solid #333333',
        margin: '28px 40px',
      }}
    />
  );
}
