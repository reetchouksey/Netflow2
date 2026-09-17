import React, { useState, useEffect, useRef } from 'react'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { toast } from '../lib/toastStore'
import { confirm } from '../lib/confirmStore'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const val = bytes / Math.pow(1024, i)
  return `${val < 10 ? val.toFixed(1) : Math.round(val * 10) / 10} ${units[i]}`
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).replace(/am|pm/i, (m) => m.toLowerCase())
}

const getFileType = (filename = '', mimetype = '') => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext) || mimetype?.startsWith('image/')) {
    return 'image'
  }
  if (ext === 'pdf' || mimetype === 'application/pdf') {
    return 'pdf'
  }
  if (['txt', 'csv', 'json', 'md', 'log', 'js', 'ts', 'html', 'css', 'xml'].includes(ext) || mimetype?.startsWith('text/')) {
    return 'text'
  }
  return 'other'
}

const getFileIcon = (filename = '', mimetype = '') => {
  const type = getFileType(filename, mimetype)
  if (type === 'image') {
    return (
      <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  }
  if (type === 'pdf') {
    return (
      <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
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

export default function S3Storage() {
  const [files, setFiles] = useState([])
  const [bucket, setBucket] = useState('reet')
  const [region, setRegion] = useState('auto')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [zoom, setZoom] = useState(100)
  const fileInputRef = useRef(null)

  const loadFiles = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/s3/files')
      setFiles(res.files || [])
      if (res.bucket) setBucket(res.bucket)
      if (res.region) setRegion(res.region)
    } catch (err) {
      toast.error(err.message || 'Failed to load S3 files')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [])

  // Close preview with Escape key & reset zoom
  useEffect(() => {
    setZoom(100)
    const onKey = (e) => {
      if (e.key === 'Escape' && previewFile) {
        setPreviewFile(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewFile])

  const uploadFile = async (file) => {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      await api.post('/api/s3/upload', formData)
      toast.success(`"${file.name}" uploaded to S3 successfully`)
      await loadFiles()
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  // ── Two-step Delete Confirmation ───────────────────────────────────────────
  const handleDelete = async (file) => {
    // 1st Confirmation
    const firstConfirm = await confirm({
      title: 'Delete S3 Object',
      message: `Are you sure you want to delete "${file.originalName}"?`,
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
      danger: true
    })
    if (!firstConfirm) return

    // 2nd Confirmation (Explicit permanent deletion warning)
    const secondConfirm = await confirm({
      title: 'Permanently Delete File',
      message: `Are you absolutely sure?\nThis action will permanently delete "${file.originalName}" from S3 storage and the database. This action cannot be undone.`,
      confirmLabel: 'Delete permanently',
      cancelLabel: 'Cancel',
      danger: true
    })
    if (!secondConfirm) return

    try {
      await api.delete(`/api/s3/files/${file._id}`)
      toast.success('File permanently deleted from S3')
      if (previewFile?._id === file._id) setPreviewFile(null)
      setFiles((prev) => prev.filter((f) => f._id !== file._id))
    } catch (err) {
      toast.error(err.message || 'Failed to delete file')
    }
  }

  // ── Real File Download ─────────────────────────────────────────────────────
  const handleDownload = (file) => {
    if (!file) return
    const downloadUrl = file.url
      ? (file.url.includes('?') ? `${file.url}&download=1` : `${file.url}?download=1`)
      : `/api/s3/files/${file._id}/download`

    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = file.originalName || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ── In-page File View ──────────────────────────────────────────────────────
  const handleView = (file) => {
    setPreviewFile(file)
  }

  const totalBytes = files.reduce((sum, f) => sum + (Number(f.size) || 0), 0)

  return (
    <AppShell
      title="S3 Storage"
      subtitle="Manage, upload and access all your Amazon S3 storage objects securely."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3.5 py-2 bg-white dark:bg-slate-900 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">S3 Connection</span>
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'}`} />
            <span className={`text-xs font-bold ${loading ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {loading ? 'Checking...' : 'Connected'}
            </span>
          </div>

          <button
            type="button"
            onClick={loadFiles}
            disabled={loading}
            className="flex items-center gap-2 border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl px-3.5 py-2 shadow-xs text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin text-indigo-500' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{loading ? 'Syncing...' : 'Refresh Files'}</span>
          </button>

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl px-4 py-2 shadow-xs hover:shadow-sm text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${uploading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
          </button>
        </div>
      }
      mainClass="p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto min-h-0 flex-1"
    >
      <div className="space-y-5">
        
        {/* ── Stats Cards (Matching Forms Page RefStatCard UI) ───────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <KpiCard
            label="Synced Objects"
            value={files.length}
            hint="0 pending"
            tone="indigo"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
          />
          <KpiCard
            label="Storage Consumed"
            value={fmtBytes(totalBytes)}
            hint="in this bucket"
            tone="emerald"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>}
          />
          <KpiCard
            label="Storage Bucket"
            value={bucket || '—'}
            hint={`Region: ${region || 'auto'}`}
            tone="amber"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>}
          />
          <KpiCard
            label="S3 Status"
            value="Connected"
            hint="Live sync active"
            tone="violet"
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
          />
        </div>

        {/* ── Main Section: Folders & Files Grid ─────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          
          {/* Folders Sidebar Card */}
          <div className="w-full lg:w-64 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 shrink-0">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Folders
            </div>
            <div>
              <button
                type="button"
                className="w-full bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 border border-indigo-200/50 dark:border-indigo-800/50 transition cursor-default"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M4 4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2H4z" />
                </svg>
                <span>Root Directory</span>
              </button>
            </div>
          </div>

          {/* Files Container Column */}
          <div className="flex-1 w-full space-y-4">
            
            {/* Drag & Drop Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-7 border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer shadow-xs group ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                disabled={uploading}
                className="hidden"
              />

              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5 shadow-2xs group-hover:scale-105 transition-transform">
                {uploading ? (
                  <svg className="w-5 h-5 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
              </div>

              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {uploading ? 'Uploading file to S3...' : 'Drag and drop file here or click to browse'}
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                {uploading ? 'Please wait while file is stored in your dedicated bucket' : 'Upload files directly to root'}
              </div>
            </div>

            {/* Files List / Table Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-slate-400 text-xs font-semibold animate-pulse">
                  Loading S3 objects...
                </div>
              ) : files.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                      <path d="M4 4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2H4z" />
                    </svg>
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    No files in this folder
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                    Files uploaded to S3 in this bucket will appear here.
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse table-auto">
                    <thead className="bg-slate-50/90 dark:bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider text-[10.5px] border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th scope="col" className="px-5 py-3 text-left font-bold tracking-wider">NAME</th>
                        <th scope="col" className="px-4 py-3 text-left font-bold tracking-wider">SIZE</th>
                        <th scope="col" className="px-4 py-3 text-left font-bold tracking-wider">MODIFIED</th>
                        <th scope="col" className="px-5 py-3 text-right font-bold tracking-wider">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {files.map((file) => (
                        <tr key={file._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          {/* Name */}
                          <td className="px-5 py-3.5 align-middle">
                            <div
                              onClick={() => handleView(file)}
                              className="flex items-center gap-2.5 min-w-[180px] cursor-pointer group"
                            >
                              {getFileIcon(file.originalName, file.mimetype)}
                              <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate max-w-sm" title={file.originalName}>
                                {file.originalName}
                              </span>
                            </div>
                          </td>

                          {/* Size */}
                          <td className="px-4 py-3.5 align-middle font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {fmtBytes(file.size)}
                          </td>

                          {/* Modified */}
                          <td className="px-4 py-3.5 align-middle font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(file.createdAt)}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 align-middle text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Preview / View on same page */}
                              <button
                                type="button"
                                onClick={() => handleView(file)}
                                title="View object"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>

                              {/* Download */}
                              <button
                                type="button"
                                onClick={() => handleDownload(file)}
                                title="Download object"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>

                              {/* Delete (with double confirmation) */}
                              <button
                                type="button"
                                onClick={() => handleDelete(file)}
                                title="Delete object"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Showing {files.length} {files.length === 1 ? 'object' : 'objects'}
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* ── In-Page Document Viewer Modal ─────────────────────────────────── */}
      {previewFile && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 md:p-10 animate-in fade-in duration-150"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/80">
              <div className="flex items-center gap-3 min-w-0 pr-4">
                {getFileIcon(previewFile.originalName, previewFile.mimetype)}
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate" title={previewFile.originalName}>
                    {previewFile.originalName}
                  </h3>
                  <div className="text-[11px] font-medium text-slate-400">
                    {fmtBytes(previewFile.size)} • {formatDate(previewFile.createdAt)}
                  </div>
                </div>
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
                  type="button"
                  onClick={() => handleDownload(previewFile)}
                  className="px-3.5 py-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  title="Close (Esc)"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body: Document / File Viewer */}
            <div className="flex-1 bg-slate-100/60 dark:bg-slate-950/60 p-4 sm:p-6 flex items-start justify-center overflow-auto min-h-0">
              {getFileType(previewFile.originalName, previewFile.mimetype) === 'image' ? (
                <div
                  className="flex items-center justify-center transition-transform duration-150 ease-out origin-top"
                  style={{ transform: `scale(${zoom / 100})` }}
                >
                  <img
                    src={previewFile.url}
                    alt={previewFile.originalName}
                    className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-md border border-slate-200/50 dark:border-slate-800 bg-white"
                  />
                </div>
              ) : getFileType(previewFile.originalName, previewFile.mimetype) === 'pdf' || getFileType(previewFile.originalName, previewFile.mimetype) === 'text' ? (
                <div
                  className="w-full h-full min-h-[65vh] transition-transform duration-150 ease-out origin-top flex items-center justify-center"
                  style={{ transform: `scale(${zoom / 100})` }}
                >
                  <iframe
                    src={previewFile.url}
                    className="w-full h-full min-h-[65vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white shadow-sm"
                    title={previewFile.originalName}
                  />
                </div>
              ) : (
                <div className="text-center p-8 flex flex-col items-center justify-center max-w-md m-auto">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-xs">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                    Preview not available
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                    This file format cannot be displayed directly in the browser. You can download the original file to view it locally.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDownload(previewFile)}
                    className="px-5 py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center gap-2 transition cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download {previewFile.originalName}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </AppShell>
  )
}
