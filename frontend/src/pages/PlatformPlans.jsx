import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Modal from '../components/Modal'
import { api } from '../utils/api'
import { AlertBanner } from '../components/Alert'
import { toast } from '../lib/toastStore'
import { confirm } from '../lib/confirmStore'
import { useOutsideDismiss } from '../utils/a11y'
import {
  ShieldCheck,
  CheckCircle2,
  Plus,
  Eye,
  MoreVertical,
  SlidersHorizontal,
  Trash2,
  Users,
  Sparkles,
  Edit2
} from 'lucide-react'

function PlanActionsMenu({ plan, onViewDetails, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useOutsideDismiss(menuRef, () => setOpen(false), open)

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const popUp = spaceBelow < 200
      setCoords({
        top: popUp ? 'auto' : `${rect.bottom + 4}px`,
        bottom: popUp ? `${window.innerHeight - rect.top + 4}px` : 'auto',
        right: `${window.innerWidth - rect.right}px`
      })
    }
    setOpen((o) => !o)
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 font-bold transition"
        title="More options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && coords && (
        <div
          style={{
            position: 'fixed',
            top: coords.top,
            bottom: coords.bottom,
            right: coords.right,
            zIndex: 9999,
          }}
          className="w-44 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xl py-1.5 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onViewDetails(); }}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-medium"
          >
            <Eye className="w-3.5 h-3.5 text-indigo-500" /> View details
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Edit plan
          </button>
          <div className="my-1 border-t border-slate-100 dark:border-slate-700/60" />
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full text-left px-4 py-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center gap-2 font-bold"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Delete plan
          </button>
        </div>
      )}
    </div>
  )
}

