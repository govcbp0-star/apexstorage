/**
 * Shared application constants — a pure module (no Firebase / client SDK
 * imports) so it can be imported safely by both client components and
 * server-side email templates.
 */

/**
 * Shipment fee rate charged on the asset value of a shipment,
 * as a decimal fraction (0.15%).
 *
 * Single source of truth: the ShipmentWizard fee calculation, the fee
 * display, and the shipment notification email all read from here so
 * the rate can never drift between screens.
 */
export const SHIPMENT_FEE_RATE = 0.0015;

/** Human-readable label for the shipment fee rate, used in the UI and email. */
export const SHIPMENT_FEE_RATE_LABEL = '0.15%';
