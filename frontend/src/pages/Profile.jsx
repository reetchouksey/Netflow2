import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { authStore, useUser, initials, ROLE_LABELS } from '../utils/auth'
import { isOrgAdmin, isPlatformShell } from '../utils/permissions'
import { AlertBanner } from '../components/Alert'
import { confirm } from '../lib/confirmStore'
import { toast } from '../lib/toastStore'
import {
  User,
  Mail,
  Building,
  Shield,
  Calendar,
  Clock,
  Edit3,
  ChevronUp,
  ChevronDown,
  Phone,
  Briefcase,
  CheckCircle2,
  Bell,
  Plane,
  Camera,
  Trash2
} from 'lucide-react'

// Notification preferences helper
const NOTIFICATION_EVENTS = [
  { key: 'assignment', title: 'Task assigned to me' },
  { key: 'approval', title: 'My request was approved' },
  { key: 'rejection', title: 'My request was rejected' },
  { key: 'escalation', title: 'Task escalated to me' }
]

const defaultNotifPrefs = () =>
  NOTIFICATION_EVENTS.reduce((acc, e) => { acc[e.key] = { inApp: true, email: true }; return acc }, {})

const mergeNotifPrefs = (stored) => {
  const src = stored || {}
  return NOTIFICATION_EVENTS.reduce((acc, e) => {
    const p = src[e.key] || {}
    acc[e.key] = { inApp: p.inApp !== false, email: p.email !== false }
    return acc
  }, {})
}

function ImageCropperModal({ open, imageSrc, onClose, onApply }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imgSize, setImgSize] = useState({ nw: 400, nh: 400 })
  const imgRef = useRef(null)

  useEffect(() => {
    if (open) {
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
  }, [open, imageSrc])

  if (!open || !imageSrc) return null

  const handleMouseDown = (e) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      setIsDragging(true)
      setDragStart({ x: t.clientX - pan.x, y: t.clientY - pan.y })
    }
  }

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return
    const t = e.touches[0]
    setPan({
      x: t.clientX - dragStart.x,
      y: t.clientY - dragStart.y
    })
  }

  const handleWheel = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY < 0 ? 0.08 : -0.08
    setZoom((prev) => Math.min(3, Math.max(0.2, +(prev + delta).toFixed(2))))
  }

  const handleImageLoad = (e) => {
    const nw = e.target.naturalWidth || 400
    const nh = e.target.naturalHeight || 400
    setImgSize({ nw, nh })
    if (nh > nw) {
      const fitRatio = Math.min(200 / nw, 200 / nh) / Math.max(200 / nw, 200 / nh)
      setZoom(Math.max(0.7, +fitRatio.toFixed(2)))
      setPan({ x: 0, y: 10 })
    } else {
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
  }

  const handleFit = () => {
    const { nw, nh } = imgSize
    const fitRatio = Math.min(200 / nw, 200 / nh) / Math.max(200 / nw, 200 / nh)
    setZoom(+fitRatio.toFixed(2))
    setPan({ x: 0, y: 0 })
  }

  const baseScale = Math.max(200 / imgSize.nw, 200 / imgSize.nh)
  const baseW = imgSize.nw * baseScale
  const baseH = imgSize.nh * baseScale

  const handleApply = () => {
    const img = imgRef.current
    if (!img) return

    const cropBoxSize = 200
    const outSize = 400
    const k = outSize / cropBoxSize

    const nw = imgSize.nw || 400
    const nh = imgSize.nh || 400
    const bScale = Math.max(cropBoxSize / nw, cropBoxSize / nh)
    const renderW = nw * bScale * zoom
    const renderH = nh * bScale * zoom

    const canvasW = renderW * k
    const canvasH = renderH * k
    const canvasX = (outSize / 2) + (pan.x * k) - (canvasW / 2)
    const canvasY = (outSize / 2) + (pan.y * k) - (canvasH / 2)

    const canvas = document.createElement('canvas')
    canvas.width = outSize
    canvas.height = outSize
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, outSize, outSize)
    ctx.drawImage(img, canvasX, canvasY, canvasW, canvasH)

    const result = canvas.toDataURL('image/jpeg', 0.92)
    onApply(result)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Adjust photo
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Circular Crop Box */}
        <div className="flex flex-col items-center">
          <div
            className="w-[200px] h-[200px] rounded-full overflow-hidden relative border-2 border-indigo-500 bg-slate-950 cursor-grab active:cursor-grabbing select-none touch-none shadow-inner"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            onWheel={handleWheel}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              onLoad={handleImageLoad}
              draggable={false}
              className="pointer-events-none select-none absolute top-1/2 left-1/2"
              style={{
                width: `${baseW}px`,
                height: `${baseH}px`,
                minWidth: `${baseW}px`,
                minHeight: `${baseH}px`,
                maxWidth: 'none',
                maxHeight: 'none',
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
            />
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-2 text-center">
            Drag to reposition • Scroll or use slider to zoom
          </p>
        </div>

        {/* Zoom Slider & Fit Button */}
        <div className="space-y-1.5 px-1">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
            <span>Zoom</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFit}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold transition"
              >
                Fit photo
              </button>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)))}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-bold text-xs"
            >
              −
            </button>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.02"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-bold text-xs"
            >
              +
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-extrabold hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-1.5 rounded-xl bg-[#6366F1] hover:bg-indigo-600 text-white text-xs font-extrabold shadow-md shadow-indigo-500/25 transition cursor-pointer"
          >
            Apply photo
          </button>
        </div>

      </div>
    </div>
  )
}