export default function PlatformPlans() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedPlanDetails, setSelectedPlanDetails] = useState(null)
  const [editingPlan, setEditingPlan] = useState(null)
  const [isCreating, setIsCreating] = useState(false)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await api.get('/api/platform/plans')
      setPlans(data.plans || [])
    } catch (err) {
      setError(err.message || 'Could not load plans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const defaultPlans = [
    {
      key: 'free',
      label: 'Free',
      badge: 'Starter',
      badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80',
      name: 'Free',
      price: 'Free',
      usersLimit: 'Up to 10 users',
      description: 'For small teams piloting approval workflows.',
      features: ['3 active workflows', 'Email notifications', 'Community support'],
      users: 10,
      forms: 5,
      flows: 3,
      storage: 5,
      mrr: '$0/mo',
      orgsCount: 0,
      combinedMrr: '$0',
      revenueShare: '0%',
    },
    {
      key: 'growth',
      label: 'Growth',
      badge: 'Growth',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 border-emerald-200/80',
      name: '$600',
      price: '$600',
      pricePeriod: '/mo',
      usersLimit: 'Up to 300 users',
      description: 'For growing departments running recurring approvals.',
      features: ['Unlimited workflows', 'Analytics dashboard', 'SLA escalation'],
      moreFeaturesCount: 1,
      users: 300,
      forms: 50,
      flows: 25,
      storage: 50,
      mrr: '$3k/mo',
      orgsCount: 2,
      combinedMrr: '$3,000',
      revenueShare: '28%',
    },
    {
      key: 'scale',
      label: 'Scale',
      badge: 'Scale',
      badgeClass: 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border-sky-200/80',
      name: '$900',
      isPopular: true,
      popularLabel: '★ Most adopted',
      price: '$900',
      pricePeriod: '/mo',
      usersLimit: 'Up to 750 users',
      description: 'For multi-department organizations with routing rules.',
      features: ['Delegation of authority', 'Custom form logic', 'Audit log export'],
      moreFeaturesCount: 1,
      users: 750,
      forms: 150,
      flows: 100,
      storage: 200,
      mrr: '$1.5k/mo',
      orgsCount: 2,
      combinedMrr: '$1,500',
      revenueShare: '14%',
    },
  ]

  const [customPlans, setCustomPlans] = useState(defaultPlans)

  const handleCreatePlan = async (e) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const formData = new FormData(e.target)
      const label = formData.get('label')?.toString().trim() || 'Custom Plan'
      const priceNum = parseFloat(formData.get('price')?.toString() || '0')
      const description = formData.get('description')?.toString().trim() || 'Custom plan for organization.'
      const seatSummary = formData.get('seatSummary')?.toString().trim() || (formData.get('maxUsers') ? `Up to ${formData.get('maxUsers')} users` : 'Unlimited users')
      const featuresRaw = formData.get('features')?.toString().trim() || ''
      const featuresList = featuresRaw ? featuresRaw.split('\n').map((s) => s.trim()).filter(Boolean) : ['Unlimited workflows', 'Email notifications']

      const maxUsers = formData.get('maxUsers')?.toString()
      const maxForms = formData.get('maxForms')?.toString()
      const maxWorkflows = formData.get('maxWorkflows')?.toString()
      const storageGb = formData.get('storageGb')?.toString()

      const newPlan = {
        key: `plan_${Date.now()}`,
        label,
        name: priceNum === 0 ? 'Free' : `$${priceNum}`,
        badge: label,
        badgeClass: 'bg-[#EEF2FF] text-[#4F46E5] border-indigo-200',
        price: priceNum === 0 ? 'Free' : `$${priceNum}`,
        pricePeriod: priceNum === 0 ? '' : '/mo',
        usersLimit: seatSummary,
        description,
        features: featuresList,
        users: maxUsers ? parseInt(maxUsers, 10) : '∞',
        forms: maxForms ? parseInt(maxForms, 10) : '∞',
        flows: maxWorkflows ? parseInt(maxWorkflows, 10) : '∞',
        storage: storageGb ? parseInt(storageGb, 10) : '∞',
        mrr: priceNum === 0 ? '$0/mo' : `$${priceNum}/mo`,
        orgsCount: 0,
        combinedMrr: '$0',
        revenueShare: '0%'
      }

      setCustomPlans((prev) => [newPlan, ...prev])
      setShowCreateModal(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditPlan = async (e) => {
    e.preventDefault()
    if (!editingPlan) return
    setIsCreating(true)
    try {
      const formData = new FormData(e.target)
      const label = formData.get('label')?.toString().trim() || editingPlan.label
      const priceNum = parseFloat(formData.get('price')?.toString() || '0')
      const description = formData.get('description')?.toString().trim() || editingPlan.description
      const seatSummary = formData.get('seatSummary')?.toString().trim() || editingPlan.usersLimit
      const maxUsers = formData.get('maxUsers')?.toString()
      const maxForms = formData.get('maxForms')?.toString()
      const maxWorkflows = formData.get('maxWorkflows')?.toString()
      const storageGb = formData.get('storageGb')?.toString()

      const updated = {
        ...editingPlan,
        label,
        badge: label,
        name: priceNum === 0 ? 'Free' : `$${priceNum}`,
        price: priceNum === 0 ? 'Free' : `$${priceNum}`,
        pricePeriod: priceNum === 0 ? '' : '/mo',
        usersLimit: seatSummary,
        description,
        users: maxUsers ? parseInt(maxUsers, 10) : editingPlan.users,
        forms: maxForms ? parseInt(maxForms, 10) : editingPlan.forms,
        flows: maxWorkflows ? parseInt(maxWorkflows, 10) : editingPlan.flows,
        storage: storageGb ? parseInt(storageGb, 10) : editingPlan.storage,
        mrr: priceNum === 0 ? '$0/mo' : `$${priceNum}/mo`,
      }

      setCustomPlans((prev) => prev.map((p) => (p.key === editingPlan.key ? updated : p)))
      setEditingPlan(null)
    } catch (err) {
      console.error(err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeletePlan = async (plan) => {
    const planName = plan?.label || plan?.name || 'this plan'

    const firstOk = await confirm({
      title: `Delete ${planName}?`,
      message: `Are you sure you want to delete the "${planName}" subscription tier?`,
      confirmLabel: 'Delete plan',
      danger: true,
    })
    if (!firstOk) return

    const secondOk = await confirm({
      title: `Final Confirmation: Delete ${planName}?`,
      message: `Are you absolutely sure? Deleting "${planName}" cannot be undone. Any organizations currently assigned to this tier may be impacted.`,
      confirmLabel: 'Yes, permanently delete',
      danger: true,
    })
    if (!secondOk) return

    setCustomPlans((prev) => prev.filter((p) => p.key !== plan.key))
    toast.success(`Plan "${planName}" has been deleted`)
  }

  return (
    <AppShell
      title="Plans"
      mainClass="p-4 md:p-6 flex flex-col flex-1 min-h-0 bg-[#e2e8f0] dark:bg-[#0B1120] overflow-y-auto space-y-6"
    >
      <div className="max-w-[1500px] mx-auto w-full space-y-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Plans
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Subscription tiers available to organizations on NetFlow
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 rounded-2xl bg-[#6366F1] hover:bg-[#4F46E5] active:bg-[#4338CA] text-white text-xs font-extrabold shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02] flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Create plan
          </button>
        </div>

        {error && <AlertBanner onRetry={load}>{error}</AlertBanner>}

        {/* Current Workspace Subscription Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[#EEF2FF] dark:bg-indigo-950/60 text-[#6366F1] dark:text-indigo-400 flex items-center justify-center font-bold shrink-0 border border-indigo-100 dark:border-indigo-900">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                This workspace is subscribed to Enterprise
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Forms, workflows and user seats are capped at this tier's allowance — nobody in the app can create beyond it.
              </p>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-slate-800 dark:text-slate-200 text-sm shadow-2xs">
            Enterprise
          </div>
        </div>

        {/* Plan Cards List */}
        <div className="space-y-4">
          {customPlans.map((plan) => (
            <div
              key={plan.key}
              className={`bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border ${plan.isPopular
                ? 'border-indigo-400/80 dark:border-indigo-500/50 ring-2 ring-indigo-500/15 shadow-md shadow-indigo-500/5'
                : 'border-slate-200/80 dark:border-slate-800 shadow-xs'
                } hover:shadow-md transition-all duration-200 flex flex-col xl:flex-row xl:items-center justify-between gap-6`}
            >
              {/* Section 1: Badge, Title Price, User Limit */}
              <div className="min-w-[160px] xl:w-[200px] shrink-0 space-y-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold border ${plan.badgeClass || 'bg-slate-100 text-slate-600'}`}>
                    {plan.badge}
                  </span>
                  {plan.isPopular && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      ★ {plan.popularLabel}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {plan.price}
                  </h3>
                  {plan.pricePeriod && (
                    <span className="text-xs font-bold text-slate-400">{plan.pricePeriod}</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-400">
                  {plan.usersLimit}
                </p>
              </div>

              {/* Section 2: Description & Vertical Feature Checklist */}
              <div className="flex-1 min-w-0 xl:max-w-md space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                  {plan.description}
                </p>

                <div className="space-y-1 text-xs">
                  {plan.features.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
                      <span className="text-emerald-500 font-black text-xs">✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                  {plan.moreFeaturesCount && (
                    <div className="pt-0.5">
                      <span
                        onClick={() => setSelectedPlanDetails(plan)}
                        className="text-[#6366F1] font-bold text-xs cursor-pointer hover:underline inline-flex items-center"
                      >
                        +{plan.moreFeaturesCount} more
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Resource Quotas 4 Pill Boxes */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-center min-w-[58px]">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {plan.users}
                  </div>
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">
                    USERS
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-center min-w-[58px]">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {plan.forms}
                  </div>
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">
                    FORMS
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-center min-w-[58px]">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {plan.flows}
                  </div>
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">
                    FLOWS
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-center min-w-[58px]">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {plan.storage}
                  </div>
                  <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">
                    GB
                  </div>
                </div>
              </div>

              {/* Section 4: Revenue & Subscribed Orgs */}
              <div className="text-left xl:text-right shrink-0 min-w-[75px]">
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {plan.mrr}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 flex items-center xl:justify-end gap-1 mt-0.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" /> {plan.orgsCount} {plan.orgsCount === 1 ? 'org' : 'orgs'}
                </div>
              </div>

              {/* Section 5: Separate Action Icon Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedPlanDetails(plan)}
                  className="w-9 h-9 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition cursor-pointer"
                  title="View plan details"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setEditingPlan(plan)}
                  className="w-9 h-9 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition cursor-pointer"
                  title="Edit plan"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDeletePlan(plan)}
                  className="w-9 h-9 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 shadow-2xs transition cursor-pointer"
                  title="Delete plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Details Modal */}
      {selectedPlanDetails && (
        <Modal
          open={Boolean(selectedPlanDetails)}
          onClose={() => setSelectedPlanDetails(null)}
          title={`${selectedPlanDetails.label} plan`}
          subtitle={selectedPlanDetails.description}
          size="xl"
          footer={
            <div className="flex justify-end gap-3 w-full">
              <button
                type="button"
                onClick={() => setSelectedPlanDetails(null)}
                className="px-6 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-2xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = selectedPlanDetails
                  setSelectedPlanDetails(null)
                  setEditingPlan(p)
                }}
                className="px-6 py-2.5 rounded-2xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-extrabold shadow-md transition flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit plan
              </button>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Top Plan Title & Badge */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {selectedPlanDetails.price || selectedPlanDetails.name}
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-1">
                  {selectedPlanDetails.usersLimit}
                </p>
              </div>
              <span className="px-3.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {selectedPlanDetails.badge}
              </span>
            </div>

            {/* Allowances section */}
            <div>
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
                ALLOWANCES
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {selectedPlanDetails.users}
                  </div>
                  <div className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-1.5">
                    USER SEATS
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {selectedPlanDetails.forms}
                  </div>
                  <div className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-1.5">
                    FORMS
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {selectedPlanDetails.flows}
                  </div>
                  <div className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-1.5">
                    WORKFLOWS
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {selectedPlanDetails.storage} GB
                  </div>
                  <div className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-1.5">
                    STORAGE
                  </div>
                </div>
              </div>
            </div>

            {/* What's Included Section */}
            <div>
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
                WHAT'S INCLUDED
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {selectedPlanDetails.features && selectedPlanDetails.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="text-emerald-500 font-bold text-sm">✓</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Adoption Section */}
            <div>
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
                ADOPTION
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                  <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {selectedPlanDetails.orgsCount ?? 1}
                  </div>
                  <div className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-1.5">
                    ORGANIZATIONS
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                  <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {selectedPlanDetails.combinedMrr || '$0'}
                  </div>
                  <div className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-1.5">
                    COMBINED MRR
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                  <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {selectedPlanDetails.revenueShare || '0%'}
                  </div>
                  <div className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-1.5">
                    SHARE OF REVENUE
                  </div>
                </div>
              </div>
            </div>

            {/* Organizations on this plan */}
            <div>
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
                ORGANIZATIONS ON THIS PLAN
              </h4>
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
                <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-2.5 font-extrabold">ORGANIZATION</th>
                      <th className="px-4 py-2.5 font-extrabold">STATUS</th>
                      <th className="px-4 py-2.5 font-extrabold">SEATS</th>
                      <th className="px-4 py-2.5 font-extrabold">SUBSCRIPTION ENDS</th>
                      <th className="px-4 py-2.5 font-extrabold text-right">MRR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                    <tr>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                            N
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">netlink</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-blue-600 dark:text-blue-400 font-bold">Trial</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        0
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-rose-600 dark:text-rose-400 font-bold">11 Aug 2026</span>
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-bold inline-flex items-center gap-1">
                            ⚠ Expired 6 days ago
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white">
                        $0
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <Modal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create custom plan"
          subtitle="Add a new plan tier with customized quota allowances"
          size="md"
        >
          <form onSubmit={handleCreatePlan} className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Plan Name / Label
              </label>
              <input
                name="label"
                type="text"
                required
                placeholder="e.g. Enterprise Plus"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Monthly Price ($)
                </label>
                <input
                  name="price"
                  type="number"
                  placeholder="1200"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Seat Summary
                </label>
                <input
                  name="seatSummary"
                  type="text"
                  placeholder="Up to 1,000 users"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <textarea
                name="description"
                rows={2}
                placeholder="For large enterprises needing dedicated support..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Max Users</label>
                <input name="maxUsers" type="number" placeholder="1000" className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Max Forms</label>
                <input name="maxForms" type="number" placeholder="250" className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Max Workflows</label>
                <input name="maxWorkflows" type="number" placeholder="150" className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Storage (GB)</label>
                <input name="storageGb" type="number" placeholder="500" className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-6 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-md"
              >
                {isCreating ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <Modal
          open={Boolean(editingPlan)}
          onClose={() => setEditingPlan(null)}
          title={`Edit ${editingPlan.label} plan`}
          subtitle="Modify plan tier allowances and settings"
          size="md"
        >
          <form onSubmit={handleEditPlan} className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Plan Name / Label
              </label>
              <input
                name="label"
                type="text"
                defaultValue={editingPlan.label}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Monthly Price ($)
                </label>
                <input
                  name="price"
                  type="number"
                  defaultValue={editingPlan.price?.replace(/[^0-9.]/g, '') || '0'}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Seat Summary
                </label>
                <input
                  name="seatSummary"
                  type="text"
                  defaultValue={editingPlan.usersLimit}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <textarea
                name="description"
                rows={2}
                defaultValue={editingPlan.description}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Max Users</label>
                <input name="maxUsers" type="number" defaultValue={typeof editingPlan.users === 'number' ? editingPlan.users : ''} className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Max Forms</label>
                <input name="maxForms" type="number" defaultValue={typeof editingPlan.forms === 'number' ? editingPlan.forms : ''} className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Max Workflows</label>
                <input name="maxWorkflows" type="number" defaultValue={typeof editingPlan.flows === 'number' ? editingPlan.flows : ''} className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Storage (GB)</label>
                <input name="storageGb" type="number" defaultValue={typeof editingPlan.storage === 'number' ? editingPlan.storage : ''} className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-6 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold shadow-md"
              >
                {isCreating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  )
}
