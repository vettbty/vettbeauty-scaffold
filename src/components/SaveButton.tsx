'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { isSaved, toggleSave, SavedProduct } from '@/lib/data';

interface SaveButtonProps {
  product: Omit<SavedProduct, 'savedAt'>;
  className?: string;
}

export default function SaveButton({ product, className = '' }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSaved(isSaved(product.slug));
  }, [product.slug]);

  const handleToggle = () => {
    const result = toggleSave(product);
    setSaved(result);
  };

  if (!mounted) {
    return (
      <button
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-gray-400 ${className}`}
        aria-label="Save product"
        disabled
      >
        <Heart className="w-5 h-5" />
        <span className="text-sm font-medium">Save</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-colors duration-200 ${className} ${
        saved
          ? 'bg-rose-50 border-rose-300 text-rose-600 hover:bg-rose-100'
          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
      }`}
      aria-label={saved ? 'Remove from saved' : 'Save product'}
      aria-pressed={saved}
    >
      <Heart
        className={`w-5 h-5 transition-all duration-200 ${saved ? 'fill-current' : ''}`}
      />
      <span className="text-sm font-medium">{saved ? 'Saved' : 'Save'}</span>
    </button>
  );
}
