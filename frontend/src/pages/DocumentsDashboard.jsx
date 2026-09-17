import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api, DMS_WEB_URL, toAbsoluteUrl } from '../utils/api'
import { confirm } from '../lib/confirmStore'
import { toast } from '../lib/toastStore'

// ── Icons ──────────────────────────────────────────────────────────────

function IconFolder(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2H4z" /></svg> }
function IconFolderOpen(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg> }
function IconClock(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
function IconStorage(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg> }
function IconCloudUpload(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg> }
function IconCloudDownload(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg> }
function IconUsers(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> }
function IconSearch(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> }
function IconFilter(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg> }
function IconMenu(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg> }
function IconGrid(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zm-10 10a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> }
function IconDots(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg> }
function IconSync(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> }
function IconSettings(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> }
function IconClose(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> }
function IconEye(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> }
function IconChevronDown(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg> }
function IconChevronRight(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg> }
function IconPlus(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg> }
function IconInfo(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
function IconMaximize(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg> }
function IconMinimize(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 14h6v6m10-10h-6V4m0 10l7 7M10 10L3 3" /></svg> }
function IconTrash(p) { return <svg {...p} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> }

// ── File Icons ─────────────────────────────────────────────────────────

const FileIcon = ({ type, className = "w-6 h-6" }) => {
  const colors = {
    PDF: 'text-red-500',
    DOCX: 'text-blue-600',
    XLSX: 'text-emerald-600',
    JPG: 'text-blue-500',
    PNG: 'text-blue-500'
  }
  const color = colors[type] || 'text-blue-500'

  if (type === 'PDF') {
    return <svg className={`${className} ${color}`} viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" /></svg>
  }
  if (type === 'DOCX') {
    return <svg className={`${className} ${color}`} viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1.8 14H10.5l-1-4.2-1 4.2H6.8l-1.5-6h1.7l.8 4.2 1-4.2h1.4l1 4.2.8-4.2h1.6l-1.4 6zM13 9V3.5L18.5 9H13z" /></svg>
  }
  if (type === 'XLSX') {
    return <svg className={`${className} ${color}`} viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-2.8 14h-1.7l-1.2-3.3-1.2 3.3H5.3l2.1-5-2-4.9h1.7l1 3.2 1-3.2h1.6l-2 4.9 2.1 5zM13 9V3.5L18.5 9H13z" /></svg>
  }
  // Generic Image for JPG
  return <svg className={`${className} ${color}`} viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>
}

// ── Header Actions ─────────────────────────────────────────────────────

function DmsHeaderActions({ loading, error, needsLogin, onSync }) {
  const isError = !loading && (!!error || needsLogin);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/api/uploads', formData);

      if (res && onSync) {
        onSync(); // Refresh dashboard data after upload
      }
    } catch (err) {
      console.error("Upload failed", err);
      toast.error(err.response?.data?.error || err.message || "Failed to upload document");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="hidden sm:flex items-center gap-2 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3.5 py-2 bg-white dark:bg-slate-900 shadow-xs">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">DMS Connection</span>
        <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : isError ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]' : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'}`}></div>
        <span className={`text-xs font-bold ${loading ? 'text-amber-500' : isError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {loading ? 'Checking...' : isError ? (needsLogin ? 'Auth Required' : 'Disconnected') : 'Connected'}
        </span>
      </div>

      <button
        onClick={onSync}
        disabled={loading}
        className="flex items-center gap-2 border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl px-3.5 py-2 shadow-xs text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
      >
        <IconSync className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-500' : 'text-slate-400'}`} />
        {loading ? 'Syncing...' : 'Sync Now'}
      </button>

      <a
        href={DMS_WEB_URL || 'https://base-layer.systems'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl px-3.5 py-2 shadow-xs text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
      >
        <IconSettings className="w-3.5 h-3.5 text-slate-400" />
        DMS Login
      </a>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
      />
      <button
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl px-4 py-2 shadow-xs hover:shadow-sm text-xs font-bold transition cursor-pointer disabled:opacity-50"
      >
        {uploading ? <IconSync className="w-3.5 h-3.5 animate-spin" /> : <IconCloudUpload className="w-3.5 h-3.5" />}
        {uploading ? 'Uploading...' : 'Upload Document'}
      </button>
    </div>
  )
}

// ── FolderNode Component ─────────────────────────────────────────────────
const FolderNode = ({ node, activeFolderId, setActiveFolderId, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(depth < 1) // Auto open first level
  const hasChildren = node.children && node.children.length > 0

  const handleClick = (e) => {
    e.stopPropagation()
    setActiveFolderId(node._id)
    if (hasChildren) {
      setIsOpen(!isOpen)
    }
  }

  const handleChevronClick = (e) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  const isSelected = activeFolderId === node._id

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2.5 py-2 text-xs font-semibold cursor-pointer rounded-xl transition ${
          isSelected
            ? 'bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
        }`}
        onClick={handleClick}
        style={{ paddingLeft: `${0.625 + depth * 1.25}rem` }}
      >
        {hasChildren ? (
          <div onClick={handleChevronClick} className="hover:bg-black/5 dark:hover:bg-white/10 rounded-lg p-0.5 -ml-1 flex items-center justify-center">
            {isOpen ? <IconChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <IconChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </div>
        ) : (
          <div className="w-4 h-4 shrink-0" />
        )}
        <IconFolder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#6366F1] dark:text-indigo-400' : 'text-blue-500 dark:text-blue-400'}`} />
        <span className="truncate">{node.name}</span>
      </div>

      {isOpen && hasChildren && (
        <div className="flex flex-col gap-1 mt-1">
          {node.children.map(child => (
            <FolderNode key={child._id} node={child} activeFolderId={activeFolderId} setActiveFolderId={setActiveFolderId} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Reference-matched stat card (Matching Forms page KPI card UI) ───── */
function KpiCard({ label, value, hint, icon, tone = 'neutral' }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    indigo: "bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400",
    emerald: "bg-[#E6F9F0] text-[#059669] dark:bg-emerald-950/60 dark:text-emerald-400",
    amber: "bg-[#FEF9E7] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-400",
    violet: "bg-[#F5F3FF] text-[#8B5CF6] dark:bg-purple-950/60 dark:text-purple-400",
    rose: "bg-[#FEE2E2] text-[#DC2626] dark:bg-rose-950/60 dark:text-rose-400"
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone] || tones.neutral}`}>
        {React.isValidElement(icon) ? React.cloneElement(icon, { className: 'w-4.5 h-4.5' }) : icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight tabular-nums">
            {value ?? '—'}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
            {label}
          </span>
        </div>
        {hint && <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">{hint}</div>}
      </div>
    </div>
  )
}

// ── Dashboard Component ────────────────────────────────────────────────

export default function DocumentsDashboard() {

  const [folders, setFolders] = useState([])
  const [documents, setDocuments] = useState([])
  const [activeDoc, setActiveDoc] = useState(null)
  const [activeDocUrl, setActiveDocUrl] = useState(null)
  const [activeDocUrlLoading, setActiveDocUrlLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [isTableMaximized, setIsTableMaximized] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ type: 'All', dateRange: 'Anytime' })
  const [tempFilters, setTempFilters] = useState({ type: 'All', dateRange: 'Anytime' })
  const [sortBy, setSortBy] = useState('newest')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [realStats, setRealStats] = useState(null)
  const [activeFolderId, setActiveFolderId] = useState(null)

  useEffect(() => {
    if (isFullscreenPreview) {
      setZoom(100)
    }
  }, [isFullscreenPreview])

  const now = new Date();
  const uploadedThisMonth = documents.filter(d => {
    const dDate = new Date(d.createdAt);
    return dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
  }).length;

  const usedBytes = realStats?.usedBytes ?? documents.reduce((acc, d) => acc + (d.sizeBytes || 0), 0);
  const usedMb = usedBytes / (1024 * 1024);
  const limitMb = realStats?.limitMb ?? (500 * 1024); // default 500 GB
  const storagePct = limitMb > 0 ? Math.round((usedMb / limitMb) * 100) : 0;

  let displayStorageUsed = '0 B';
  if (usedBytes < 1024) displayStorageUsed = `${usedBytes} B`;
  else if (usedBytes < 1024 * 1024) displayStorageUsed = `${(usedBytes / 1024).toFixed(1)} KB`;
  else if (usedBytes < 1024 * 1024 * 1024) displayStorageUsed = `${(usedBytes / (1024 * 1024)).toFixed(2)} MB`;
  else displayStorageUsed = `${(usedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;

  // Top level stats (dynamically generated from docs or real stats if provided)
  const stats = {
    totalDocs: realStats?.documentCount || documents.length || 0,
    docsTrend: 'Synced',
    totalFolders: folders.length || 0,
    foldersTrend: 'Synced',
    usedMb,
    displayStorageUsed,
    limitMb,
    storagePct,
    plan: realStats?.plan || 'Basic',
    orgName: realStats?.orgName,
    uploadedMonth: uploadedThisMonth,
    downloadedMonth: 0,
    sharedMonth: 0,
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [folderRes, docRes, statsRes] = await Promise.all([
        api.get('/api/dms/folders'),
        api.get('/api/dms/documents'),
        api.get('/api/dms/stats')
      ])

      let fetchedFolders = folderRes.folders || folderRes.data?.folders || []
      let fetchedDocs = docRes.documents || docRes.data?.documents || []
      let fetchedStats = statsRes.stats || statsRes.data?.stats || null

      setFolders(fetchedFolders)
      setDocuments(fetchedDocs)

      if (fetchedStats) {
        setRealStats(fetchedStats)
      }

    } catch (err) {
      console.error('Failed to load DMS data', err)
      if (err?.code === 'DMS_UNAUTHORIZED' || err.response?.data?.code === 'DMS_UNAUTHORIZED') {
        setNeedsLogin(true)
      } else {
        const msg = err.response?.data?.error || err.message || 'Failed to connect to DMS API. Please check your API key.'
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDmsLogin = async (e) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)
    try {
      await api.post('/api/organization/dms-login', { email: loginEmail, password: loginPassword })
      setNeedsLogin(false)
      loadData()
    } catch (err) {
      setLoginError(err?.data?.message || err?.message || 'Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (activeDoc) {
      setActiveDocUrl(activeDoc.fileUrl ? toAbsoluteUrl(activeDoc.fileUrl) : null)
      setActiveDocUrlLoading(true)
      api.get(`/api/dms/documents/${activeDoc._id}/url?mode=view`)
        .then(data => {
          if (data && data.url) {
            setActiveDocUrl(toAbsoluteUrl(data.url))
          } else if (activeDoc.fileUrl) {
            setActiveDocUrl(toAbsoluteUrl(activeDoc.fileUrl))
          }
        })
        .catch(() => {
          if (activeDoc.fileUrl) setActiveDocUrl(toAbsoluteUrl(activeDoc.fileUrl))
        })
        .finally(() => setActiveDocUrlLoading(false))
    } else {
      setActiveDocUrl(null)
      setActiveDocUrlLoading(false)
    }
  }, [activeDoc])

  const buildFolderTree = (flatFolders) => {
    const rootFolders = flatFolders.filter(f => !f.parentId)
    const mapChildren = (parent) => {
      const children = flatFolders.filter(f => f.parentId === parent._id)
      return {
        ...parent,
        isOpen: true,
        children: children.map(mapChildren)
      }
    }
    return rootFolders.map(mapChildren)
  }
  const folderTree = buildFolderTree(folders)

  const getDisplayType = (doc) => {
    if (!doc) return 'UNKNOWN';
    const nameExt = doc.name?.split('.').pop()?.toUpperCase();
    if (['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG', 'JPEG'].includes(nameExt)) {
      return nameExt === 'JPEG' || nameExt === 'PNG' ? 'JPG' : nameExt;
    }
    const typeStr = doc.type?.toUpperCase() || '';
    if (typeStr.includes('PDF')) return 'PDF';
    if (typeStr.includes('WORD') || typeStr.includes('DOCX')) return 'DOCX';
    if (typeStr.includes('EXCEL') || typeStr.includes('XLSX')) return 'XLSX';
    if (typeStr.includes('IMAGE') || typeStr.includes('JPG') || typeStr.includes('PNG')) return 'JPG';
    return typeStr;
  }

  const handleDeleteDoc = async (doc, e) => {
    e.stopPropagation()
    const ok = await confirm({
      title: 'Delete Document',
      message: `Are you sure you want to delete "${doc.name}"?\nThis cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true
    })
    if (!ok) return
    try {
      setLoading(true)
      const res = await api.delete(`/api/dms/documents/${doc._id}`)
      if (res) {
        if (activeDoc?._id === doc._id) {
          setActiveDoc(null)
          setActiveDocUrl(null)
        }
        await loadData()
      }
    } catch (err) {
      console.error("Delete failed", err)
      if (err?.code === 'DMS_UNAUTHORIZED' || err.response?.data?.code === 'DMS_UNAUTHORIZED') {
        setNeedsLogin(true)
      } else {
        toast.error(err.response?.data?.error || err.message || "Failed to delete document")
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AppShell title="Document Management System" mainClass="p-4 md:p-6 pb-24 md:pb-6 flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-semibold animate-pulse">Loading documents...</div>
      </AppShell>
    )
  }

  return (
    <AppShell
      title="Document Management System"
      subtitle="Manage, organize and access all your documents securely."
      actions={<DmsHeaderActions loading={loading} error={error} needsLogin={needsLogin} onSync={loadData} />}
      mainClass="p-4 md:p-6 pb-24 md:pb-6 flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <div className="flex-1 flex flex-col min-h-0 gap-5">

        {/* Top Metrics Row */}
        {!isTableMaximized && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
            <KpiCard
              label="Total Documents"
              value={stats.totalDocs.toLocaleString()}
              hint={stats.docsTrend || "Synced"}
              tone="indigo"
              icon={<IconFolder className="w-4.5 h-4.5" />}
            />
            <KpiCard
              label="Total Folders"
              value={stats.totalFolders}
              hint={stats.foldersTrend || "Synced"}
              tone="emerald"
              icon={<IconFolderOpen className="w-4.5 h-4.5" />}
            />
            <KpiCard
              label={`Storage Used (${stats.plan})`}
              value={stats.displayStorageUsed}
              hint={`of ${stats.limitMb >= 1024 ? `${Math.round(stats.limitMb / 1024)} GB` : `${stats.limitMb} MB`} (${stats.storagePct}%)`}
              tone="violet"
              icon={<IconClock className="w-4.5 h-4.5" />}
            />
            <KpiCard
              label="Uploaded"
              value={stats.uploadedMonth.toLocaleString()}
              hint="This Month"
              tone="amber"
              icon={<IconCloudUpload className="w-4.5 h-4.5" />}
            />
            <KpiCard
              label="Downloaded"
              value={stats.downloadedMonth}
              hint="This Month"
              tone="neutral"
              icon={<IconCloudDownload className="w-4.5 h-4.5" />}
            />
          </div>
        )}

        {/* Three Panel Main Layout */}
        <div className="flex-1 min-h-0 flex gap-4">

          {/* Left Panel: Folder Tree */}
          {!isTableMaximized && (
            <div className="w-64 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col min-h-0 shrink-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Folder Structure</h3>
                <div className="flex items-center gap-2">
                  <button onClick={loadData} title="Refresh Folders" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <IconSync className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="flex flex-col gap-1">
                  {folderTree.map(f => (
                    <FolderNode
                      key={f._id}
                      node={f}
                      activeFolderId={activeFolderId}
                      setActiveFolderId={setActiveFolderId}
                      depth={0}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Center Panel: Document List */}
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col min-h-0 min-w-0 overflow-hidden">
            {/* Breadcrumb & Toolbar */}
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                <span
                  className="hover:text-slate-900 dark:hover:text-white cursor-pointer transition"
                  onClick={() => setActiveFolderId(null)}
                >
                  {stats.orgName || 'Organization'}
                </span>
                <span className="text-slate-400">›</span>
                {activeFolderId ? (
                  <>
                    {/* Render intermediate breadcrumbs if it's a child folder */}
                    {(() => {
                      const activeF = folders.find(f => f._id === activeFolderId)
                      if (!activeF) return null
                      if (activeF.parentId) {
                        const parent = folders.find(f => f._id === activeF.parentId)
                        if (parent) {
                          return (
                            <>
                              <span
                                className="hover:text-slate-900 dark:hover:text-white cursor-pointer transition"
                                onClick={() => setActiveFolderId(parent._id)}
                              >
                                {parent.name}
                              </span>
                              <span className="text-slate-400">›</span>
                            </>
                          )
                        }
                      }
                      return null
                    })()}
                    <span className="text-slate-900 dark:text-white font-bold">{folders.find(f => f._id === activeFolderId)?.name || 'Folder'}</span>
                  </>
                ) : (
                  <span className="text-slate-900 dark:text-white font-bold">All Documents</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <IconSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search documents by name, type or tags..."
                    className="w-full pl-9 pr-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800/80 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white dark:focus:bg-slate-800 transition"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <button
                    onClick={() => {
                      if (!showFilters) setTempFilters(filters)
                      setShowFilters(!showFilters)
                    }}
                    className={`flex items-center gap-2 border border-slate-200/90 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold transition shrink-0 cursor-pointer shadow-2xs ${showFilters ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 bg-white dark:bg-slate-900'}`}
                  >
                    <IconFilter className="w-3.5 h-3.5 text-slate-400" /> Filters
                  </button>

                  {/* Filters Dropdown */}
                  {showFilters && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Filter Documents</h4>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Document Type</label>
                          <select
                            className="w-full text-xs font-medium bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            value={tempFilters.type}
                            onChange={(e) => setTempFilters({ ...tempFilters, type: e.target.value })}
                          >
                            <option value="All">All Types</option>
                            {[...new Set(documents.map(d => d.type).filter(Boolean))].map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Date Added</label>
                          <select
                            className="w-full text-xs font-medium bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            value={tempFilters.dateRange}
                            onChange={(e) => setTempFilters({ ...tempFilters, dateRange: e.target.value })}
                          >
                            <option value="Anytime">Anytime</option>
                            <option value="Last 7 Days">Last 7 Days</option>
                            <option value="Last 30 Days">Last 30 Days</option>
                            <option value="This Year">This Year</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setFilters({ type: 'All', dateRange: 'Anytime' })
                            setTempFilters({ type: 'All', dateRange: 'Anytime' })
                            setShowFilters(false)
                          }}
                          className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition px-3 py-1.5 cursor-pointer"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => {
                            setFilters(tempFilters)
                            setShowFilters(false)
                          }}
                          className="text-xs font-bold bg-[#6366F1] text-white hover:bg-[#4F46E5] transition px-3.5 py-1.5 rounded-xl shadow-xs cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <div
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="flex items-center gap-2 shrink-0 cursor-pointer border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 py-2 rounded-xl transition shadow-2xs"
                  >
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:inline">Sort: <strong className="text-slate-900 dark:text-white">{
                      sortBy === 'newest' ? 'Newest First' :
                        sortBy === 'oldest' ? 'Oldest First' :
                          sortBy === 'nameAsc' ? 'Name (A-Z)' :
                            sortBy === 'nameDesc' ? 'Name (Z-A)' :
                              sortBy === 'sizeDesc' ? 'Size (Largest)' :
                                'Size (Smallest)'
                    }</strong></span>
                    <IconChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:inline" />
                  </div>

                  {showSortMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-2">
                      {[
                        { id: 'newest', label: 'Newest First' },
                        { id: 'oldest', label: 'Oldest First' },
                        { id: 'nameAsc', label: 'Name (A-Z)' },
                        { id: 'nameDesc', label: 'Name (Z-A)' },
                        { id: 'sizeDesc', label: 'Size (Largest)' },
                        { id: 'sizeAsc', label: 'Size (Smallest)' }
                      ].map(option => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setSortBy(option.id)
                            setShowSortMenu(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-xs rounded-xl transition cursor-pointer ${sortBy === option.id ? 'bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setIsTableMaximized(!isTableMaximized)}
                  className="p-2 border border-slate-200/90 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-500 dark:text-slate-400 shrink-0 cursor-pointer shadow-2xs"
                  title={isTableMaximized ? "Restore Table View" : "Maximize Table View"}
                >
                  {isTableMaximized ? <IconMinimize className="w-4 h-4" /> : <IconMaximize className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Document Table */}
            <div className="flex-1 overflow-auto">
              {needsLogin ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/50 h-full">
                  <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">DMS Authentication Required</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Enter your credentials to connect to BaseLayer DMS.</p>
                    <form onSubmit={handleDmsLogin} className="flex flex-col gap-4">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Email Address</label>
                        <input
                          type="email"
                          placeholder="you@organization.com"
                          className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Password</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                        />
                      </div>

                      {loginError && (
                        <div className="p-3 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900">
                          {loginError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loginLoading}
                        className="mt-2 w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-2.5 rounded-xl transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer text-xs"
                      >
                        {loginLoading ? 'Connecting...' : 'Connect to BaseLayer'}
                      </button>
                    </form>
                  </div>
                </div>
              ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/50 h-full">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mb-3">
                    <IconInfo className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">DMS Connection Error</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-md">{error}</p>
                </div>
              ) : (() => {
                // Filter documents by activeFolderId and searchQuery
                let displayedDocs = documents

                if (activeFolderId) {
                  displayedDocs = displayedDocs.filter(doc => {
                    const folder = folders.find(f => f._id === activeFolderId)
                    if (!folder) return false
                    if (doc.folderPath && doc.folderPath.startsWith(folder._id)) return true
                    return doc.folderPath === folder.name || doc.department === folder.name
                  })
                }

                if (searchQuery.trim()) {
                  const q = searchQuery.toLowerCase()
                  displayedDocs = displayedDocs.filter(doc => {
                    const matchName = doc.name?.toLowerCase().includes(q)
                    const matchType = doc.type?.toLowerCase().includes(q)
                    const matchTags = doc.tags?.some(t => {
                      const tagText = typeof t === 'string' ? t : (t.v || t.k || JSON.stringify(t))
                      return tagText.toLowerCase().includes(q)
                    })
                    return matchName || matchType || matchTags
                  })
                }

                // Apply selected Filters (Type, Date Range)
                if (filters.type !== 'All') {
                  displayedDocs = displayedDocs.filter(doc => doc.type === filters.type)
                }

                if (filters.dateRange !== 'Anytime') {
                  const now = new Date()
                  displayedDocs = displayedDocs.filter(doc => {
                    if (!doc.createdAt) return false
                    const docDate = new Date(doc.createdAt)
                    if (filters.dateRange === 'Last 7 Days') {
                      return (now - docDate) <= (7 * 24 * 60 * 60 * 1000)
                    }
                    if (filters.dateRange === 'Last 30 Days') {
                      return (now - docDate) <= (30 * 24 * 60 * 60 * 1000)
                    }
                    if (filters.dateRange === 'This Year') {
                      return docDate.getFullYear() === now.getFullYear()
                    }
                    return true
                  })
                }

                // Apply Sorting
                if (sortBy === 'newest') displayedDocs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                else if (sortBy === 'oldest') displayedDocs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
                else if (sortBy === 'nameAsc') displayedDocs.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                else if (sortBy === 'nameDesc') displayedDocs.sort((a, b) => (b.name || '').localeCompare(a.name || ''))
                else if (sortBy === 'sizeDesc') displayedDocs.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0))
                else if (sortBy === 'sizeAsc') displayedDocs.sort((a, b) => (a.sizeBytes || 0) - (b.sizeBytes || 0))

                if (displayedDocs.length === 0) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50/50 dark:bg-slate-900/50 h-full text-slate-400 text-xs font-semibold">
                      No documents found in this folder.
                    </div>
                  )
                }

                return (
                  <table className="w-full text-left text-xs whitespace-nowrap min-w-[700px] border-collapse">
                    <thead className="sticky top-0 bg-slate-50/90 dark:bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider text-[10.5px] border-b border-slate-200 dark:border-slate-800 z-10">
                      <tr>
                        <th className="px-5 py-3 font-bold w-1/3">NAME</th>
                        <th className="px-4 py-3 font-bold">TYPE</th>
                        <th className="px-4 py-3 font-bold">UPLOADED BY</th>
                        <th className="px-4 py-3 font-bold">SIZE</th>
                        <th className="px-4 py-3 font-bold">MODIFIED</th>
                        <th className="px-5 py-3 font-bold text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {displayedDocs.map(doc => {
                        const isSelected = activeDoc?._id === doc._id
                        let uploadedByObj = doc.uploadedBy || {}
                        if (typeof doc.uploadedBy === 'string') {
                          uploadedByObj = { name: doc.uploadedBy }
                        }
                        const avatarStr = uploadedByObj.avatar || uploadedByObj.name?.substring(0, 2).toUpperCase() || 'U'

                        let displaySize = '0 B'
                        if (doc.sizeBytes) {
                          const size = doc.sizeBytes
                          if (size < 1024) displaySize = `${size} B`
                          else if (size < 1024 * 1024) displaySize = `${(size / 1024).toFixed(1)} KB`
                          else displaySize = `${(size / (1024 * 1024)).toFixed(2)} MB`
                        }

                        const displayDate = new Date(doc.createdAt).toLocaleDateString('en-GB')

                        return (
                          <tr
                            key={doc._id}
                            className={`group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer ${isSelected ? 'bg-indigo-50/70 dark:bg-indigo-950/30' : ''}`}
                            onClick={() => setActiveDoc(doc)}
                          >
                            <td className="px-5 py-3.5 flex items-center gap-3">
                              <FileIcon type={getDisplayType(doc)} className="w-5 h-5 shrink-0" />
                              <div className="min-w-0">
                                <p className={`font-semibold truncate max-w-[200px] xl:max-w-[250px] ${isSelected ? 'text-[#6366F1] dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>{doc.name}</p>
                                <div className="flex gap-1.5 mt-1">
                                  {doc.tags?.slice(0, 1).map((t, idx) => {
                                    const tagText = typeof t === 'string' ? t : (t.v || t.k || JSON.stringify(t))
                                    return (
                                      <span key={idx} className="text-[9.5px] px-2 py-0.5 rounded-md font-bold uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50">{tagText}</span>
                                    )
                                  })}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-medium text-slate-600 dark:text-slate-300">{doc.type}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-400">
                                  {avatarStr}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[11px]">{uploadedByObj.name || 'Unknown'}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{uploadedByObj.role || 'Member'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-medium text-slate-500 dark:text-slate-400 tabular-nums">{displaySize}</td>
                            <td className="px-4 py-3.5">
                              <p className="font-medium text-slate-500 dark:text-slate-400 text-[11px]">{displayDate}</p>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={(e) => handleDeleteDoc(doc, e)}
                                title="Delete Document"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition opacity-0 group-hover:opacity-100 cursor-pointer"
                              >
                                <IconTrash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              })()}
            </div>

            {/* Table Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/40">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {documents.length > 0
                  ? `Showing 1 to ${documents.length} of ${stats.totalDocs} documents`
                  : `Showing 0 documents`}
              </p>
              <div className="flex items-center gap-1 text-xs">
                <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold cursor-pointer">&lt;</button>
                <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#6366F1] text-white font-bold shadow-xs cursor-pointer">1</button>
                {documents.length > 0 && <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">2</button>}
                {documents.length > 0 && <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold cursor-pointer">&gt;</button>}
              </div>
            </div>
          </div>

          {/* Right Panel: Details Preview */}
          {activeDoc && !isTableMaximized && (() => {
            let uploadedByObj = activeDoc.uploadedBy || {}
            if (typeof activeDoc.uploadedBy === 'string') {
              uploadedByObj = { name: activeDoc.uploadedBy }
            }
            const avatarStr = uploadedByObj.avatar || uploadedByObj.name?.substring(0, 2).toUpperCase() || 'U'

            let displaySize = '0 B'
            if (activeDoc.sizeBytes) {
              const size = activeDoc.sizeBytes
              if (size < 1024) displaySize = `${size} B`
              else if (size < 1024 * 1024) displaySize = `${(size / 1024).toFixed(1)} KB`
              else displaySize = `${(size / (1024 * 1024)).toFixed(2)} MB`
            }
            const displayDate = new Date(activeDoc.createdAt).toLocaleDateString('en-GB')

            return (
              <div className="w-72 xl:w-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col min-h-0 shrink-0 relative overflow-hidden">
                <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <p className="font-bold text-xs text-slate-900 dark:text-white truncate flex-1 pr-2" title={activeDoc.name}>{activeDoc.name}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setIsFullscreenPreview(true)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition p-1.5 cursor-pointer" title="Maximize">
                      <IconMaximize className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setActiveDoc(null)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition p-1.5 cursor-pointer" title="Close">
                      <IconClose className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pb-4">
                  {/* Preview Thumbnail */}
                  <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 flex flex-col items-center justify-center min-h-[140px] border-b border-slate-100 dark:border-slate-800">
                    {activeDocUrl && !activeDocUrlLoading && getDisplayType(activeDoc) === 'JPG' ? (
                      <img src={activeDocUrl} alt={activeDoc.name} className="max-w-full max-h-[120px] rounded-xl shadow-xs mb-3 object-contain border border-slate-200/60 dark:border-slate-700" />
                    ) : activeDocUrl && !activeDocUrlLoading && getDisplayType(activeDoc) === 'PDF' ? (
                      <iframe src={activeDocUrl} className="w-full h-[120px] rounded-xl border border-slate-200/60 dark:border-slate-700 mb-3 bg-white" title="PDF Preview" />
                    ) : (
                      <FileIcon type={getDisplayType(activeDoc)} className="w-14 h-14 drop-shadow-xs mb-3" />
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => setIsFullscreenPreview(true)} className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition flex items-center gap-1.5 cursor-pointer"><IconEye className="w-3.5 h-3.5 text-slate-400" /> Preview</button>
                      <button
                        onClick={() => window.open(activeDocUrl || '#', '_blank')}
                        disabled={activeDocUrlLoading || !activeDocUrl}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <IconCloudDownload className="w-3.5 h-3.5 text-slate-400" /> {activeDocUrlLoading ? '...' : 'Download'}
                      </button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider px-4">
                    <div className="py-2.5 text-[#6366F1] dark:text-indigo-400 border-b-2 border-[#6366F1] dark:border-indigo-400">Details</div>
                  </div>

                  {/* Details List */}
                  <div className="p-4 space-y-3.5 text-xs">
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase tracking-wider">File Name</span>
                      <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200 break-words">{activeDoc.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase tracking-wider">File Type</span>
                      <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200">{activeDoc.type}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Size</span>
                      <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{displaySize}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 items-center">
                      <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Uploaded By</span>
                      <div className="col-span-2 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-400">
                          {avatarStr}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate text-[11px]">{uploadedByObj.name || 'Unknown'}</p>
                          <p className="text-[10px] text-slate-400 truncate leading-none mt-0.5">{uploadedByObj.role || 'Member'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Uploaded On</span>
                      <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{displayDate}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-start">
                      <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase tracking-wider mt-1">Tags</span>
                      <div className="col-span-2 flex flex-wrap gap-1.5">
                        {activeDoc.tags?.map((t, idx) => {
                          const tagText = typeof t === 'string' ? t : (t.v || t.k || JSON.stringify(t))
                          return (
                            <span key={idx} className="text-[9.5px] px-2 py-0.5 rounded-md font-bold uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50">{tagText}</span>
                          )
                        })}
                        <button className="text-[9.5px] px-2 py-0.5 rounded-md font-bold uppercase border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 transition flex items-center gap-0.5 cursor-pointer">
                          + Add Tag
                        </button>
                      </div>
                    </div>

                    {activeDoc.description && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Description</span>
                        <span className="col-span-2 text-slate-700 dark:text-slate-300 text-xs leading-relaxed">{activeDoc.description}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {isFullscreenPreview && activeDoc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 md:p-10 animate-in fade-in duration-150"
          onClick={() => setIsFullscreenPreview(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/80">
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <FileIcon type={getDisplayType(activeDoc)} className="w-6 h-6 shrink-0" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate max-w-lg">{activeDoc.name}</h3>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {/* Zoom Controls */}
                <div className="flex items-center bg-slate-200/80 dark:bg-slate-700/80 rounded-xl p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(50, z - 25))}
                    disabled={zoom <= 50}
                    title="Zoom Out (-)"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-40 transition cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(100)}
                    title="Reset Zoom"
                    className="px-2 h-7 flex items-center justify-center text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-600 rounded-lg transition tabular-nums cursor-pointer"
                  >
                    {zoom}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(300, z + 25))}
                    disabled={zoom >= 300}
                    title="Zoom In (+)"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-40 transition cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={() => setIsFullscreenPreview(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  title="Close (Esc)"
                >
                  <IconClose className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100/60 dark:bg-slate-950/60 flex flex-col items-start justify-center p-4 sm:p-6 md:p-8 overflow-auto min-h-0">
              {activeDocUrl && !activeDocUrlLoading && getDisplayType(activeDoc) === 'JPG' ? (
                <div
                  className="m-auto flex items-center justify-center transition-transform duration-150 ease-out origin-top"
                  style={{ transform: `scale(${zoom / 100})` }}
                >
                  <img src={activeDocUrl} alt={activeDoc.name} className="max-h-[70vh] max-w-full rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-md bg-white object-contain" />
                </div>
              ) : activeDocUrl && !activeDocUrlLoading && getDisplayType(activeDoc) === 'PDF' ? (
                <div
                  className="w-full h-full min-h-[65vh] transition-transform duration-150 ease-out origin-top flex items-center justify-center"
                  style={{ transform: `scale(${zoom / 100})` }}
                >
                  <iframe src={activeDocUrl} className="w-full h-full min-h-[65vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white" title="Document Preview" />
                </div>
              ) : (
                <div className="m-auto flex flex-col items-center justify-center text-center max-w-md">
                  <FileIcon type={getDisplayType(activeDoc)} className="w-24 h-24 drop-shadow-sm mb-4" />
                  <p className="text-slate-900 dark:text-white font-extrabold text-base mb-1">Previewing {getDisplayType(activeDoc)} Document</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-6">{activeDoc.sizeBytes ? `${(activeDoc.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : '0 MB'} • Uploaded by {activeDoc.uploadedBy?.name || 'Unknown'}</p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => window.open(activeDocUrl || '#', '_blank')}
                      disabled={activeDocUrlLoading || !activeDocUrl}
                      className="px-5 py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <IconCloudDownload className="w-4 h-4" /> {activeDocUrlLoading ? 'Loading...' : 'Download Document'}
                    </button>
                    <button
                      onClick={() => window.open(activeDocUrl || '#', '_blank')}
                      disabled={activeDocUrlLoading || !activeDocUrl}
                      className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-xs transition hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <IconEye className="w-4 h-4" /> {activeDocUrlLoading ? 'Loading...' : 'Open in Browser'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </AppShell>
  )
}
