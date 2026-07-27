export default function TrustBadges({ className = '' }: { className?: string }) {
  const badges = [
    { label: 'Visa', bg: '#1A1F71', text: 'VISA', textColor: '#fff' },
    { label: 'Mastercard', bg: '#fff', text: '●●', textColor: '#EB001B', border: true },
    { label: 'American Express', bg: '#2E77BC', text: 'AMEX', textColor: '#fff' },
    { label: 'PayPal', bg: '#003087', text: 'PayPal', textColor: '#fff' },
    { label: 'Maestro', bg: '#fff', text: 'MAESTRO', textColor: '#0099DF', border: true },
  ];

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {badges.map((b) => (
        <span
          key={b.label}
          title={b.label}
          className="px-2.5 py-1.5 rounded text-[10px] font-bold tracking-wide"
          style={{ backgroundColor: b.bg, color: b.textColor, border: b.border ? '1px solid #e5e7eb' : undefined }}
        >
          {b.text}
        </span>
      ))}
    </div>
  );
}
