'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { getSavedCount } from '@/lib/saved';

interface SaveCountProps {
  className?: string;
}

export default function SaveCount({ className = '' }: SaveCountProps) {
  const [count, setCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCount(getSavedCount());

    const handleUpdate = () => setCount(getSavedCount());
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('vettbeauty-saved-updated', handleUpdate);

    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('vettbeauty-saved-updated', handleUpdate);
    };
  }, []);

  if (!mounted) {
    return (
      <Link
        href="/saved"
        className={`inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors ${className}`}
        aria-label="Saved products"
      >
        <Heart className="w-5 h-5" />
      </Link>
    );
  }

  return (
    <Link
      href="/saved"
      className={`inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors ${className}`}
      aria-label={`Saved products (${count})`}
    >
      <Heart
        className={`w-5 h-5 ${count > 0 ? 'fill-rose-500 text-rose-500' : ''}`}
      />
      {count > 0 && (
        <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </Link>
  );
}
