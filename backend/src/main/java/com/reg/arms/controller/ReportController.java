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

    @GetMapping("/monthly-volume")
    public ResponseEntity<List<Map<String, Object>>> monthlyVolume(
            @RequestParam(defaultValue = "12") int months) {
        return ResponseEntity.ok(reportService.monthlyVolume(months));
    }

    @GetMapping("/by-priority")
    public ResponseEntity<List<Map<String, Object>>> byPriority() {
        return ResponseEntity.ok(reportService.byPriority());
    }

    @GetMapping("/by-category")
    public ResponseEntity<List<Map<String, Object>>> byCategory() {
        return ResponseEntity.ok(reportService.byCategory());
    }

    @GetMapping("/by-province")
    public ResponseEntity<List<Map<String, Object>>> byProvince() {
        return ResponseEntity.ok(reportService.byProvince());
    }

    @GetMapping("/by-sector")
    public ResponseEntity<List<Map<String, Object>>> bySector() {
        return ResponseEntity.ok(reportService.bySector());
    }

    @GetMapping("/by-status")
    public ResponseEntity<List<Map<String, Object>>> byStatus() {
        return ResponseEntity.ok(reportService.byStatus());
    }

    @GetMapping("/technician-performance")
    public ResponseEntity<List<Map<String, Object>>> technicianPerformance() {
        return ResponseEntity.ok(reportService.technicianPerformance());
    }

    @GetMapping("/ai-accuracy")
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
    public ResponseEntity<Map<String, Object>> slaMetrics() {
        return ResponseEntity.ok(reportService.slaMetrics());
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
