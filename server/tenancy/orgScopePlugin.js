// Multi-tenancy build-order step 5 - tenancy/orgScopePlugin.js
// Shared Mongoose plugin applied to every tenant-scoped model. When an
// ambient tenant context is present (see tenantContext.js) it:
//   - stamps orgId on newly created documents (save + insertMany)
//   - adds { orgId } to every find / count / distinct / update / delete
//   - prepends { $match: { orgId } } to every aggregation pipeline
//
// Escape hatches:
//   - no ambient context (scripts, seeds, login) → queries run unscoped
//   - .setOptions({ skipOrgScope: true })        → explicit opt-out
//   - a filter that already names orgId          → left untouched

const { getOrgId } = require('./tenantContext')

const QUERY_HOOKS = [
  'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
  'countDocuments', 'distinct', 'exists',
  'updateOne', 'updateMany', 'replaceOne',
  'deleteOne', 'deleteMany'
]

module.exports = function orgScopePlugin (schema) {
  // Only tenant models (those that declare orgId) are scoped.
  if (!schema.path('orgId')) return

  schema.pre('save', function () {
    if (this.isNew && !this.orgId) {
      const orgId = getOrgId()
      if (orgId) this.orgId = orgId
    }
  })

  schema.pre('insertMany', function (next, docs) {
    const orgId = getOrgId()
    if (orgId && Array.isArray(docs)) {
      for (const doc of docs) {
        if (doc && !doc.orgId) doc.orgId = orgId
      }
    }
    next()
  })

  schema.pre(QUERY_HOOKS, function () {
    if (this.getOptions().skipOrgScope) return
    const orgId = getOrgId()
    if (!orgId) return
    const filter = this.getFilter()
    if (!Object.prototype.hasOwnProperty.call(filter, 'orgId')) {
      this.where({ orgId })
    }
  })

  schema.pre('aggregate', function () {
    if (this.options && this.options.skipOrgScope) return
    const orgId = getOrgId()
    if (!orgId) return
    this.pipeline().unshift({ $match: { orgId } })
  })
}
