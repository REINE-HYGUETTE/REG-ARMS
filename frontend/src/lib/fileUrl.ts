/**
 * Builds a secure URL for a stored attachment file.
 *
 * Browser-native elements (<img src>, <a href download>) cannot set
 * custom HTTP headers, so the JWT token is passed as the ?token= query
 * parameter instead.  The JwtAuthenticationFilter on the backend already
 * supports this fallback for exactly this reason (originally added for SSE).
 *
 * Usage:
 *   fileUrl(attachment.filePath)           → inline view (lightbox)
 *   fileUrl(attachment.filePath, true)     → forced download
 */
export function fileUrl(filePath: string, forceDownload = false): string {
  const token = localStorage.getItem('reg_token') ?? ''
  const params = new URLSearchParams()
  if (token)         params.set('token',    token)
  if (forceDownload) params.set('download', 'true')
  const qs = params.toString()
  return `/api/files/${filePath}${qs ? '?' + qs : ''}`
}
