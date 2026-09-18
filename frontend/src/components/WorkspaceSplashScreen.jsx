import React, { useState, useEffect } from 'react'

export function NetFlowSpinningIcon({ size = 180, className = "" }) {
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
          animation: 'spin 3s linear infinite',
          transformOrigin: 'center center'
        }}
      >
        {/* 1. Right Vertical Arrow: From Bottom-Right Node straight UP to Top-Right Node */}
        <path
          d="M 68 63 L 68 37"
          stroke={darkBlue}
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        {/* Large Bold Arrowhead pointing Up */}
        <polygon
          points="68,26 58,42 78,42"
          fill={darkBlue}
        />

        {/* 2. Top-Left Curving Arc: From Top-Right Node curving over to Bottom-Left Node */}
        <path
          d="M 57 24 C 38 21, 25 34, 25 51"
          stroke={darkBlue}
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        {/* Large Bold Arrowhead pointing Down-Left */}
        <polygon
          points="23,59 36,49 24,42"
          fill={darkBlue}
        />

        {/* 3. Bottom Smooth Arc: From Bottom-Left Node curving over to Bottom-Right Node */}
        <path
          d="M 36 67 C 45 75, 55 76, 61 74"
          stroke={darkBlue}
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        {/* Large Bold Arrowhead pointing Right / Up-Right */}
        <polygon
          points="68,74 53,65 56,81"
          fill={darkBlue}
        />

        {/* 3 Extra Bold Circular Workflow Nodes */}
        {/* Top-Right Node */}
        <circle cx="68" cy="27" r="11.5" fill={darkBlue} />
        {/* Bottom-Right Node */}
        <circle cx="68" cy="74" r="11.5" fill={darkBlue} />
        {/* Bottom-Left Node */}
        <circle cx="26" cy="60" r="11.5" fill={darkBlue} />
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
      {/* Extra Bold & Large Spinning 3-node NetFlow Logo */}
      <div className="mb-9">
        <NetFlowSpinningIcon size={180} />
      </div>

      {/* Large Brand Title */}
      <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-[#1e242b] tracking-tight">
        NetFlow
      </h1>

      {/* Larger Tagline */}
      <p className="text-xs sm:text-sm md:text-base font-extrabold uppercase tracking-[0.32em] text-[#526071] mt-3">
        WORK MADE VISIBLE
      </p>

      {/* Larger Status Subtext */}
      <p className="text-base sm:text-lg font-medium text-[#475569] mt-12">
        Loading your workspace...
      </p>

      {/* Larger Progress Bar Container */}
      <div className="w-80 sm:w-96 mt-4">
        <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-[#526071] mb-2">
          <span>Estimated progress</span>
          <span className="tabular-nums font-bold">{progress}%</span>
        </div>
        <div className="w-full h-[4px] bg-slate-200/90 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#134287] rounded-full transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
