package com.reg.arms.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Simple fixed-window rate limiter applied per IP address.
 *
 * <p>Rules (configurable via constructor args):
 * <ul>
 *   <li>{@code /api/auth/login}       → 10 requests / 60 s   (brute-force protection)</li>
 *   <li>{@code /api/requests/predict} → 30 requests / 60 s   (AI cost protection)</li>
 * </ul>
 *
 * <p>Uses a ConcurrentHashMap keyed by {@code "IP:path"}.  The counter resets
 * after each window ends.  A scheduled eviction is not needed for this scale;
 * the map stays small because each entry is keyed on a concrete path variant.
 *
 * <p><b>Note:</b> If the application is deployed behind a reverse proxy, make
 * sure {@code server.forward-headers-strategy=NATIVE} (or FRAMEWORK) is set in
 * {@code application.properties} so that {@code getRemoteAddr()} returns the
 * real client IP from the {@code X-Forwarded-For} header.
 */
@Slf4j
public class RateLimitInterceptor implements HandlerInterceptor {

    private final int maxRequests;
    private final long windowMillis;

    /** Entry stored per IP+path key. */
    private record WindowEntry(AtomicInteger count, long windowStart) {}

    private final ConcurrentHashMap<String, WindowEntry> windows = new ConcurrentHashMap<>();

    public RateLimitInterceptor(int maxRequests, long windowMillis) {
        this.maxRequests   = maxRequests;
        this.windowMillis  = windowMillis;
    }

    @Override
    public boolean preHandle(@NonNull HttpServletRequest request,
                             @NonNull HttpServletResponse response,
                             @NonNull Object handler) throws Exception {

        String ip  = resolveClientIp(request);
        String key = ip + ":" + request.getRequestURI();

        long now = System.currentTimeMillis();

        WindowEntry entry = windows.compute(key, (k, existing) -> {
            if (existing == null || (now - existing.windowStart()) >= windowMillis) {
                // New or expired window — start fresh
                return new WindowEntry(new AtomicInteger(1), now);
            }
            existing.count().incrementAndGet();
            return existing;
        });

        if (entry.count().get() > maxRequests) {
            log.warn("Rate limit exceeded for IP={} uri={} count={}", ip, request.getRequestURI(), entry.count().get());
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"success\":false,\"message\":\"Too many requests. Please wait before trying again.\"}");
            return false;
        }
        return true;
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
