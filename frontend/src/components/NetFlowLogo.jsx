import React from 'react'

export default function NetFlowLogo({ className = "w-[42px] h-[42px]", size = 42 }) {
  const containerStyle = {
    width: typeof size === 'number' ? `${size}px` : size,
    height: typeof size === 'number' ? `${size}px` : size,
  }

  return (
    <div
      style={containerStyle}
      className={`rounded-2xl overflow-hidden shadow-md shadow-blue-950/20 shrink-0 select-none flex items-center justify-center bg-[#134287] p-1.5 ${className}`}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        {/* 1. S-Curve Arrow: Top Node to Bottom-Left Node */}
        <path
          d="M 27 17 C 25.5 22.5, 18.5 22.5, 16 27.5"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <polygon
          points="14,29.5 19.5,28 16.5,23.5"
          fill="#FFFFFF"
        />

        {/* 2. Bottom Horizontal Arrow: Bottom-Left Node to Bottom-Right Node */}
        <path
          d="M 19 34 L 28 34"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <polygon
          points="30.5,34 25.5,31 25.5,37"
          fill="#FFFFFF"
        />

        {/* 3. Arch Curve Arrow: Bottom-Right Node up to Top Node */}
        <path
          d="M 35 29.5 C 37.5 24, 34.5 17.5, 30.5 15"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <polygon
          points="29,14 34,16 32,20.5"
          fill="#FFFFFF"
        />

        {/* 3 Solid White Workflow Nodes */}
        {/* Top Node */}
        <circle cx="29" cy="13" r="4.2" fill="#FFFFFF" />
        {/* Bottom-Left Node */}
        <circle cx="15" cy="34" r="4.2" fill="#FFFFFF" />
        {/* Bottom-Right Node */}
        <circle cx="35" cy="34" r="4.2" fill="#FFFFFF" />
      </svg>
    </div>
  )
}
