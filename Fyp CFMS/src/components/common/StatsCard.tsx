import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  buttonText?: string;
  onButtonClick?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  buttonText,
  onButtonClick,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-gray-600 text-sm font-medium mb-2">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 mb-4">{value}</p>
      {buttonText && onButtonClick && (
        <button
          onClick={onButtonClick}
          className="bg-coral text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors w-full"
        >
          {buttonText}
        </button>
      )}
    </div>
  );
};