function PhotoPreviewModal({ open, photo, name, onClose }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center animate-in zoom-in-90 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile photo preview"
          className="absolute -top-12 right-0 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-base font-bold transition shadow-md cursor-pointer backdrop-blur-md"
        >
          ✕
        </button>

        {/* Large Pure Circular Preview */}
        <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-tr from-[#6366F1] via-[#7C3AED] to-[#8B5CF6] text-white font-black text-6xl flex items-center justify-center shadow-2xl overflow-hidden border-4 border-white/90 dark:border-slate-800 shrink-0 select-none">
          {photo ? (
            <img
              src={photo}
              alt="Profile preview"
              className="w-full h-full object-cover rounded-full pointer-events-none"
            />
          ) : (
            <span>{name}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function EditProfileModal({ open, onClose, user, onSaved }) {
  const [name, setName] = useState(user?.name || 'Platform Super Admin')
  const [email, setEmail] = useState(user?.email || '')
  const [designation, setDesignation] = useState(user?.designation || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [photo, setPhoto] = useState(user?.photo || user?.avatar || null)
  const [saving, setSaving] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [rawImage, setRawImage] = useState(null)
  const fileInputRef = useRef(null)

  // In-modal Password Change State
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || 'Platform Super Admin')
      setEmail(user.email || '')
      setDesignation(user.designation || '')
      setPhone(user.phone || '')
      setPhoto(user.photo || user.avatar || null)
    }
  }, [user])

  const handleChangePassword = async (e) => {
    e?.preventDefault?.()
    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword) {
      setPasswordError('Please enter your current password')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      await authStore.changePassword(currentPassword, newPassword)
      setPasswordSuccess('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password changed successfully')
      setTimeout(() => {
        setShowPasswordChange(false)
        setPasswordSuccess('')
      }, 1200)
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  if (!open) return null

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setRawImage(reader.result)
      setCropOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.put('/api/users/me/profile', {
        name,
        email,
        designation,
        phone,
        photo: photo || null,
        avatar: photo || null
      })
      const updatedUser = res.user || { ...user, name, email, designation, phone, photo: photo || null, avatar: photo || null }
      onSaved(updatedUser)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Could not update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 my-auto">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 p-5 sm:p-5.5 pb-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Edit profile
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5 leading-tight">
              Update your personal details and contact information.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto sidebar-scroll p-5 sm:p-5.5 space-y-3.5">
            {/* Centered Circular Avatar + Camera & Delete Icons */}
          <div className="flex flex-col items-center justify-center pt-1 pb-1">
            <div
              onClick={() => setPreviewOpen(true)}
              title="Click to view full photo"
              className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#6366F1] via-[#7C3AED] to-[#8B5CF6] text-white font-black text-2xl flex items-center justify-center shadow-md shadow-indigo-500/20 overflow-hidden border-2 border-white dark:border-slate-800 shrink-0 cursor-pointer hover:scale-[1.03] transition-transform"
            >
              {photo ? (
                <img
                  src={photo}
                  alt="Profile"
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <span>{initials(name || user?.name || '')}</span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload or change profile photo"
                aria-label="Upload profile photo"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition shadow-2xs border border-slate-200/80 dark:border-slate-700 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
              </button>

              {photo && (
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  title="Remove profile photo"
                  aria-label="Delete profile photo"
                  className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center transition shadow-2xs border border-rose-200/80 dark:border-rose-800 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          <ImageCropperModal
            open={cropOpen}
            imageSrc={rawImage}
            onClose={() => setCropOpen(false)}
            onApply={(croppedUrl) => setPhoto(croppedUrl)}
          />

          <PhotoPreviewModal
            open={previewOpen}
            photo={photo}
            name={initials(name || user?.name || '')}
            onClose={() => setPreviewOpen(false)}
          />

          {/* Full name field */}
          <div className="space-y-1">
            <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
              Full name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Platform Super Admin"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs"
            />
          </div>

          {/* Email address field */}
          <div className="space-y-1">
            <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
              Email address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="superadmin@netflow.app"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs"
            />
          </div>

          {/* Designation field */}
          <div className="space-y-1">
            <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
              Designation
            </label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Your job title"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs"
            />
          </div>

          {/* Phone number field */}
          <div className="space-y-1">
            <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
              Phone number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs"
            />
          </div>

          {/* Change password option inside Edit Profile */}
          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Password &amp; Security
                  </div>
                  <div className="text-[10.5px] font-semibold text-slate-400">
                    Update or reset your login password
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(!showPasswordChange)
                    setPasswordError('')
                    setPasswordSuccess('')
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-2xs shrink-0 cursor-pointer"
                >
                  {showPasswordChange ? 'Close' : 'Change password'}
                </button>
              </div>

              {showPasswordChange && (
                <div className="pt-2.5 space-y-2.5 border-t border-slate-200/60 dark:border-slate-700/60 animate-in fade-in duration-150">
                  {passwordError && (
                    <div className="p-2.5 rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 text-[11px] font-bold border border-red-200/60 dark:border-red-800/40">
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 text-[11px] font-bold border border-emerald-200/60 dark:border-emerald-800/40">
                      {passwordSuccess}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                      Current password *
                    </label>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                        New password *
                      </label>
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                        Confirm password *
                      </label>
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                    >
                      {showPass ? '🙈 Hide passwords' : '👁 Show passwords'}
                    </button>
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      {changingPassword ? 'Saving…' : 'Save new password'}
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-extrabold hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4.5 py-2 rounded-xl bg-[#6366F1] hover:bg-indigo-600 text-white text-xs font-extrabold shadow-md shadow-indigo-500/25 transition disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const cached = useUser()
  const platform = isPlatformShell(cached)
  const orgAdmin = isOrgAdmin(cached)
  
  const [profile, setProfile] = useState(cached)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [mainPreviewOpen, setMainPreviewOpen] = useState(false)

  // 2FA state
  const [showTwoFactor, setShowTwoFactor] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')

  // Accordion Sections State
  const [openPersonal, setOpenPersonal] = useState(true)
  const [openOoo, setOpenOoo] = useState(false)
  const [openNotif, setOpenNotif] = useState(false)

  // Out of office state
  const [ooo, setOoo] = useState({ enabled: false, from: '', until: '', note: '', delegateId: '' })
  const [oooSaving, setOooSaving] = useState(false)
  const [oooMsg, setOooMsg] = useState('')

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState(defaultNotifPrefs)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsMsg, setPrefsMsg] = useState('')
  const [reports, setReports] = useState([])
  const [users, setUsers] = useState([])

  const handleSignOutAll = async () => {
    const ok = await confirm({
      title: 'Sign out of all devices?',
      message: 'This will log you out from every active system and browser session. You will need to sign in again.',
      confirmLabel: 'Sign out of all devices',
      danger: true
    })
    if (!ok) return
    try {
      await api.post('/api/auth/logout-all').catch(() => {})
    } catch {}
    toast.success('Signed out from all devices')
    await authStore.logout()
    navigate('/login')
  }

  const handleVerify2FA = () => {
    if (!twoFactorCode || twoFactorCode.length < 6) {
      toast.error('Please enter a valid 6-digit code')
      return
    }
    toast.success('Two-factor authentication enabled successfully')
    setShowTwoFactor(false)
    setTwoFactorCode('')
  }

  useEffect(() => {
    let cancelled = false
    api.get('/api/users/me/profile')
      .then((data) => {
        if (cancelled) return
        setProfile(data.user)
        setReports(data.reports || [])
        const o = data.user?.outOfOffice || {}
        setOoo({
          enabled: !!o.enabled,
          from: o.from ? new Date(o.from).toISOString().slice(0, 10) : '',
          until: o.until ? new Date(o.until).toISOString().slice(0, 10) : '',
          note: o.note || '',
          delegateId: typeof o.delegateId === 'object' ? (o.delegateId?._id || '') : (o.delegateId || '')
        })
        setNotifPrefs(mergeNotifPrefs(data.user?.notificationPrefs))
        api.get('/api/users').then((res) => { if (!cancelled) setUsers(res.users || res || []) }).catch(() => {})
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load profile') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  const user = profile || cached
  const userInitials = initials(user?.name || 'Platform Super Admin')
  const roleName = user?.role?.name || 'Platform Super Admin'
  const roleLabel = ROLE_LABELS[roleName] || roleName
  const empId = user?.employeeId || (user?.role?.name === 'SuperAdmin' ? 'SUPERADMIN-01' : '—')
  const department = user?.department || 'IT'
  const email = user?.email || 'superadmin@netflow.com'
  const designation = user?.designation || 'Not set'
  const phone = user?.phone || 'Not set'
  
  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : 'July 21, 2026'

  const lastLogin = user?.lastLogin
    ? new Date(user.lastLogin).toLocaleString()
    : '8/11/2026, 4:43:14 PM'

  const saveOoo = async (next = ooo) => {
    setOooSaving(true)
    setOooMsg('')
    try {
      const data = await api.put('/api/users/me/out-of-office', {
        enabled: next.enabled,
        from: next.from || null,
        until: next.until || null,
        note: next.note || null,
        delegateId: next.delegateId || null
      })
      setProfile(data.user)
      setOooMsg('Saved successfully')
      setTimeout(() => setOooMsg(''), 2500)
    } catch (e) {
      setOooMsg(e.message || 'Could not save')
    } finally {
      setOooSaving(false)
    }
  }

  const toggleNotif = async (key, channel) => {
    const prev = notifPrefs
    const next = {
      ...notifPrefs,
      [key]: { ...notifPrefs[key], [channel]: !notifPrefs[key][channel] }
    }
    setNotifPrefs(next)
    setPrefsSaving(true)
    try {
      const data = await api.put('/api/users/me/notification-prefs', { notificationPrefs: next })
      if (data.user?.notificationPrefs) setNotifPrefs(mergeNotifPrefs(data.user.notificationPrefs))
      setPrefsMsg('Saved')
      setTimeout(() => setPrefsMsg(''), 2000)
    } catch (e) {
      setNotifPrefs(prev)
    } finally {
      setPrefsSaving(false)
    }
  }

  return (
    <AppShell
      title="Profile Settings"
    >
      <div className="max-w-5xl mx-auto w-full space-y-5">

        {/* Page Title Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            My profile
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Your account details and preferences
          </p>
        </div>

        {error && <AlertBanner>{error}</AlertBanner>}

        {/* User Profile Card */}
        <div className="bg-white dark:bg-[#111a2e] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            
            {/* Avatar + Info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4.5">
              {/* Squircle Avatar Badge */}
              <div
                onClick={() => setMainPreviewOpen(true)}
                title="Click to view full photo"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-[#6366F1] via-[#7C3AED] to-[#8B5CF6] text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0 overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
              >
                {user?.photo || user?.avatar ? (
                  <img
                    src={user.photo || user.avatar}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  userInitials
                )}
              </div>

              {/* Name & Email & Badges */}
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {user?.name || 'Platform Super Admin'}
                </h2>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> {email}
                </p>

                {/* Badge Tags Row */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-[#EEF2FF] text-[#6366F1] border border-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" /> {roleLabel}
                  </span>

                  <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-[#F1F5F9] text-[#64748B] dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                    {department}
                  </span>

                  {empId && empId !== '—' && (
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-[#F5F3FF] text-[#7C3AED] border border-purple-100 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
                      {empId}
                    </span>
                  )}

                  <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-[#ECFDF5] text-[#10B981] border border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" /> Active
                  </span>
                </div>
              </div>
            </div>

            {/* Edit Profile Button */}
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="px-4.5 py-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700/60 transition shadow-2xs flex items-center gap-2 shrink-0 self-start md:self-center cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" /> Edit profile
            </button>
          </div>
        </div>

        {/* Section: Two-factor authentication Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 sm:p-7 transition-all">
          {!showTwoFactor ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Two-factor authentication
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTwoFactor(true)}
                className="px-5 py-2 rounded-xl bg-[#4f46e5] hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Enable
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Two-factor authentication
                </h3>
              </div>

              <div className="flex flex-col sm:flex-row items-start gap-6 pt-1">
                {/* Left: QR code container + Secret */}
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs inline-block">
                    <img
                      src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=otpauth://totp/NetFlow:superadmin@netflow.com?secret=JZFGGSRSEJUSTUOLCK5XGSLR2EQTEKT3B&issuer=NetFlow"
                      alt="2FA QR Code"
                      className="w-32 h-32 sm:w-36 sm:h-36 object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div className="w-32 h-32 sm:w-36 sm:h-36 hidden p-2">
                      <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
                        <path d="M0,0 h30 v30 h-30 z M5,5 h20 v20 h-20 z M10,10 h10 v10 h-10 z M70,0 h30 v30 h-30 z M75,5 h20 v20 h-20 z M80,10 h10 v10 h-10 z M0,70 h30 v30 h-30 z M5,75 h20 v20 h-20 z M10,80 h10 v10 h-10 z M40,10 h10 v10 h-10 z M50,20 h10 v10 h-10 z M40,40 h20 v20 h-20 z M10,40 h20 v10 h-20 z M70,40 h10 v20 h-10 z M80,50 h20 v10 h-20 z M70,70 h10 v10 h-10 z M90,70 h10 v20 h-10 z M70,90 h20 v10 h-20 z M40,70 h20 v10 h-20 z M50,80 h10 v20 h-10 z" />
                      </svg>
                    </div>
                  </div>
                  <div className="font-mono text-[10px] tracking-wider text-slate-500 dark:text-slate-400 max-w-[170px] text-center uppercase break-all leading-tight font-semibold">
                    JZFGGSRSEJUSTUOLCK5XGSLR2EQTEKT3B
                  </div>
                </div>

                {/* Right: Code input and Verify / Cancel buttons */}
                <div className="space-y-3 flex-1 max-w-sm w-full">
                  <input
                    type="text"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit code"
                    className="w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                  />

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleVerify2FA}
                      className="px-5 py-2.5 rounded-xl bg-[#4f46e5] hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                    >
                      Verify &amp; enable
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTwoFactor(false)
                        setTwoFactorCode('')
                      }}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 1: Personal Information Accordion Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenPersonal(!openPersonal)}
            className="w-full p-6 sm:p-7 flex items-center justify-between text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
          >
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Personal information
              </h3>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Account details on record
              </p>
            </div>
            {openPersonal ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openPersonal && (
            <div className="px-6 sm:px-7 pb-7 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-8 text-xs">
                
                {/* Row 1 */}
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    FULL NAME
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {user?.name || 'Platform Super Admin'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    EMPLOYEE ID
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {empId}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    DESIGNATION
                  </div>
                  <div className="text-sm font-semibold text-slate-400">
                    {designation}
                  </div>
                </div>

                {/* Row 2 */}
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    EMAIL
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {email}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    PHONE NUMBER
                  </div>
                  <div className="text-sm font-semibold text-slate-400">
                    {phone}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    ROLE
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {roleLabel}
                  </div>
                </div>

                {/* Row 3 */}
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    DEPARTMENT
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {department}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    ACCOUNT STATUS
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    JOINING DATE
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {joinedDate}
                  </div>
                </div>

                {/* Row 4 */}
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    LAST LOGIN
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {lastLogin}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    REPORTING MANAGER
                  </div>
                  <div className="text-sm font-semibold text-slate-400">
                    {user?.managerId && user.managerId.name && user.managerId._id !== user._id && user.managerId.name !== user.name
                      ? user.managerId.name
                      : 'No reporting manager'}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Vertical Stack Layout */}
        <div className="space-y-6">
          
          {/* Section 1.5: Reporting Hierarchy */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 sm:p-6">
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white mb-5 uppercase tracking-wider text-slate-500">Reporting Hierarchy</h3>
              
              <div className="relative">
                {/* Manager Node: either assigned manager or No reporting manager */}
                <div className="relative flex items-start gap-3.5 mb-4">
                  {/* Connecting line down to You */}
                  <div className="absolute left-[19px] top-10 w-0.5 h-[2.2rem] bg-slate-200 dark:bg-slate-700"></div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 z-10 shadow-sm border ${
                    user.managerId && user.managerId.name && user.managerId._id !== user._id && user.managerId.name !== user.name
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-dashed border-slate-300 dark:border-slate-700'
                  }`}>
                    {user.managerId && user.managerId.name && user.managerId._id !== user._id && user.managerId.name !== user.name
                      ? initials(user.managerId.name)
                      : '—'}
                  </div>
                  <div className="pt-0.5">
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Manager</p>
                    {user.managerId && user.managerId.name && user.managerId._id !== user._id && user.managerId.name !== user.name ? (
                      <>
                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight mt-0.5">{user.managerId.name}</p>
                        <p className="text-[11px] font-medium text-slate-500 mt-0.5">{user.managerId.department}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-tight mt-0.5">No reporting manager</p>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5">Not assigned</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="relative flex flex-col lg:flex-row items-start lg:items-center mb-4 gap-4 lg:gap-0">
                  {/* Connecting line down to Reports */}
                  {reports.length > 0 && (
                    <div className="absolute left-[19px] top-10 w-0.5 h-[2.2rem] bg-slate-200 dark:bg-slate-700 z-0"></div>
                  )}
                  
                  {/* You Avatar & Info */}
                  <div className="flex items-start gap-3.5 shrink-0 min-w-[180px] z-10">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-black text-xs shrink-0 shadow-sm shadow-indigo-500/20">
                      {initials(user.name || '')}
                    </div>
                    <div className="pt-0.5 pr-3">
                        <p className="text-[9.5px] font-bold uppercase tracking-wider text-indigo-500">You</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight mt-0.5">{user.name}</p>
                        <p className="text-[11px] font-medium text-slate-500 mt-0.5">{user.department}</p>
                    </div>
                  </div>

                  {/* Horizontal Dashed Line to HR */}
                  {user.hrId && (
                    <div className="flex-1 flex items-center w-full lg:w-auto mt-3 lg:mt-0 lg:-ml-2 z-10 pl-[54px] lg:pl-0">
                      <div className="flex-1 border-t-2 border-dashed border-slate-200 dark:border-slate-700 opacity-75"></div>
                      <div className="px-2.5 py-0.5 bg-white dark:bg-slate-900 rounded-full text-[8.5px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest shadow-2xs border border-slate-200/80 dark:border-slate-700 mx-2.5">
                        HR Partner
                      </div>
                      <div className="flex-1 border-t-2 border-dashed border-slate-200 dark:border-slate-700 opacity-75"></div>
                      
                      {/* HR Avatar & Info */}
                      <div className="flex items-center gap-2.5 ml-2.5 shrink-0">
                        <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs shrink-0 shadow-sm">
                          {initials(user.hrId.name || '')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                            {user.hrId.name}
                          </p>
                          <p className="text-[10px] font-medium text-slate-500 mt-0.5 truncate">
                            {user.hrId.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {reports.length > 0 && (
                  <div className="relative space-y-4">
                    {/* The main trunk line for reports */}
                    <div className="absolute left-[19px] top-0 bottom-[16px] w-0.5 bg-slate-200 dark:bg-slate-700"></div>
                    
                    {reports.map((rep) => (
                      <div key={rep._id} className="relative flex items-start gap-3.5 pl-[40px]">
                        {/* Branch */}
                        <div className="absolute left-[19px] top-[16px] w-[21px] h-0.5 bg-slate-200 dark:bg-slate-700"></div>
                        
                        <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-[11px] shrink-0 z-10">
                          {initials(rep.name || '')}
                        </div>
                        <div className="pt-0.5">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Direct Report</p>
                          <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight mt-0.5">{rep.name}</p>
                          <p className="text-[10px] font-medium text-slate-500 mt-0.5">{rep.department}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            
          </div>

          {/* Section 2: Out of Office Form */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Out of office
                  </h3>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">
                    {ooo.enabled ? 'Active — you are currently marked out of office' : 'Off — you are receiving approvals as normal'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...ooo, enabled: !ooo.enabled }
                    setOoo(next)
                    if (!next.enabled) {
                      saveOoo(next)
                    }
                  }}
                  aria-label="Toggle Out of office mode"
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                    ooo.enabled ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${
                      ooo.enabled ? 'left-5.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {ooo.enabled && (
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/60 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">From</label>
                      <input
                        type="date"
                        value={ooo.from}
                        onChange={(e) => setOoo({ ...ooo, from: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Until</label>
                      <input
                        type="date"
                        value={ooo.until}
                        onChange={(e) => setOoo({ ...ooo, until: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Note</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={ooo.note}
                      onChange={(e) => setOoo({ ...ooo, note: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs placeholder:text-slate-400"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Delegate</label>
                    <select
                      value={ooo.delegateId}
                      onChange={(e) => setOoo({ ...ooo, delegateId: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-2xs appearance-none"
                    >
                      <option value="">Select...</option>
                      {users.filter(u => u._id !== user._id).map((u) => (
                        <option key={u._id} value={u._id}>{u.name}</option>
                      ))}
                    </select>
                    {!ooo.delegateId && (
                      <p className="text-[11px] font-bold text-amber-600 dark:text-amber-500 mt-2">
                        Select a delegate so approvals can be redirected.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => saveOoo(ooo)}
                      disabled={oooSaving}
                      className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-indigo-600 text-white text-sm font-extrabold shadow-md shadow-indigo-500/25 transition disabled:opacity-60 cursor-pointer"
                    >
                      {oooSaving ? 'Saving...' : 'Save'}
                    </button>
                    {oooMsg && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{oooMsg}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Notification Preferences Accordion Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenNotif(!openNotif)}
            className="w-full p-6 sm:p-7 flex items-center justify-between text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
          >
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Notification preferences
              </h3>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Email and in-app — how NetFlow reaches you
              </p>
            </div>
            {openNotif ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openNotif && (
            <div className="px-6 sm:px-7 pb-7 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              {NOTIFICATION_EVENTS.map((event) => (
                <div key={event.key} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                    {event.title}
                  </span>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleNotif(event.key, 'email')}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          notifPrefs[event.key]?.email !== false ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notifPrefs[event.key]?.email !== false ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="text-xs text-slate-500 font-semibold cursor-pointer select-none" onClick={() => toggleNotif(event.key, 'email')}>Email</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleNotif(event.key, 'inApp')}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          notifPrefs[event.key]?.inApp !== false ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notifPrefs[event.key]?.inApp !== false ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="text-xs text-slate-500 font-semibold cursor-pointer select-none" onClick={() => toggleNotif(event.key, 'inApp')}>In-App</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        user={user}
        onSaved={(updated) => {
          setProfile(updated)
          authStore.updateUser(updated)
        }}
      />

      <PhotoPreviewModal
        open={mainPreviewOpen}
        photo={user?.photo || user?.avatar || null}
        name={userInitials}
        onClose={() => setMainPreviewOpen(false)}
      />
    </AppShell>
  )
}
