import React from 'react';

interface StarRatingProps {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  readOnly?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({ value, onChange, max = 5, readOnly }) => {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const idx = i + 1;
        const active = value >= idx;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => !readOnly && onChange(idx)}
            className={`w-6 h-6 ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            aria-label={`Rate ${idx}`}
          >
            <svg viewBox="0 0 24 24" className={`w-6 h-6 ${active ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor">
              <path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.786 1.402 8.168L12 18.896l-7.336 3.869 1.402-8.168L.132 9.211l8.2-1.193z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
};
