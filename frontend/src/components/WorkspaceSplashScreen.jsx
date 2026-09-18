import React, { useState, useEffect } from 'react'

export function NetFlowSpinningIcon({ size = 96, className = "" }) {
  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`relative flex items-center justify-center ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full text-[#1c52a3]"
        style={{
          animation: 'spin 3.5s linear infinite',
          transformOrigin: 'center center'
        }}
      >
        {/* 1. Diagonal Arrow: From Right Node to Top Node */}
        <path
          d="M 68 39 L 51 26"
          stroke="#1c52a3"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        {/* Arrowhead pointing Up-Left into Top Node */}
        <path
          d="M 46 22 L 56 22 L 52 30 Z"
          fill="#1c52a3"
        />

        {/* 2. Left Curved Arc: From Top Node down to Bottom-Left Node */}
        <path
          d="M 39 25 C 28 35, 27 50, 36 62"
          stroke="#1c52a3"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        {/* Arrowhead pointing Down-Right towards Bottom-Left Node */}
        <path
          d="M 38 67 L 30 60 L 39 57 Z"
          fill="#1c52a3"
        />

        {/* 3. Bottom S-Curve Wave: From Bottom-Left Node to Right Node */}
        <path
          d="M 48 70 C 56 70, 60 64, 69 51"
          stroke="#1c52a3"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        {/* Arrowhead pointing Up-Right into Right Node */}
        <path
          d="M 73 46 L 73 56 L 65 52 Z"
          fill="#1c52a3"
        />

        {/* 3 Circular Workflow Nodes */}
        {/* Top Node */}
        <circle cx="44" cy="20" r="7.5" fill="#1c52a3" />
        {/* Right Node */}
        <circle cx="77" cy="43" r="7.5" fill="#1c52a3" />
        {/* Bottom-Left Node */}
        <circle cx="42" cy="72" r="7.5" fill="#1c52a3" />
      </svg>
    </div>
  )
}

export default function WorkspaceSplashScreen({ onFinish, minDuration = 1400 }) {
  const [progress, setProgress] = useState(18)

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const pct = Math.min(100, Math.floor((elapsed / minDuration) * 85) + 18)
      setProgress(pct)

      if (elapsed >= minDuration) {
        clearInterval(interval)
        setProgress(100)
        if (onFinish) {
          setTimeout(onFinish, 200)
        }
      }
    }, 40)

    return () => clearInterval(interval)
  }, [minDuration, onFinish])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#f0f4f8] text-slate-800 select-none">
      {/* Spinning 3-node NetFlow Logo */}
      <div className="mb-7">
        <NetFlowSpinningIcon size={96} />
      </div>

      {/* Brand Title */}
      <h1 className="text-4xl sm:text-5xl font-black text-[#1e242b] tracking-tight">
        NetFlow
      </h1>

      {/* Tagline */}
      <p className="text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.28em] text-[#64748b] mt-2">
        WORK MADE VISIBLE
      </p>

      {/* Subtext */}
      <p className="text-sm font-normal text-[#526071] mt-10">
        Loading your workspace...
      </p>

      {/* Progress Bar Container */}
      <div className="w-64 sm:w-72 mt-3.5">
        <div className="flex justify-between items-center text-[11px] font-medium text-[#526071] mb-1.5">
          <span>Estimated progress</span>
          <span className="tabular-nums font-semibold">{progress}%</span>
        </div>
        <div className="w-full h-[3px] bg-slate-200/90 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1c52a3] rounded-full transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
