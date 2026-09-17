import React, { useState } from 'react'
import logoImg from '../assets/logo.png'

export default function NetFlowLogo({ className = "w-[42px] h-[42px]", size = 42 }) {
  const [imgFailed, setImgFailed] = useState(false)

  const containerStyle = {
    width: typeof size === 'number' ? `${size}px` : size,
    height: typeof size === 'number' ? `${size}px` : size,
  }

  return (
    <div
      style={containerStyle}
      className={`rounded-2xl overflow-hidden shadow-md shadow-indigo-500/25 shrink-0 select-none flex items-center justify-center bg-gradient-to-br from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] p-1.5 ${className}`}
    >
      {!imgFailed ? (
        <img
          src={logoImg}
          alt="NetFlow"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain rounded-xl"
        />
      ) : (
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          {/* S-curve path: Bottom-left to Top node */}
          <path
            d="M15 30 C15 22, 22 22, 23 16"
            stroke="#FFFFFF"
            strokeWidth="2.75"
            strokeLinecap="round"
          />
          {/* Curve path: Top to Bottom-right node */}
          <path
            d="M27 15 C33 18, 33 26, 33 30"
            stroke="#FFFFFF"
            strokeWidth="2.75"
            strokeLinecap="round"
          />
          {/* Horizontal path: Bottom-left to Bottom-right node */}
          <path
            d="M16 33 L32 33"
            stroke="#FFFFFF"
            strokeWidth="2.75"
            strokeLinecap="round"
          />
          
          {/* Node connector plugs */}
          <circle cx="15" cy="23" r="1.5" fill="#FFFFFF" />
          <circle cx="27" cy="14" r="1.5" fill="#FFFFFF" />
          <circle cx="25" cy="33" r="1.5" fill="#FFFFFF" />

          {/* 3 Main Workflow Nodes */}
          <circle cx="14" cy="33" r="5" fill="#FFFFFF" />
          <circle cx="24" cy="13" r="5" fill="#FFFFFF" />
          <circle cx="34" cy="33" r="5" fill="#FFFFFF" />
        </svg>
      )}
    </div>
  )
}
