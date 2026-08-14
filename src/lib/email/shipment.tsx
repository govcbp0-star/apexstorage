import { Section, Text, Hr } from '@react-email/components';
import * as React from 'react';
import EmailLayout from './layout';
import EmailFooter from './components/Footer';
import { SHIPMENT_FEE_RATE_LABEL } from '../constants';

/**
 * Branded shipment notification email — built on the exact same APEXSTORAGE
 * email design system as the verification / password-reset emails (dark
 * premium container, gold wordmark + divider, Georgia serif headings,
 * #D8D8D8 body copy, #8A8A8E meta, gold accents, support footer).
 *
 * Every value rendered here is read directly from the persisted shipment
 * record — nothing is recalculated. Fields that were not stored on the
 * record (e.g. gold price for legacy shipments) are omitted gracefully.
 */
interface ShipmentEmailProps {
  shipment: {
    id: string;
    userName?: string;
    userEmail?: string;
    weight?: number;
    shippingAmount?: string;
    partialGrams?: number;
    vaultLocation?: string;
    goldPrice?: number;
    goldValue?: number;
    shipmentFee?: number;
    deliveryName?: string;
    deliveryPhone?: string;
    deliveryAddress?: string;
    deliveryCity?: string;
    deliveryPostcode?: string;
    deliveryCountry?: string;
    date?: string;
    status?: string;
    assetRef?: string;
  };
  supportEmail: string;
}

const GOLD = '#D4AF37';

function formatUSD(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatStatus(status: string | undefined): string {
  const s = (status || '').toLowerCase();
  if (s === 'pending') return 'Pending — Awaiting Approval';
  if (s === 'approved') return 'Approved';
  if (s === 'shipped') return 'Shipped';
  if (s === 'rejected') return 'Rejected';
  return status || 'Pending';
}

interface DetailRowProps {
  label: string;
  value: string;
  gold?: boolean;
}

function DetailRow({ label, value, gold }: DetailRowProps) {
  return (
    <tr>
      <td style={{ padding: '7px 0', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', verticalAlign: 'top' }}>
        <Text style={{ margin: 0, fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: '#8A8A8E', fontFamily: 'Arial, Helvetica, sans-serif' }}>
          {label}
        </Text>
      </td>
      <td style={{ padding: '7px 0 7px 16px', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', verticalAlign: 'top', textAlign: 'right' as const }}>
        <Text style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: gold ? GOLD : '#F5F5F5', fontFamily: 'Arial, Helvetica, sans-serif' }}>
          {value}
        </Text>
      </td>
    </tr>
  );
}

export default function ShipmentEmail({ shipment, supportEmail }: ShipmentEmailProps) {
  const {
    id,
    userName,
    weight,
    shippingAmount,
    partialGrams,
    vaultLocation,
    goldPrice,
    goldValue,
    shipmentFee,
    deliveryName,
    deliveryPhone,
    deliveryAddress,
    deliveryCity,
    deliveryPostcode,
    deliveryCountry,
    date,
    status,
    assetRef,
  } = shipment;

  const shipType = shippingAmount === 'ship_full' ? 'Full Shipment' : `Partial Shipment${partialGrams ? ` (${partialGrams} g)` : ''}`;
  const destination = [deliveryCity, deliveryCountry].filter(Boolean).join(', ') || '—';

  return (
    <EmailLayout
      preview="Your APEXSTORAGE shipment request has been received"
      supportEmail={supportEmail}
      headerSubtitle="SECURE SHIPMENT"
      footer={<EmailFooter supportEmail={supportEmail} />}
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
          Shipment Request Received
        </Text>
        <Text
          style={{
            margin: '18px 0 0',
            fontSize: '14px',
            lineHeight: '24px',
            color: '#D8D8D8',
          }}
        >
          Dear {userName || 'Valued Client'},
        </Text>
        <Text
          style={{
            margin: '10px 0 0',
            fontSize: '14px',
            lineHeight: '24px',
            color: '#D8D8D8',
          }}
        >
          Your shipment request has been received and is being processed by our secure
          operations team. A summary of your shipment is provided below.
        </Text>
      </Section>

      <Section style={{ padding: '24px 40px 8px' }}>
        <Hr
          style={{
            border: 'none',
            borderTop: '1px solid rgba(212, 175, 55, 0.35)',
            margin: '0 0 18px',
          }}
        />
        <table role="presentation" width="100%" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <DetailRow label="Shipment Reference" value={id || '—'} />
            <DetailRow label="Grams Being Shipped" value={weight !== undefined ? `${weight} g` : '—'} gold />
            {vaultLocation ? <DetailRow label="Vault Location" value={vaultLocation} /> : null}
            <DetailRow label="Shipment Type" value={shipType} />
            {goldPrice !== undefined ? <DetailRow label="Gold Price (Locked)" value={formatUSD(goldPrice)} /> : null}
            {goldValue !== undefined ? <DetailRow label="Asset Value" value={formatUSD(goldValue)} /> : null}
            <DetailRow
              label={`Shipment Fee (${SHIPMENT_FEE_RATE_LABEL})`}
              value={shipmentFee !== undefined ? formatUSD(shipmentFee) : '—'}
              gold
            />
            <DetailRow label="Delivery To" value={deliveryName || '—'} />
            <DetailRow label="Destination" value={destination} />
            {deliveryPhone ? <DetailRow label="Contact Number" value={deliveryPhone} /> : null}
            {deliveryAddress ? <DetailRow label="Delivery Address" value={deliveryAddress} /> : null}
            {deliveryPostcode ? <DetailRow label="Postcode" value={deliveryPostcode} /> : null}
            <DetailRow label="Requested On" value={date || '—'} />
            <DetailRow label="Status" value={formatStatus(status)} gold />
          </tbody>
        </table>
      </Section>

      <Section style={{ padding: '0 40px' }}>
        <Text
          style={{
            margin: '18px 0 0',
            fontSize: '11px',
            lineHeight: '18px',
            color: '#8A8A8E',
          }}
        >
          {assetRef ? `Assets: ${assetRef}` : 'Your assets remain securely stored in the vault until the shipment is released.'}
        </Text>
        <Text
          style={{
            margin: '14px 0 0',
            fontSize: '11px',
            lineHeight: '18px',
            color: '#8A8A8E',
          }}
        >
          For any questions about this shipment, please contact our support team.
        </Text>
      </Section>
    </EmailLayout>
  );
}
