import React, { useState, useEffect } from 'react'

export function NetFlowSpinningIcon({ size = 135, className = "" }) {
  const darkBlue = "#134287" // Bold rich dark blue

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`relative flex items-center justify-center ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        style={{
          animation: 'spin 3.2s linear infinite',
          transformOrigin: 'center center'
        }}
      >
        {/* 1. Right Vertical Arrow: From Bottom-Right Node straight UP to Top-Right Node */}
        <path
          d="M 68 64 L 68 37"
          stroke={darkBlue}
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Large Arrowhead pointing Up */}
        <polygon
          points="68,29 60,42 76,42"
          fill={darkBlue}
        />

        {/* 2. Top-Left Curving Arc: From Top-Right Node curving over to Bottom-Left Node */}
        <path
          d="M 58 24 C 41 22, 28 34, 27 52"
          stroke={darkBlue}
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Large Arrowhead pointing Down-Left */}
        <polygon
          points="24,59 35,50 25,44"
          fill={darkBlue}
        />

        {/* 3. Bottom Smooth Arc: From Bottom-Left Node curving over to Bottom-Right Node */}
        <path
          d="M 36 67 C 44 74, 54 75, 60 74"
          stroke={darkBlue}
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Large Arrowhead pointing Right / Up-Right */}
        <polygon
          points="66,74 54,66 56,79"
          fill={darkBlue}
        />

        {/* 3 Bold Circular Workflow Nodes */}
        {/* Top-Right Node */}
        <circle cx="68" cy="27" r="9.5" fill={darkBlue} />
        {/* Bottom-Right Node */}
        <circle cx="68" cy="74" r="9.5" fill={darkBlue} />
        {/* Bottom-Left Node */}
        <circle cx="26" cy="60" r="9.5" fill={darkBlue} />
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
      {/* Bold Large Spinning 3-node NetFlow Logo */}
      <div className="mb-8">
        <NetFlowSpinningIcon size={135} />
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
            className="h-full bg-[#134287] rounded-full transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
