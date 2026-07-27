import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer';
import { formatPrice } from './format';
import { CARRIER_LABELS } from './tracking';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#1f2937', fontFamily: 'Helvetica' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  companyName: { fontSize: 16, fontWeight: 700, color: '#0E7FDB', marginBottom: 4 },
  small: { fontSize: 9, color: '#6b7280', lineHeight: 1.5 },
  invoiceTitle: { fontSize: 18, fontWeight: 700, marginBottom: 4, textAlign: 'right' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  sectionBlock: { width: '48%' },
  sectionLabel: { fontSize: 9, fontWeight: 700, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' },
  table: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f9fafb', paddingVertical: 6, paddingHorizontal: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  colTitle: { width: '55%' },
  colQty: { width: '15%', textAlign: 'center' },
  colUnit: { width: '15%', textAlign: 'right' },
  colTotal: { width: '15%', textAlign: 'right' },
  thText: { fontSize: 9, fontWeight: 700, color: '#6b7280' },
  totalsBlock: { marginTop: 16, alignSelf: 'flex-end', width: '50%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalRowFinal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 },
});

export type InvoiceOrder = {
  invoiceNumber: number;
  createdAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  shippingLine1: string;
  shippingCity: string;
  shippingZip: string;
  billingName: string | null;
  billingLine1: string | null;
  billingCity: string | null;
  billingZip: string | null;
  subtotal: number;
  shippingCost: number;
  promoCode: string | null;
  discountAmount: number;
  total: number;
  paymentBrand: string | null;
  paymentLast4: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  items: { title: string; quantity: number; unitPrice: number }[];
};

function InvoiceDocument({ order }: { order: InvoiceOrder }) {
  const invoiceLabel = `${order.createdAt.getFullYear()}-${String(order.invoiceNumber).padStart(5, '0')}`;
  const hasBillingAddress = !!order.billingLine1;

  return (
    <Document title={`Facture ${invoiceLabel}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image
              src="https://www.reparmonphone.fr/wp-content/uploads/2025/03/logo-repar-mon-phone-3.png"
              style={{ width: 40, height: 40, marginRight: 10 }}
            />
            <View>
              <Text style={styles.companyName}>ReparMonPhone</Text>
              <Text style={styles.small}>Les Saquèdes, 83120 Sainte-Maxime</Text>
              <Text style={styles.small}>SIRET : 518 898 549</Text>
              <Text style={styles.small}>contact@reparmonphone.fr — 07 83 49 72 62</Text>
            </View>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>FACTURE</Text>
            <Text style={[styles.small, { textAlign: 'right' }]}>N° {invoiceLabel}</Text>
            <Text style={[styles.small, { textAlign: 'right' }]}>
              Date : {order.createdAt.toLocaleDateString('fr-FR')}
            </Text>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Adresse de livraison</Text>
            <Text style={styles.small}>{order.customerName}</Text>
            <Text style={styles.small}>{order.shippingLine1}</Text>
            <Text style={styles.small}>{order.shippingZip} {order.shippingCity}</Text>
            {order.customerPhone && <Text style={styles.small}>{order.customerPhone}</Text>}
            <Text style={styles.small}>{order.customerEmail}</Text>
          </View>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Adresse de facturation</Text>
            {hasBillingAddress ? (
              <>
                <Text style={styles.small}>{order.billingName ?? order.customerName}</Text>
                <Text style={styles.small}>{order.billingLine1}</Text>
                <Text style={styles.small}>{order.billingZip} {order.billingCity}</Text>
              </>
            ) : (
              <Text style={styles.small}>Identique à la livraison</Text>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colTitle, styles.thText]}>Article</Text>
            <Text style={[styles.colQty, styles.thText]}>Qté</Text>
            <Text style={[styles.colUnit, styles.thText]}>Prix unit.</Text>
            <Text style={[styles.colTotal, styles.thText]}>Total</Text>
          </View>
          {order.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colTitle}>{item.title}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{formatPrice(item.unitPrice)}</Text>
              <Text style={styles.colTotal}>{formatPrice(item.unitPrice * item.quantity)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.small}>Sous-total</Text>
            <Text style={styles.small}>{formatPrice(order.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.small}>Frais de livraison</Text>
            <Text style={styles.small}>{order.shippingCost > 0 ? formatPrice(order.shippingCost) : 'Offerts'}</Text>
          </View>
          {order.promoCode && (
            <View style={styles.totalRow}>
              <Text style={styles.small}>Réduction ({order.promoCode})</Text>
              <Text style={styles.small}>− {formatPrice(order.discountAmount)}</Text>
            </View>
          )}
          <View style={styles.totalRowFinal}>
            <Text style={{ fontWeight: 700 }}>Total TTC</Text>
            <Text style={{ fontWeight: 700 }}>{formatPrice(order.total)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 24 }}>
          <Text style={styles.sectionLabel}>Paiement</Text>
          <Text style={styles.small}>
            {order.paymentBrand && order.paymentLast4
              ? `Carte ${order.paymentBrand.toUpperCase()} terminant par ${order.paymentLast4}`
              : 'Carte bancaire (détails non communiqués)'}
          </Text>
        </View>

        {order.carrier && order.trackingNumber && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.sectionLabel}>Livraison</Text>
            <Text style={styles.small}>
              {CARRIER_LABELS[order.carrier] ?? order.carrier} — suivi n° {order.trackingNumber}
            </Text>
          </View>
        )}

        <Text style={styles.footer}>
          ReparMonPhone — Les Saquèdes, 83120 Sainte-Maxime — SIRET 518 898 549{'\n'}
          TVA non applicable, art. 293 B du Code Général des Impôts — Facture générée automatiquement, à
          vérifier avec ton expert-comptable pour la conformité fiscale exacte de ce modèle.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateInvoicePdf(order: InvoiceOrder): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument order={order} />);
}
