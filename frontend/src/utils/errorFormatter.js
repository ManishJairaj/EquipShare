export function formatApiError(err) {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') {
    return detail
  }
  if (Array.isArray(detail)) {
    // Format FastAPI validation error details
    return detail.map(d => {
      const field = d.loc && d.loc.length > 1 ? d.loc.slice(1).join('.') : ''
      return field ? `${field}: ${d.msg}` : d.msg
    }).join(', ')
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail)
  }
  return err.response?.data?.message || err.message || 'An unexpected error occurred.'
}
