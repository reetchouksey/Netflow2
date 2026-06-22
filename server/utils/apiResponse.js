// Shared - Phase 2 - utils/apiResponse.js
// Every route MUST use these to keep response shape consistent.

const sendSuccess = (res, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({ success: true, ...data })
}

const sendError = (res, error, code = 'BAD_REQUEST', statusCode = 400) => {
  return res.status(statusCode).json({ success: false, error, code })
}

module.exports = { sendSuccess, sendError }
