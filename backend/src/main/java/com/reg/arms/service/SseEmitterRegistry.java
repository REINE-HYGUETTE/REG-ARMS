package com.reg.arms.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Singleton registry of active SSE connections keyed by userId.
 * Multiple connections per user are supported so that each browser tab
 * receives events independently (e.g. user has app open on two devices).
 */
@Component
@Slf4j
public class SseEmitterRegistry {

    /** userId → list of all active emitters for that user */
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> emitters = new ConcurrentHashMap<>();

    /**
     * Create and register a new SSE emitter for the given user.
     * Times out after 3 minutes (client reconnects automatically via EventSource).
     */
    public SseEmitter register(Long userId) {
        SseEmitter emitter = new SseEmitter(3 * 60 * 1_000L); // 3 min timeout

        CopyOnWriteArrayList<SseEmitter> list =
                emitters.computeIfAbsent(userId, id -> new CopyOnWriteArrayList<>());
        list.add(emitter);

        Runnable cleanup = () -> {
            list.remove(emitter);
            if (list.isEmpty()) emitters.remove(userId, list);
        };

        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(e -> cleanup.run());

        // Send a "connected" heartbeat immediately so the browser confirms the stream
        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data("{\"status\":\"connected\"}"));
        } catch (IOException e) {
            cleanup.run();
        }

        log.debug("SSE emitter registered for userId={} (total connections: {})",
                userId, list.size());
        return emitter;
    }

    /**
     * Push a notification event to ALL active connections for a user.
     */
    public void push(Long userId, Object payload) {
        List<SseEmitter> list = emitters.get(userId);
        if (list == null || list.isEmpty()) return;

        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event()
                        .name("notification")
                        .data(payload));
            } catch (IOException e) {
                log.debug("SSE push failed for userId={} — removing that emitter", userId);
                list.remove(emitter);
            }
        }
        if (list.isEmpty()) emitters.remove(userId, list);
    }

    /** Close and remove all connections for a user (e.g. on logout). */
    public void removeAll(Long userId) {
        List<SseEmitter> list = emitters.remove(userId);
        if (list == null) return;
        for (SseEmitter e : list) {
            try { e.complete(); } catch (Exception ignored) {}
        }
    }

    /** @deprecated Use {@link #removeAll(Long)} — kept for backwards compatibility. */
    @Deprecated
    public void remove(Long userId) {
        removeAll(userId);
    }

    /** Total number of active SSE connections across all users. */
    public int activeCount() {
        return emitters.values().stream().mapToInt(List::size).sum();
    }
}
