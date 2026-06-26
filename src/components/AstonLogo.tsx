import React from 'react';

interface AstonLogoProps {
  className?: string;
  variant?: 'color' | 'white';
}

export default function AstonLogo({ className = 'w-full max-w-[280px]', variant = 'color' }: AstonLogoProps) {
  const astonColor = variant === 'color' ? '#002B5B' : '#FFFFFF';
  const greyColor = variant === 'color' ? '#7E7E82' : 'rgba(255, 255, 255, 0.7)';

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg 
        viewBox="0 0 540 190" 
        width="100%" 
        height="100%" 
        xmlns="http://www.w3.org/2000/svg"
        className="select-none"
      >
        {/* ASTON text */}
        <text 
          x="50%" 
          y="75" 
          textAnchor="middle" 
          fill={astonColor} 
          fontSize="72" 
          fontFamily="'Montserrat', 'Inter', sans-serif" 
          fontWeight="500" 
          letterSpacing="16"
        >
          ASTON
        </text>
        
        {/* CIREBON text */}
        <text 
          x="50.8%" 
          y="132" 
          textAnchor="middle" 
          fill={greyColor} 
          fontSize="46" 
          fontFamily="'Montserrat', 'Inter', sans-serif" 
          fontWeight="300" 
          letterSpacing="20"
        >
          CIREBON
        </text>
        
        {/* HOTEL & CONVENTION CENTER text */}
        <text 
          x="51.2%" 
          y="172" 
          textAnchor="middle" 
          fill={greyColor} 
          fontSize="15" 
          fontFamily="'Montserrat', 'Inter', sans-serif" 
          fontWeight="400" 
          letterSpacing="9"
        >
          HOTEL & CONVENTION CENTER
        </text>
      </svg>
    </div>
  );
}
