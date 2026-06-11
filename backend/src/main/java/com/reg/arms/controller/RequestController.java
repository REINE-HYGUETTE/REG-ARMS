package com.reg.arms.controller;

import com.reg.arms.dto.request.AssignTechnicianRequest;
import com.reg.arms.dto.request.CreateRequestDto;
import com.reg.arms.dto.request.PredictRequestDto;
import com.reg.arms.dto.request.RateResolutionRequest;
import com.reg.arms.dto.request.SetPriorityRequest;
import com.reg.arms.dto.request.UpdateStatusRequest;
import com.reg.arms.dto.response.*;
import com.reg.arms.entity.Category;
import com.reg.arms.entity.enums.PriorityLevel;
import com.reg.arms.entity.enums.RequestStatus;
import com.reg.arms.exception.ResourceNotFoundException;
import com.reg.arms.repository.CategoryRepository;
import com.reg.arms.security.UserPrincipal;
import com.reg.arms.service.AiPredictionService;
import com.reg.arms.service.CategorySuggestionService;
import com.reg.arms.service.ReportService;
import com.reg.arms.service.RequestService;
import com.reg.arms.service.TechnicianMatchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/requests")
@RequiredArgsConstructor
public class RequestController {

    private final RequestService requestService;
    private final CategoryRepository categoryRepository;
    private final AiPredictionService aiPredictionService;
    private final TechnicianMatchService technicianMatchService;
    private final CategorySuggestionService categorySuggestionService;
    private final ReportService reportService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RequestDetailResponse> create(
            @Valid @ModelAttribute CreateRequestDto request,
            @RequestParam(required = false) List<MultipartFile> attachments,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(requestService.create(request, principal, attachments));
    }

    @GetMapping
    public ResponseEntity<Page<RequestListResponse>> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) RequestStatus status,
            @RequestParam(required = false) PriorityLevel priority,
            @RequestParam(required = false) String province,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate dateFrom,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate dateTo,
            @RequestParam(required = false) String slaStatus,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(requestService.list(principal, search, status, priority, province, dateFrom, dateTo, slaStatus, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RequestDetailResponse> get(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(requestService.get(id, principal));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('STAFF', 'TECHNICIAN')")
    public ResponseEntity<ApiResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStatusRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        requestService.updateStatus(id, request, principal);
        return ResponseEntity.ok(ApiResponse.success("Status updated."));
    }

    @PatchMapping("/{id}/assign")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<ApiResponse> assign(
            @PathVariable Long id,
            @Valid @RequestBody AssignTechnicianRequest request) {
        requestService.assign(id, request);
        return ResponseEntity.ok(ApiResponse.success("Request assigned."));
    }

    // ── Pursue flow ───────────────────────────────────────────────────────────

    /**
     * Technician formally accepts an Assigned request and begins working on it.
     * Sets status → In_Progress and marks the technician as "Pursuing".
     */
    @PostMapping("/{id}/pursue")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public ResponseEntity<ApiResponse> pursue(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        requestService.pursue(id, principal);
        return ResponseEntity.ok(ApiResponse.success("You are now pursuing this request. Good luck!"));
    }

    /**
     * Technician declines an Assigned request — it returns to Pending for re-routing.
     * Staff and Admin are notified immediately.
     */
    @PostMapping("/{id}/cannot-pursue")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public ResponseEntity<ApiResponse> cannotPursue(
            @PathVariable Long id,
            @RequestBody(required = false) com.reg.arms.dto.request.CannotPursueRequest body,
            @AuthenticationPrincipal UserPrincipal principal) {
        String reason = body != null ? body.getReason() : null;
        requestService.cannotPursue(id, principal, reason);
        return ResponseEntity.ok(ApiResponse.success("Request returned for re-routing. Staff has been notified."));
    }

    @PatchMapping("/{id}/priority")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<ApiResponse> setPriority(
            @PathVariable Long id,
            @Valid @RequestBody SetPriorityRequest request) {
        requestService.setManualPriority(id, request);
        return ResponseEntity.ok(ApiResponse.success("Priority override applied."));
    }

    @PostMapping("/predict")
    public ResponseEntity<PredictResponseDto> predict(@Valid @RequestBody PredictRequestDto request) {
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", request.getCategoryId()));
        AiPredictionService.AiResult result = aiPredictionService.predict(
                request.getTitle(), request.getDescription(),
                category.getName(), category.getDefaultPriority());
        return ResponseEntity.ok(PredictResponseDto.from(result));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ResponseEntity<DashboardStatsResponse> stats() {
        return ResponseEntity.ok(requestService.getStats());
    }

    // ── Feature 1: Smart technician matching ─────────────────────────────────

    @GetMapping("/{id}/technician-recommendations")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<List<TechnicianRecommendationResponse>> technicianRecommendations(
            @PathVariable Long id) {
        return ResponseEntity.ok(technicianMatchService.recommend(id));
    }

    // ── Feature 3: Duplicate / similar request detection ─────────────────────

    @GetMapping("/{id}/similar")
    public ResponseEntity<List<SimilarRequestResponse>> similar(@PathVariable Long id) {
        return ResponseEntity.ok(requestService.findSimilar(id));
    }

    /**
     * Pre-submit duplicate check — scoped to the authenticated customer's own requests.
     * Returns that customer's open requests in the same category.
     * A non-empty response means the submission form should be blocked.
     */
    @GetMapping("/check-duplicates")
    public ResponseEntity<List<SimilarRequestResponse>> checkDuplicates(
            @RequestParam Long categoryId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(requestService.checkDuplicates(categoryId, principal.getId()));
    }

    // ── Feature 5: Auto-suggest category ─────────────────────────────────────

    @GetMapping("/suggest-category")
    public ResponseEntity<CategorySuggestionResponse> suggestCategory(
            @RequestParam String title,
            @RequestParam(required = false, defaultValue = "") String description) {
        return ResponseEntity.ok(categorySuggestionService.suggest(title, description));
    }

    // ── Customer-scoped stats (fixes wrong counts on CustomerDashboard) ───────

    @GetMapping("/my-stats")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<Map<String, Long>> myStats(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(reportService.customerStats(principal.getId()));
    }

    // ── Activity log / audit trail ────────────────────────────────────────────

    @GetMapping("/{id}/activity-log")
    public ResponseEntity<List<ActivityLogResponse>> activityLog(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(requestService.getActivityLog(id, principal));
    }

    // ── Admin soft-archive ────────────────────────────────────────────────────

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse> archive(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        requestService.archive(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Request archived."));
    }

    @DeleteMapping("/{id}/archive")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse> unarchive(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        requestService.unarchive(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Request restored from archive."));
    }

    // ── Customer cancellation ─────────────────────────────────────────────────

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse> cancel(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        requestService.cancel(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Request cancelled."));
    }

    // ── Customer satisfaction rating after resolution ─────────────────────────

    @PostMapping("/{id}/rate")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse> rate(
            @PathVariable Long id,
            @Valid @RequestBody RateResolutionRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        requestService.rateResolution(id, principal.getId(), request);
        return ResponseEntity.ok(ApiResponse.success("Thank you for your feedback!"));
    }
}
