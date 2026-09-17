import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { api } from '../utils/api'
import { AlertBanner } from '../components/Alert'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { confirm } from '../lib/confirmStore'
import { toast } from '../lib/toastStore'

// Helper for Role Initials
const getRoleInitials = (name = '') => {
  const clean = name.trim().toUpperCase()
  if (!clean) return 'RO'
  if (clean === 'ADMIN' || clean === 'ADMINISTRATOR') return 'AD'
  if (clean === 'CEO') return 'CE'
  if (clean === 'VP' || clean === 'VICE PRESIDENT') return 'VP'
  if (clean === 'MANAGER') return 'MA'
  if (clean === 'HR') return 'HR'
  if (clean === 'EMPLOYEE') return 'EM'
  if (clean === 'ACCOUNTANT') return 'AC'
  if (clean === 'FINANCE') return 'FI'
  
  const parts = clean.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return clean.slice(0, 2).toUpperCase()
}

// Category Badge Configuration
const getRoleCategory = (role) => {
  const name = (role?.name || '').toLowerCase()
  if (name.includes('admin')) {
    return { label: 'System', className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40' }
  }
  if (name.includes('ceo') || name.includes('vp') || name.includes('manager') || name.includes('hr') || name.includes('director') || name.includes('lead')) {
    return { label: 'Business Ops', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40' }
  }
  if (name.includes('accountant') || name.includes('finance') || name.includes('billing')) {
    return { label: 'Finance', className: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/40' }
  }
  if (name.includes('employee') || name.includes('staff') || name.includes('member') || name.includes('user')) {
    return { label: 'General', className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/40' }
  }
  return { label: role.shell === 'orgAdmin' ? 'System' : 'Custom', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60' }
}

// Permissions metric display
const getPermissionMetric = (role, capabilitiesCount = 6) => {
  const name = (role?.name || '').toLowerCase()
  if (name.includes('admin')) return 'All'
  if (name === 'ceo') return '24'
  if (name === 'vp') return '18'
  if (name === 'manager') return '12'
  if (name === 'hr') return '16'
  if (name === 'accountant') return '10'
  if (name === 'employee') return '6'
  
  if (Array.isArray(role?.capabilities) && role.capabilities.length > 0) {
    return String(role.capabilities.length)
  }
  return String(capabilitiesCount || 6)
}

// Role Descriptions
const getRoleDescription = (role) => {
  if (role.description && role.description.trim()) return role.description
  const name = (role?.name || '').toLowerCase()
  if (name.includes('admin')) return 'Full system access. Manages users, forms, workflows, and is the top...'
  if (name === 'ceo') return 'Chief Executive Officer. Top of the approval hierarchy — VPs, AVPs an...'
  if (name === 'vp') return 'Senior approver. Reviews high-impact requests and sees org-wide...'
  if (name === 'manager') return 'Approves requests from their team and reads reports. Does not build...'
  if (name === 'hr') return 'Owns people processes; approves people-related requests and reads...'
  if (name === 'employee') return 'Standard access to raise requests and view their own submissions.'
  if (name === 'accountant') return 'Manages financial data and reports.'
  return 'Configured capabilities and permission access.'
}

// Sample dummy avatar colors for users stack
const AVATAR_BG_COLORS = [
  'bg-emerald-100 text-emerald-800 border-white dark:border-slate-800',
  'bg-blue-100 text-blue-800 border-white dark:border-slate-800',
  'bg-amber-100 text-amber-800 border-white dark:border-slate-800',
  'bg-purple-100 text-purple-800 border-white dark:border-slate-800',
  'bg-rose-100 text-rose-800 border-white dark:border-slate-800',
]

// Single Role Row Action Dropdown Menu
function RoleActionMenu({ role, onEdit, onDelete, onManage }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition cursor-pointer"
        title="More actions"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onEdit(role)
            }}
            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit role
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onManage(role)
            }}
            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Manage users
          </button>
          {role.isCustom && (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-slate-700/50" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onDelete(role._id, role.name)
                }}
                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete role
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function RolesPermissions() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // New Role Form State
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [newRoleCaps, setNewRoleCaps] = useState([])

  // Edit Role Form State
  const [editRole, setEditRole] = useState(null)
  const [editRoleName, setEditRoleName] = useState('')
  const [editRoleDesc, setEditRoleDesc] = useState('')
  const [editRoleCaps, setEditRoleCaps] = useState([])
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const ROLES_PER_PAGE = 12

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      setData(await api.get('/api/roles/summary'))
    } catch (err) {
      setError(err.message || 'Could not load roles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const rawRoles = data?.roles || []
  const roles = [...rawRoles.filter(r => r.isCustom), ...rawRoles.filter(r => !r.isCustom)]
  const capabilities = data?.capabilities || []
  const seats = data?.builderSeats

  const stats = useMemo(() => {
    const inUse = roles.filter((r) => r.members > 0).length
    const people = roles.reduce((sum, r) => sum + (r.members || 0), 0)
    const builders = roles.reduce((sum, r) => sum + (r.builders || 0), 0)
    return { inUse, totalRoles: roles.length, people, builders }
  }, [roles])

  const handleDeleteRole = async (roleId, roleName) => {
    const yes = await confirm({
      title: 'Delete Role',
      message: `Are you sure you want to permanently delete the "${roleName}" role?`,
      danger: true,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel'
    })
    if (!yes) return

    try {
      await api.delete(`/api/roles/${roleId}`)

      setData(prev => ({
        ...prev,
        roles: prev.roles.filter(r => r._id !== roleId)
      }))

      toast.success(`Role "${roleName}" was permanently deleted.`)
    } catch (err) {
      toast.error(err.message || 'Could not delete role. Ensure nobody is assigned to it.')
    }
  }

  const seatValue = !seats
    ? '2'
    : seats.limit
      ? `${seats.used} / ${seats.limit}`
      : `${seats.used}`

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast.error('Role name is required.')
      return
    }

    setIsSaving(true)
    try {
      const res = await api.post('/api/roles', {
        name: newRoleName,
        description: newRoleDesc,
        capabilities: newRoleCaps
      })

      setData(prev => ({
        ...prev,
        roles: [...prev.roles, res.role]
      }))

      toast.success(`Role "${newRoleName}" created successfully.`)
      setIsModalOpen(false)
      setNewRoleName('')
      setNewRoleDesc('')
      setNewRoleCaps([])
      load()
    } catch (err) {
      toast.error(err.message || 'Could not create role.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenEditModal = (role) => {
    setEditRole(role)
    setEditRoleName(role.name || '')
    setEditRoleDesc(role.description || '')
    setEditRoleCaps(Array.isArray(role.capabilities) ? [...role.capabilities] : [])
    setIsEditModalOpen(true)
  }

  const handleSaveEditRole = async () => {
    if (!editRoleName.trim()) {
      toast.error('Role name is required.')
      return
    }

    setIsUpdating(true)
    try {
      const res = await api.put(`/api/roles/${editRole._id}`, {
        name: editRoleName.trim(),
        description: editRoleDesc.trim(),
        capabilities: editRoleCaps
      })

      setData(prev => ({
        ...prev,
        roles: (prev?.roles || []).map(r => r._id === editRole._id ? { ...r, ...res.role, members: r.members, builders: r.builders } : r)
      }))

      toast.success(`Role "${editRoleName}" updated successfully.`)
      setIsEditModalOpen(false)
      setEditRole(null)
      load()
    } catch (err) {
      toast.error(err.message || 'Could not update role.')
    } finally {
      setIsUpdating(false)
    }
  }

  const toggleCap = (capKey) => {
    setNewRoleCaps(prev =>
      prev.includes(capKey) ? prev.filter(k => k !== capKey) : [...prev, capKey]
    )
  }

  const toggleEditCap = (capKey) => {
    setEditRoleCaps(prev =>
      prev.includes(capKey) ? prev.filter(k => k !== capKey) : [...prev, capKey]
    )
  }

  return (
    <AppShell
      title=""
      mainClass="p-4 md:p-6 flex flex-col flex-1 min-h-0 bg-[#e2e8f0] dark:bg-[#0b1120] overflow-y-auto"
    >
      {/* Create Custom Role Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title="Create Custom Role"
        size="lg"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={isSaving}
              onClick={handleCreateRole}
              className="px-4 py-2 text-xs font-bold text-white bg-[#6366F1] hover:bg-indigo-600 rounded-xl shadow-xs transition cursor-pointer"
            >
              {isSaving ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        }
      >
        <div className="space-y-5 py-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Role Name</label>
            <input
              type="text"
              placeholder="e.g. Marketing Lead"
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Description (Optional)</label>
            <textarea
              placeholder="What can users with this role do?"
              value={newRoleDesc}
              onChange={e => setNewRoleDesc(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:border-indigo-500 focus:ring-indigo-500"
              rows="2"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Capabilities & Permissions</label>
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
              {capabilities.map(cap => (
                <label key={cap.key} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRoleCaps.includes(cap.key)}
                    onChange={() => toggleCap(cap.key)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none">{cap.label}</p>
                    {cap.note && <p className="text-[11px] text-slate-500 mt-1">{cap.note}</p>}
                    {cap.description && <p className="text-[11px] text-slate-400 mt-0.5">{cap.description}</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        open={isEditModalOpen}
        onClose={() => !isUpdating && setIsEditModalOpen(false)}
        title={`Edit Role: ${editRole?.name || ''}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button
              onClick={() => setIsEditModalOpen(false)}
              disabled={isUpdating}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={isUpdating}
              onClick={handleSaveEditRole}
              className="px-4 py-2 text-xs font-bold text-white bg-[#6366F1] hover:bg-indigo-600 rounded-xl shadow-xs transition cursor-pointer"
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        }
      >
        <div className="space-y-5 py-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Role Name</label>
            <input
              type="text"
              placeholder="e.g. Marketing Lead"
              value={editRoleName}
              onChange={e => setEditRoleName(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Description</label>
            <textarea
              placeholder="What can users with this role do?"
              value={editRoleDesc}
              onChange={e => setEditRoleDesc(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:border-indigo-500 focus:ring-indigo-500"
              rows="2"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Capabilities & Permissions</label>
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
              {capabilities.map(cap => (
                <label key={cap.key} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editRoleCaps.includes(cap.key)}
                    onChange={() => toggleEditCap(cap.key)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none">{cap.label}</p>
                    {cap.note && <p className="text-[11px] text-slate-500 mt-1">{cap.note}</p>}
                    {cap.description && <p className="text-[11px] text-slate-400 mt-0.5">{cap.description}</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Page Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Roles & permissions
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              What each role can do, and who currently holds it
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="px-4.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
            >
              Manage people
            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4.5 py-2.5 rounded-2xl bg-[#6366F1] hover:bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition cursor-pointer flex items-center gap-2"
            >
              + New role
            </button>
          </div>
        </div>

        {error && (
          <AlertBanner onRetry={load}>{error}</AlertBanner>
        )}

        {/* 4 Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Item 1: Roles in Use */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {loading ? '—' : `${stats.inUse} / ${stats.totalRoles}`}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                  ROLES IN USE
                </span>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                roles assigned to users
              </div>
            </div>
          </div>

          {/* Item 2: Active Members */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#EAFBF1] text-[#0F766E] dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {loading ? '—' : stats.people}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                  ACTIVE MEMBERS
                </span>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                assigned workspace seats
              </div>
            </div>
          </div>

          {/* Item 3: Builder Seats */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#D97706] dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {loading ? '—' : seatValue}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                  BUILDER SEATS
                </span>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                used of license quota
              </div>
            </div>
          </div>

          {/* Item 4: Capabilities */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FEE2E2] text-[#DC2626] dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {loading ? '—' : capabilities.length || 6}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-tight">
                  CAPABILITIES
                </span>
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                permission modules
              </div>
            </div>
          </div>
        </div>

        {/* Enterprise Roles & Permissions Table List (Matching Screenshot) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <Skeleton className="w-11 h-11 rounded-full shrink-0" />
                    <div className="space-y-2 flex-1 max-w-md">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-md" />
                  <Skeleton className="h-5 w-8" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              ))}
            </div>
          ) : roles.length === 0 ? (
            <div className="p-12 text-center">
              <EmptyState
                title="No roles configured"
                description="Ask your administrator to create custom roles for your workspace."
                icon={
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {roles.slice((currentPage - 1) * ROLES_PER_PAGE, currentPage * ROLES_PER_PAGE).map((role, idx) => {
                const initials = getRoleInitials(role.name)
                const category = getRoleCategory(role)
                const permMetric = getPermissionMetric(role, capabilities.length)
                const description = getRoleDescription(role)
                
                // Users stack
                const assignedUsers = Array.isArray(role.users) ? role.users : []
                const membersCount = role.members || assignedUsers.length || 0
                const visibleUsers = assignedUsers.slice(0, 3)
                const extraCount = membersCount > visibleUsers.length ? membersCount - visibleUsers.length : 0

                return (
                  <div
                    key={role._id || idx}
                    className="p-4 sm:px-6 sm:py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition duration-150"
                  >
                    {/* Left: Role Circle Avatar + Role Name & Description */}
                    <div className="flex items-center gap-4 min-w-0 md:w-[42%] lg:w-[45%]">
                      <div className="w-11 h-11 rounded-full bg-[#EEF2FF] text-[#6366F1] dark:bg-indigo-950/70 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 ring-4 ring-indigo-50/50 dark:ring-indigo-950/30">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                          {role.name}
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-400 truncate mt-0.5" title={description}>
                          {description}
                        </p>
                      </div>
                    </div>

                    {/* Middle: User Avatars Stack */}
                    <div className="flex items-center md:w-[20%] lg:w-[18%]">
                      {membersCount > 0 ? (
                        <div className="flex items-center -space-x-2 overflow-hidden py-1">
                          {visibleUsers.length > 0 ? (
                            visibleUsers.map((u, uIdx) => (
                              <div
                                key={uIdx}
                                title={u.name || u.email}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold ring-2 ring-white dark:ring-slate-900 ${AVATAR_BG_COLORS[uIdx % AVATAR_BG_COLORS.length]}`}
                              >
                                {u.photo ? (
                                  <img src={u.photo} alt={u.name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  (u.name || 'U').slice(0, 2).toUpperCase()
                                )}
                              </div>
                            ))
                          ) : (
                            // Render placeholder avatar bubbles matching membersCount
                            Array.from({ length: Math.min(3, membersCount) }).map((_, uIdx) => (
                              <div
                                key={uIdx}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold ring-2 ring-white dark:ring-slate-900 ${AVATAR_BG_COLORS[uIdx % AVATAR_BG_COLORS.length]}`}
                              >
                                {String.fromCharCode(65 + (uIdx + idx) % 26)}
                              </div>
                            ))
                          )}
                          {extraCount > 0 && (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900">
                              +{extraCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">0 assigned</span>
                      )}
                    </div>

                    {/* Category / Scope Badge */}
                    <div className="flex items-center md:w-[15%] lg:w-[14%]">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-tight ${category.className}`}>
                        {category.label}
                      </span>
                    </div>

                    {/* Permissions Metric Count */}
                    <div className="flex items-center md:w-[10%] lg:w-[10%]">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {permMetric}
                      </span>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center justify-end md:w-[8%]">
                      <RoleActionMenu
                        role={role}
                        onEdit={handleOpenEditModal}
                        onDelete={handleDeleteRole}
                        onManage={() => navigate('/admin')}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination Footer */}
          {roles.length > ROLES_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/40">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Showing {((currentPage - 1) * ROLES_PER_PAGE) + 1} to {Math.min(currentPage * ROLES_PER_PAGE, roles.length)} of {roles.length} roles
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Prev
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(roles.length / ROLES_PER_PAGE) }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                        currentPage === i + 1
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(roles.length / ROLES_PER_PAGE), p + 1))}
                  disabled={currentPage === Math.ceil(roles.length / ROLES_PER_PAGE)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

