package com.reg.arms.controller;

import com.reg.arms.dto.request.ScheduleEntryRequest;
import com.reg.arms.dto.request.UpdateTechnicianProfileRequest;
import com.reg.arms.dto.response.ApiResponse;
import com.reg.arms.dto.response.ScheduleEntryResponse;
import com.reg.arms.dto.response.TechnicianResponse;
import com.reg.arms.security.UserPrincipal;
import com.reg.arms.service.TechnicianService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/technicians")
@RequiredArgsConstructor
public class TechnicianController {

    private final TechnicianService technicianService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ResponseEntity<List<TechnicianResponse>> listAll(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(technicianService.listAll(principal));
    }

    @GetMapping("/available")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ResponseEntity<List<TechnicianResponse>> listAvailable(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(technicianService.listAvailable(principal));
    }

    @GetMapping("/{id}/requests")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ResponseEntity<Map<String, Object>> getTechnicianRequests(@PathVariable Long id) {
        return ResponseEntity.ok(technicianService.getTechnicianRequests(id));
    }

    /**
     * Staff / Admin: update a technician's operational profile
     * (specialisation tags, coverage areas, max workload).
     */
    @PatchMapping("/{id}/profile")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ResponseEntity<TechnicianResponse> updateProfile(
            @PathVariable Long id,
            @RequestBody UpdateTechnicianProfileRequest request) {
        return ResponseEntity.ok(technicianService.updateProfile(id, request));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public ResponseEntity<TechnicianResponse> me(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(technicianService.getByUserId(principal.getId()));
    }

    /**
     * Technician self-service profile update.
     * Allows updating specialisation, tags, and coverage areas.
     * maxWorkload is intentionally excluded — that is a staff/admin decision.
     */
    @PatchMapping("/me/profile")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public ResponseEntity<TechnicianResponse> updateMyProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody UpdateTechnicianProfileRequest request) {
        return ResponseEntity.ok(technicianService.updateMyProfile(principal.getId(), request));
    }

    @GetMapping("/schedule")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public ResponseEntity<List<ScheduleEntryResponse>> getSchedule(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(technicianService.getSchedule(principal.getId()));
    }

    @PutMapping("/schedule")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public ResponseEntity<List<ScheduleEntryResponse>> updateSchedule(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody List<ScheduleEntryRequest> entries) {
        return ResponseEntity.ok(technicianService.updateSchedule(principal.getId(), entries));
    }

    @PatchMapping("/toggle-availability")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public ResponseEntity<ApiResponse> toggleAvailability(@AuthenticationPrincipal UserPrincipal principal) {
        technicianService.toggleAvailability(principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Availability toggled."));
    }
}
