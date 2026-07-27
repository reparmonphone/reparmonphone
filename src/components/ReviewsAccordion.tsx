'use client';

import { useState, type ReactNode } from 'react';

export default function ReviewsAccordion({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-10 pt-8 border-t border-gray-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>{title}</div>
        <span className={`text-gray-400 text-xl transition-transform ${open ? 'rotate-180' : ''}`}>
          ⌄
        </span>
      </button>

      {open && <div className="mt-6">{children}</div>}
    </div>
  );
}
