import React, { useState, useEffect } from 'react'

export function NetFlowSpinningIcon({ size = 84, className = "" }) {
  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`relative flex items-center justify-center ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full animate-spin text-[#1d4ed8]"
        style={{ animationDuration: '3s' }}
      >
        {/* Curved Arrow 1: Bottom-Left to Top */}
        <path
          d="M 23 58 C 23 36, 35 25, 43 21"
          stroke="#1d4ed8"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <polygon points="41,16 48,22 41,27" fill="#1d4ed8" />

        {/* Curved Arrow 2: Top to Bottom-Right */}
        <path
          d="M 57 21 C 65 25, 77 36, 77 58"
          stroke="#1d4ed8"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <polygon points="80,55 77,63 71,57" fill="#1d4ed8" />

        {/* Curved Arrow 3: Bottom-Right to Bottom-Left */}
        <path
          d="M 70 73 C 58 80, 42 80, 30 73"
          stroke="#1d4ed8"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <polygon points="32,77 24,72 31,67" fill="#1d4ed8" />

        {/* 3 Circular Workflow Nodes */}
        <circle cx="50" cy="18" r="7.5" fill="#1d4ed8" />
        <circle cx="21" cy="67" r="7.5" fill="#1d4ed8" />
        <circle cx="79" cy="67" r="7.5" fill="#1d4ed8" />
      </svg>
    </div>
  )
}

export default function WorkspaceSplashScreen({ onFinish, minDuration = 1200 }) {
  const [progress, setProgress] = useState(15)

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const pct = Math.min(98, Math.floor((elapsed / minDuration) * 90) + 15)
      setProgress(pct)

      if (elapsed >= minDuration) {
        clearInterval(interval)
        setProgress(100)
        if (onFinish) {
          setTimeout(onFinish, 250)
        }
      }
    }, 40)

    return () => clearInterval(interval)
  }, [minDuration, onFinish])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#f8fafc] text-slate-800 select-none">
      {/* Spinning 3-node NetFlow Logo */}
      <div className="mb-8">
        <NetFlowSpinningIcon size={92} />
      </div>

      {/* Brand Title */}
      <h1 className="text-4xl sm:text-5xl font-extrabold text-[#111827] tracking-tight">
        NetFlow
      </h1>

      {/* Tagline */}
      <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] text-[#475569] mt-2">
        WORK MADE VISIBLE
      </p>

      {/* Subtext */}
      <p className="text-xs sm:text-sm font-medium text-[#64748b] mt-10">
        Loading your workspace...
      </p>

      {/* Progress Bar Container */}
      <div className="w-64 sm:w-72 mt-3">
        <div className="flex justify-between items-center text-[10.5px] font-medium text-[#64748b] mb-1.5">
          <span>Estimated progress</span>
          <span className="tabular-nums font-semibold">{progress}%</span>
        </div>
        <div className="w-full h-1 bg-slate-200/90 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1d4ed8] rounded-full transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
