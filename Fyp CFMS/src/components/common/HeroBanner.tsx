import React from 'react';

interface HeroBannerProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  bgImageUrl?: string; // default campus/university blur
  overlayClassName?: string; // e.g., 'bg-primary/70' or 'bg-black/50'
  className?: string;
  rounded?: boolean;
  children?: React.ReactNode; // custom content instead of title/subtitle
}

/**
 * Reusable hero banner with background image and overlay, used across dashboards/pages.
 * Defaults mirror coordinator/faculty style.
 */
export const HeroBanner: React.FC<HeroBannerProps> = ({
  title,
  subtitle,
  bgImageUrl = '/background-image.jpg',
  overlayClassName = 'bg-blue-900/40 backdrop-blur-sm',
  className = '',
  rounded = true,
  children,
}) => {
  return (
    <div className={`relative overflow-hidden ${rounded ? 'rounded-2xl' : ''} mb-6 ${className}`}
         style={{ minHeight: '200px' }}>
      <div className="absolute inset-0" style={{ backgroundImage: `url(${bgImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div className={`absolute inset-0 ${overlayClassName}`} />
      <div className="relative p-8 text-white">
        {children ? (
          children
        ) : (
          <>
            {title && (<h2 className="text-2xl md:text-3xl font-bold">{title}</h2>)}
            {subtitle && (<p className="mt-2 text-white/90">{subtitle}</p>)}
          </>
        )}
      </div>
    </div>
  );
};

export default HeroBanner;
