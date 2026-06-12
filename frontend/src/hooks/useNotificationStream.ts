import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Opens an SSE connection to /api/notifications/stream.
 * On each "notification" event the unread-count and notifications queries
 * are invalidated so the bell badge and notification list refresh instantly.
 *
 * The browser EventSource reconnects automatically after timeouts.
 * We close the connection when the component unmounts.
 *
 * Security note — JWT in query string:
 *   The browser's EventSource API does not support custom request headers, so
 *   the JWT is sent as a `?token=` query parameter instead of an Authorization
 *   header.  This means the token will appear in server access logs and browser
 *   history.  Mitigations already in place:
 *     • HTTPS in production (token is encrypted in transit)
 *     • Short token TTL (1 h) limits the window if a token is extracted from logs
 *     • The SSE path is marked as whitelisted in Spring SecurityConfig but the
 *       JwtAuthenticationFilter still validates the `?token` param before any
 *       data is sent
 *   If higher security is required, consider using a short-lived SSE token
 *   issued via POST /api/notifications/sse-token and exchanged here.
 */
export function useNotificationStream(enabled = true) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return

    const token = localStorage.getItem('reg_token')
    if (!token) return

    const url = `/api/notifications/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)

    es.addEventListener('notification', () => {
      queryClient.invalidateQueries({ queryKey: ['unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      // Refresh task list so technician counts stay accurate when Staff assigns
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
    })

    es.onerror = () => {
      // EventSource will auto-retry; no action needed
    }

    return () => {
      es.close()
    }
  }, [enabled, queryClient])
}
