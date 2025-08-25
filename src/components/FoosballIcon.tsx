import React from 'react';

interface FoosballIconProps {
  className?: string;
}

export function FoosballIcon({ className = "w-10 h-10" }: FoosballIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
        {/* Background circle for contrast */}
        <circle 
          cx="32" 
          cy="32" 
          r="28" 
          fill="white" 
          fillOpacity="0.15"
        />
        <circle 
          cx="32" 
          cy="32" 
          r="28" 
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.3"
        />
        
        {/* Horizontal rod with better contrast */}
        <rect 
          x="10" 
          y="30" 
          width="44" 
          height="4" 
          rx="2" 
          fill="currentColor"
        />
        <rect 
          x="10" 
          y="30.5" 
          width="44" 
          height="1.5" 
          rx="0.75" 
          fill="white"
          fillOpacity="0.4"
        />
        
        {/* Left player - more detailed and better contrast */}
        <g>
          {/* Head with better visibility */}
          <circle 
            cx="18" 
            cy="20" 
            r="5" 
            fill="white"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle 
            cx="18" 
            cy="20" 
            r="3" 
            fill="currentColor"
            fillOpacity="0.6"
          />
          
          {/* Torso */}
          <rect 
            x="13" 
            y="25" 
            width="10" 
            height="12" 
            rx="3" 
            fill="white"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect 
            x="14" 
            y="26" 
            width="8" 
            height="10" 
            rx="2" 
            fill="currentColor"
            fillOpacity="0.4"
          />
          
          {/* Arms connecting to rod */}
          <rect 
            x="10" 
            y="29" 
            width="16" 
            height="4" 
            rx="2" 
            fill="currentColor"
          />
          
          {/* Legs */}
          <rect 
            x="15" 
            y="37" 
            width="3" 
            height="10" 
            rx="1.5" 
            fill="currentColor"
          />
          <rect 
            x="20" 
            y="37" 
            width="3" 
            height="10" 
            rx="1.5" 
            fill="currentColor"
          />
          
          {/* Feet */}
          <ellipse 
            cx="16.5" 
            cy="48" 
            rx="2.5" 
            ry="1.5" 
            fill="currentColor"
          />
          <ellipse 
            cx="21.5" 
            cy="48" 
            rx="2.5" 
            ry="1.5" 
            fill="currentColor"
          />
        </g>
        
        {/* Right player - more detailed and better contrast */}
        <g>
          {/* Head with better visibility */}
          <circle 
            cx="46" 
            cy="20" 
            r="5" 
            fill="white"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle 
            cx="46" 
            cy="20" 
            r="3" 
            fill="currentColor"
            fillOpacity="0.6"
          />
          
          {/* Torso */}
          <rect 
            x="41" 
            y="25" 
            width="10" 
            height="12" 
            rx="3" 
            fill="white"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect 
            x="42" 
            y="26" 
            width="8" 
            height="10" 
            rx="2" 
            fill="currentColor"
            fillOpacity="0.4"
          />
          
          {/* Arms connecting to rod */}
          <rect 
            x="38" 
            y="29" 
            width="16" 
            height="4" 
            rx="2" 
            fill="currentColor"
          />
          
          {/* Legs */}
          <rect 
            x="43" 
            y="37" 
            width="3" 
            height="10" 
            rx="1.5" 
            fill="currentColor"
          />
          <rect 
            x="48" 
            y="37" 
            width="3" 
            height="10" 
            rx="1.5" 
            fill="currentColor"
          />
          
          {/* Feet */}
          <ellipse 
            cx="44.5" 
            cy="48" 
            rx="2.5" 
            ry="1.5" 
            fill="currentColor"
          />
          <ellipse 
            cx="49.5" 
            cy="48" 
            rx="2.5" 
            ry="1.5" 
            fill="currentColor"
          />
        </g>
        
        {/* Ball with better visibility */}
        <circle 
          cx="32" 
          cy="55" 
          r="4" 
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle 
          cx="32" 
          cy="55" 
          r="2" 
          fill="currentColor"
        />
        
        {/* Motion lines for dynamic effect */}
        <path 
          d="M28 56 L30 54 M34 54 L36 56" 
          stroke="currentColor" 
          strokeWidth="1" 
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
  );
}