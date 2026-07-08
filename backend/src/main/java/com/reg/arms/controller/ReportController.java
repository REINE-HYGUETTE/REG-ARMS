package com.reg.arms.controller;

import com.reg.arms.dto.response.HotspotResponse;
import com.reg.arms.security.UserPrincipal;
import com.reg.arms.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    // Core operational reports are visible to ADMIN (global) and STAFF
    // (automatically scoped to their own district inside ReportService).

    @GetMapping("/monthly-volume")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> monthlyVolume(
            @RequestParam(defaultValue = "12") int months,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.monthlyVolume(months, principal));
    }

    @GetMapping("/by-priority")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> byPriority(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.byPriority(principal));
    }

    @GetMapping("/by-category")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> byCategory(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.byCategory(principal));
    }

    @GetMapping("/by-province")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> byProvince(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.byProvince(principal));
    }

    @GetMapping("/by-sector")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> bySector(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.bySector(principal));
    }

    @GetMapping("/by-status")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> byStatus(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.byStatus(principal));
    }

    @GetMapping("/technician-performance")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> technicianPerformance(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.technicianPerformance(principal));
    }

    // Model-level accuracy metrics (no request-level data) — same visibility
    // as the other AI analytics endpoints below.
    @GetMapping("/ai-accuracy")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> aiAccuracy() {
        return ResponseEntity.ok(reportService.aiAccuracy());
    }

    // ── Real AI analytics endpoints ───────────────────────────────────────────

    @GetMapping("/ai-summary")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<Map<String, Object>> aiSummary() {
        return ResponseEntity.ok(reportService.aiSummary());
    }

    @GetMapping("/ai-confusion-matrix")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> aiConfusionMatrix() {
        return ResponseEntity.ok(reportService.aiConfusionMatrix());
    }

    @GetMapping("/ai-confidence-distribution")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> aiConfidenceDistribution() {
        return ResponseEntity.ok(reportService.aiConfidenceDistribution());
    }

    // ── SLA metrics ──────────────────────────────────────────────────────────

    @GetMapping("/sla-metrics")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<Map<String, Object>> slaMetrics(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.slaMetrics(principal));
    }

    // ── Feature 4: hotspot / cluster detection ────────────────────────────────
    // Accessible by STAFF and ADMIN so the operations dashboard can show alerts.

    @GetMapping("/hotspots")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<HotspotResponse>> hotspots(
            @RequestParam(defaultValue = "24") int hours,
            @RequestParam(defaultValue = "3") int minCount,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.hotspots(hours, minCount, principal));
    }
}
