export function formatPrice(value: number | string) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}
