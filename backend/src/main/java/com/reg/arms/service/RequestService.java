package com.reg.arms.service;

import com.reg.arms.dto.request.AssignTechnicianRequest;
import com.reg.arms.dto.request.CreateRequestDto;
import com.reg.arms.dto.request.SetPriorityRequest;
import com.reg.arms.dto.request.UpdateStatusRequest;
import com.reg.arms.dto.response.*;
import com.reg.arms.entity.*;
import com.reg.arms.dto.response.ActivityLogResponse;
import com.reg.arms.entity.enums.NotificationType;
import com.reg.arms.entity.enums.PriorityLevel;
import com.reg.arms.entity.enums.RequestStatus;
import com.reg.arms.entity.enums.UserRole;
import org.springframework.beans.factory.annotation.Value;
import com.reg.arms.exception.BadRequestException;
import com.reg.arms.exception.ResourceNotFoundException;
import com.reg.arms.repository.*;
import com.reg.arms.security.UserPrincipal;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.multipart.MultipartFile;

import com.reg.arms.util.SlaUtils;
import com.reg.arms.dto.response.TechnicianRecommendationResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RequestService {

    @Value("${app.frontend-url}")
    private String frontendUrl;

    private final RequestRepository requestRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final CommentRepository commentRepository;
    private final RequestAttachmentRepository attachmentRepository;
    private final AiPredictionService aiPredictionService;
    private final AiPredictionRepository aiPredictionRepository;
    private final NotificationService notificationService;
    private final TechnicianService technicianService;
    private final com.reg.arms.repository.TechnicianRepository technicianRepository;
    private final FileStorageService fileStorageService;
    private final ActivityLogService activityLogService;
    private final ActivityLogRepository activityLogRepository;
    private final TechnicianMatchService technicianMatchService;
    private final EmailService emailService;

    @Transactional
    public RequestDetailResponse create(CreateRequestDto dto, UserPrincipal principal, List<MultipartFile> files) {
        User customer = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", principal.getId()));

        Category category = categoryRepository.findById(dto.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", dto.getCategoryId()));

        AiPredictionService.AiResult aiResult = aiPredictionService.predict(
                dto.getTitle(), dto.getDescription(),
                category.getName(), category.getDefaultPriority());

        String code = generateRequestCode();

        Request request = Request.builder()
                .requestCode(code)
                .customer(customer)
                .category(category)
                .title(dto.getTitle())
                .description(dto.getDescription())
                .province(dto.getProvince())
                .district(dto.getDistrict())
                .sector(dto.getSector())
                .cell(dto.getCell())
                .village(dto.getVillage())
                .phone(dto.getPhone() != null ? dto.getPhone() : customer.getPhone())
                .aiPriority(aiResult.priority())
                .aiConfidence(aiResult.confidence())
                .aiKeywordsDetected(aiResult.keywords() != null ? Map.of("keywords", aiResult.keywords()) : null)
                .status(RequestStatus.Pending)
                .build();

        request = requestRepository.save(request);

        // ── Possible-duplicate flag ────────────────────────────────────────────
        // Check if this customer already has another open request in the same
        // category.  We mark the NEW request as possibleDuplicate so Staff/Admin
        // can spot it immediately.  The pre-submit form check normally prevents
        // this, but we set the flag defensively here to cover edge cases (admin
        // creating on behalf of a customer, race conditions, etc.).
        List<com.reg.arms.entity.Request> openSameCategory =
                requestRepository.findOpenByCustomerAndCategory(
                        customer.getId(), category.getId(), request.getId());
        if (!openSameCategory.isEmpty()) {
            request.setPossibleDuplicate(true);
            request = requestRepository.save(request);
        }

        aiPredictionService.savePrediction(request, aiResult);

        if (files != null && !files.isEmpty()) {
            for (MultipartFile file : files) {
                if (!file.isEmpty()) {
                    String path = fileStorageService.store(file, "requests/" + request.getId());
                    RequestAttachment attachment = RequestAttachment.builder()
                            .request(request)
                            .uploadedBy(customer)
                            .fileName(file.getOriginalFilename())
                            .filePath(path)
                            .fileSize((int) file.getSize())
                            .fileType(file.getContentType())
                            .build();
                    request.getAttachments().add(attachment);
                }
            }
            requestRepository.save(request);
        }

        notificationService.notifyAdmins(request, NotificationType.NEW_REQUEST,
                "New Request Submitted",
                "A new request " + code + " has been submitted by " + customer.getFullName() + ".");

        activityLogService.logRequest(customer, request, "REQUEST_CREATED",
                "Request submitted by customer", null,
                "Status: Pending · Priority (AI): " + request.getAiPriority());

        // ── Gap 1: send immediate acknowledgement email to the customer ──────────
        emailService.sendRequestAcknowledgementEmail(
                customer.getEmail(),
                customer.getFullName(),
                code,
                category.getName(),
                request.getAiPriority() != null ? request.getAiPriority().name() : "Medium",
                slaWindow(request.getAiPriority()),
                frontendUrl + "/requests/" + request.getId());

        // ── Item 4: auto-assign Critical requests to the top-scored technician ──
        if (PriorityLevel.Critical.equals(request.getAiPriority())) {
            try {
                var recs = technicianMatchService.recommend(request.getId());
                if (!recs.isEmpty() && recs.get(0).getMatchScore() >= 60) {
                    var top = recs.get(0);
                    AssignTechnicianRequest autoDto = new AssignTechnicianRequest();
                    autoDto.setTechnicianId(top.getUserId());
                    assign(request.getId(), autoDto);
                    log.info("Auto-assigned '{}' (score {}) to Critical request {}",
                            top.getFullName(), top.getMatchScore(), request.getRequestCode());
                    notificationService.notifyAdmins(request, NotificationType.ASSIGNMENT,
                            "Auto-Assigned: " + request.getRequestCode(),
                            "Critical request " + request.getRequestCode()
                            + " was auto-assigned to " + top.getFullName()
                            + " (match score: " + top.getMatchScore() + "/100).");
                }
            } catch (Exception e) {
                log.warn("Auto-assignment failed for Critical request {}: {}",
                        request.getRequestCode(), e.getMessage());
            }
        }

        return toDetailResponse(request, principal);
    }

    @Transactional(readOnly = true)
    public Page<RequestListResponse> list(UserPrincipal principal, String search,
                                           RequestStatus status, PriorityLevel priority,
                                           String province, LocalDate dateFrom, LocalDate dateTo,
                                           String slaStatus, Pageable pageable) {
        final Long customerId = principal.getRole() == UserRole.CUSTOMER  ? principal.getId() : null;
        final Long techId     = principal.getRole() == UserRole.TECHNICIAN ? principal.getId() : null;

        // STAFF see only requests from their own district (district-scoped routing)
        final String staffDistrict;
        if (principal.getRole() == UserRole.STAFF) {
            User staffUser = userRepository.findById(principal.getId()).orElseThrow();
            staffDistrict = (staffUser.getDistrict() != null && !staffUser.getDistrict().isBlank())
                    ? staffUser.getDistrict() : null;
        } else {
            staffDistrict = null;
        }

        Specification<Request> spec = (root, query, cb) -> {
            // Eagerly fetch associations only for the data query (not the count query)
            if (query != null && !Long.class.equals(query.getResultType())) {
                root.fetch("customer", JoinType.INNER);
                root.fetch("category", JoinType.INNER);
                root.fetch("assignedTechnician", JoinType.LEFT);
                query.distinct(true);
            }

            List<Predicate> predicates = new ArrayList<>();

            // Always exclude soft-archived requests from active views
            predicates.add(cb.isNull(root.get("archivedAt")));

            if (customerId != null) {
                predicates.add(cb.equal(root.get("customer").get("id"), customerId));
            }
            if (techId != null) {
                predicates.add(cb.equal(root.get("assignedTechnician").get("id"), techId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (priority != null) {
                predicates.add(cb.equal(
                        cb.coalesce(root.get("manualPriority"), root.get("aiPriority")),
                        priority));
            }
            // Auto-scope: STAFF always see only their own district's requests
            if (staffDistrict != null) {
                predicates.add(cb.equal(cb.lower(root.get("district")),
                        staffDistrict.toLowerCase()));
            }
            if (province != null && !province.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("province")),
                        province.toLowerCase()));
            }
            if (dateFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"),
                        dateFrom.atStartOfDay()));
            }
            if (dateTo != null) {
                predicates.add(cb.lessThan(root.get("createdAt"),
                        dateTo.plusDays(1).atStartOfDay()));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")),                    pattern),
                        cb.like(cb.lower(root.get("requestCode")),              pattern),
                        cb.like(cb.lower(root.get("province")),                 pattern),
                        cb.like(cb.lower(root.get("district")),                 pattern),
                        cb.like(cb.lower(root.get("sector")),                   pattern),
                        cb.like(cb.lower(root.get("customer").get("firstName")), pattern),
                        cb.like(cb.lower(root.get("customer").get("lastName")),  pattern),
                        cb.like(cb.lower(root.get("customer").get("email")),     pattern)
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        // ── SLA status post-filter ────────────────────────────────────────────
        // JPA Criteria API cannot express PostgreSQL interval arithmetic, so when
        // an SLA filter is active we fetch all matching rows and filter in Java.
        if (slaStatus != null && !slaStatus.isBlank()) {
            List<RequestListResponse> all = requestRepository.findAll(spec).stream()
                    .map(RequestListResponse::from)
                    .filter(r -> slaStatus.equalsIgnoreCase(r.getSlaStatus()))
                    .collect(Collectors.toList());

            int start   = (int) pageable.getOffset();
            int end     = Math.min(start + pageable.getPageSize(), all.size());
            List<RequestListResponse> slice = start < all.size() ? all.subList(start, end) : List.of();
            return new PageImpl<>(slice, pageable, all.size());
        }

        return requestRepository.findAll(spec, pageable).map(RequestListResponse::from);
    }

    @Transactional(readOnly = true)
    public RequestDetailResponse get(Long id, UserPrincipal principal) {
        Request request = findRequestOrThrow(id);

        if (principal.getRole() == UserRole.CUSTOMER &&
                !request.getCustomer().getId().equals(principal.getId())) {
            throw new BadRequestException("Access denied");
        }

        return toDetailResponse(request, principal);
    }

    @Transactional
    public void updateStatus(Long id, UpdateStatusRequest dto, UserPrincipal principal) {
        Request request = findRequestOrThrow(id);
        String oldStatus = request.getStatus().name();

        // Staff/Technicians cannot directly cancel a request — only customers can.
        // Cancellation is handled exclusively through POST /requests/{id}/cancel.
        if (dto.getStatus() == RequestStatus.Cancelled) {
            throw new BadRequestException(
                "Staff cannot cancel requests directly. " +
                "The customer must cancel their own request.");
        }

        request.setStatus(dto.getStatus());

        if (dto.getStatus() == RequestStatus.Resolved) {
            request.setResolvedAt(LocalDateTime.now());
            if (request.getAssignedTechnician() != null) {
                // Item 2: pass category name so per-category history is updated
                technicianService.recordResolution(
                        request.getAssignedTechnician().getId(),
                        request.getCategory().getName());
                // Clear pursuing flag so the technician returns to "Free" state
                clearPursuingIfMatch(request.getAssignedTechnician().getId(), request.getId());
            }
            if (dto.getResolutionNotes() != null && !dto.getResolutionNotes().isBlank()) {
                request.setResolutionNotes(dto.getResolutionNotes());
            }
        } else if (dto.getStatus() == RequestStatus.Closed) {
            request.setClosedAt(LocalDateTime.now());
            if (request.getAssignedTechnician() != null) {
                clearPursuingIfMatch(request.getAssignedTechnician().getId(), request.getId());
            }
        }

        requestRepository.save(request);

        if (dto.getComment() != null && !dto.getComment().isBlank()) {
            User user = userRepository.findById(principal.getId()).orElseThrow();
            Comment comment = Comment.builder()
                    .request(request)
                    .user(user)
                    .body(dto.getComment())
                    .isInternal(false)
                    .build();
            commentRepository.save(comment);
        }

        notificationService.notifyUser(request.getCustomer(), request,
                NotificationType.STATUS_UPDATE,
                "Request Status Updated",
                "Your request " + request.getRequestCode() + " status changed to " + dto.getStatus().toDbValue() + ".");

        User actor = userRepository.findById(principal.getId()).orElse(null);
        activityLogService.logRequest(actor, request, "STATUS_CHANGED",
                "Status updated" + (dto.getResolutionNotes() != null && !dto.getResolutionNotes().isBlank()
                        ? " · Resolution notes added" : ""),
                oldStatus,
                dto.getStatus().name());
    }

    @Transactional
    public void assign(Long id, AssignTechnicianRequest dto) {
        Request request = findRequestOrThrow(id);

        User technician = userRepository.findById(dto.getTechnicianId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", dto.getTechnicianId()));

        if (technician.getRole() != UserRole.TECHNICIAN) {
            throw new BadRequestException("User is not a technician");
        }

        // ── District enforcement ──────────────────────────────────────────────
        // A technician can only be assigned to requests within their own district.
        // We skip the check if either side has no district set (legacy / admin override).
        String reqDistrict  = request.getDistrict();
        String techDistrict = technician.getDistrict();
        if (reqDistrict  != null && !reqDistrict.isBlank()
         && techDistrict != null && !techDistrict.isBlank()
         && !reqDistrict.equalsIgnoreCase(techDistrict)) {
            throw new BadRequestException(
                "Cannot assign: " + technician.getFullName() + " belongs to " + techDistrict
                + " district, but this request is from " + reqDistrict
                + " district. Technicians can only handle requests within their own district.");
        }

        // If a different technician is already assigned, release their workload slot
        // (use releaseWorkload, not decrementWorkload — this is not a resolution)
        User previousTech = request.getAssignedTechnician();
        if (previousTech != null && !previousTech.getId().equals(technician.getId())) {
            technicianService.releaseWorkload(previousTech.getId());
            log.info("Released workload for previously assigned technician {} on request {}",
                    previousTech.getId(), request.getRequestCode());
        }

        request.setAssignedTechnician(technician);
        // Status moves to Assigned (not In_Progress) — the technician must click
        // "Pursue" to formally accept and begin working.
        request.setStatus(RequestStatus.Assigned);
        requestRepository.save(request);

        // Only increment workload for a new assignment (not a no-op re-assign)
        if (previousTech == null || !previousTech.getId().equals(technician.getId())) {
            technicianService.incrementWorkload(technician.getId());
        }

        // Urgent notification for Critical requests — bold message so it stands out
        boolean isCritical = PriorityLevel.Critical.equals(request.getFinalPriority());
        notificationService.notifyUser(technician, request,
                NotificationType.ASSIGNMENT,
                isCritical ? "🚨 CRITICAL Request Assigned — Action Required"
                           : "New Request Assigned",
                isCritical
                    ? "CRITICAL request " + request.getRequestCode()
                      + " has been assigned to you and requires immediate action. Open it now."
                    : "Request " + request.getRequestCode() + " has been assigned to you.");

        // Item 7: log recommendation rank if staff assigned from the AI panel
        String assignNote = "Request assigned to " + technician.getFullName();
        if (dto.getRecommendationRank() != null) {
            assignNote += " (AI recommendation rank #" + dto.getRecommendationRank() + ")";
        }
        activityLogService.logRequest(null, request, "TECHNICIAN_ASSIGNED",
                assignNote,
                previousTech != null ? previousTech.getFullName() : null,
                technician.getFullName());
    }

    // ── Pursue flow ───────────────────────────────────────────────────────────

    /**
     * Technician formally accepts and begins working on an assigned request.
     *
     * <ul>
     *   <li>Verifies the request is in {@code Assigned} status.</li>
     *   <li>Verifies the caller is the assigned technician.</li>
     *   <li>Sets status → {@code In_Progress}.</li>
     *   <li>Marks the technician as "Pursuing" this request.</li>
     * </ul>
     */
    @Transactional
    public void pursue(Long requestId, UserPrincipal principal) {
        Request request = findRequestOrThrow(requestId);

        if (request.getStatus() != RequestStatus.Assigned) {
            throw new BadRequestException(
                "Pursue is only available for Assigned requests. Current status: "
                + request.getStatus().toDbValue());
        }
        if (request.getAssignedTechnician() == null
                || !request.getAssignedTechnician().getId().equals(principal.getId())) {
            throw new BadRequestException("You are not the assigned technician for this request.");
        }

        request.setStatus(RequestStatus.In_Progress);
        requestRepository.save(request);

        // Flag the technician as pursuing — routing algorithm will rank them lower
        // for new assignments but they remain eligible (especially for Critical requests).
        technicianService.setPursuing(principal.getId(), request);

        notificationService.notifyUser(request.getCustomer(), request,
                NotificationType.STATUS_UPDATE,
                "Request In Progress",
                "Your request " + request.getRequestCode()
                + " is now being actively worked on by your assigned technician.");

        activityLogService.logRequest(
                userRepository.findById(principal.getId()).orElse(null),
                request, "PURSUE",
                "Technician accepted and started pursuing request",
                "Assigned", "In_Progress");
    }

    /**
     * Technician reports a problem with an Assigned or In_Progress request.
     *
     * <ul>
     *   <li>Sets status → {@code Problematic}.</li>
     *   <li>Technician stays assigned — they may continue once staff resolves the issue.</li>
     *   <li>Notifies Staff and Admin to review and act.</li>
     * </ul>
     */
    @Transactional
    public void cannotPursue(Long requestId, UserPrincipal principal, String reason) {
        Request request = findRequestOrThrow(requestId);

        if (request.getStatus() != RequestStatus.Assigned
                && request.getStatus() != RequestStatus.In_Progress) {
            throw new BadRequestException(
                "Cannot Pursue is only available for Assigned or In Progress requests. Current status: "
                + request.getStatus().toDbValue());
        }
        if (request.getAssignedTechnician() == null
                || !request.getAssignedTechnician().getId().equals(principal.getId())) {
            throw new BadRequestException("You are not the assigned technician for this request.");
        }

        String previousStatus = request.getStatus().toDbValue();
        request.setStatus(RequestStatus.Problematic);
        requestRepository.save(request);

        String reasonNote = (reason != null && !reason.isBlank()) ? " Reason: " + reason : "";
        String techName   = request.getAssignedTechnician().getFullName();

        notificationService.notifyStaffAndAdmins(request, NotificationType.URGENT_ALERT,
                "Problem Reported: " + request.getRequestCode(),
                techName + " reported a problem with request "
                + request.getRequestCode() + " (" + request.getTitle() + ")."
                + reasonNote + " The technician remains assigned — please review and resolve.");

        activityLogService.logRequest(
                userRepository.findById(principal.getId()).orElse(null),
                request, "PROBLEMATIC",
                "Technician reported a problem" + (reason != null && !reason.isBlank() ? ": " + reason : ""),
                previousStatus, "Problematic");
    }

    /**
     * Staff resolves the problem flag on a Problematic request.
     *
     * <ul>
     *   <li>Sets status back to {@code Assigned} so the technician can pursue again.</li>
     *   <li>Notifies the assigned technician that they can continue.</li>
     * </ul>
     */
    @Transactional
    public void resolveProblematic(Long requestId, UserPrincipal principal, String note) {
        Request request = findRequestOrThrow(requestId);

        if (request.getStatus() != RequestStatus.Problematic) {
            throw new BadRequestException(
                "Resolve is only available for Problematic requests. Current status: "
                + request.getStatus().toDbValue());
        }

        request.setStatus(RequestStatus.Assigned);
        requestRepository.save(request);

        String noteText = (note != null && !note.isBlank()) ? " Note: " + note : "";

        if (request.getAssignedTechnician() != null) {
            notificationService.notifyUser(request.getAssignedTechnician(), request,
                    NotificationType.STATUS_UPDATE,
                    "Issue Resolved — Please Continue",
                    "The issue on request " + request.getRequestCode()
                    + " (" + request.getTitle() + ") has been resolved by staff."
                    + noteText + " You can now pursue this request.");
        }

        activityLogService.logRequest(
                userRepository.findById(principal.getId()).orElse(null),
                request, "RESOLVE_PROBLEMATIC",
                "Staff resolved the reported problem — request returned to Assigned"
                + (note != null && !note.isBlank() ? ". Note: " + note : ""),
                "Problematic", "Assigned");
    }

    /**
     * Clears the pursuing flag on a technician only if they are currently pursuing
     * the specified request.  Safe to call unconditionally on resolve/close.
     */
    private void clearPursuingIfMatch(Long techUserId, Long requestId) {
        try {
            technicianRepository.findByUserId(techUserId).ifPresent(tech -> {
                if (tech.getPursuingRequest() != null
                        && tech.getPursuingRequest().getId().equals(requestId)) {
                    tech.setPursuingRequest(null);
                    technicianRepository.save(tech);
                }
            });
        } catch (Exception e) {
            log.warn("Could not clear pursuing flag for technician {}: {}", techUserId, e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public DashboardStatsResponse getStats() {
        List<Object[]> statusCounts = requestRepository.countByStatusGrouped();
        List<Object[]> priorityCounts = requestRepository.countByFinalPriority();

        long total = 0, pending = 0, inProgress = 0, resolved = 0, closed = 0;
        for (Object[] row : statusCounts) {
            String statusStr = (String) row[0];
            long count = ((Number) row[1]).longValue();
            total += count;
            switch (statusStr) {
                case "Pending" -> pending = count;
                case "In_Progress" -> inProgress = count;
                case "Resolved" -> resolved = count;
                case "Closed" -> closed = count;
            }
        }

        long critical = 0, high = 0;
        for (Object[] row : priorityCounts) {
            String p = (String) row[0];
            long count = ((Number) row[1]).longValue();
            if ("Critical".equals(p)) critical = count;
            else if ("High".equals(p)) high = count;
        }

        long thisWeek = requestRepository.countSince(LocalDateTime.now().minusDays(7));
        Double avgHours = requestRepository.avgResolutionHours();

        return DashboardStatsResponse.builder()
                .total(total)
                .pending(pending)
                .inProgress(inProgress)
                .resolved(resolved)
                .closed(closed)
                .critical(critical)
                .high(high)
                .thisWeek(thisWeek)
                .avgResolutionHours(avgHours)
                .build();
    }

    @Transactional
    public void setManualPriority(Long id, SetPriorityRequest dto) {
        Request request = findRequestOrThrow(id);
        String oldPriority = request.getFinalPriority() != null ? request.getFinalPriority().name() : null;
        request.setManualPriority(dto.getPriority());
        requestRepository.save(request);

        activityLogService.logRequest(null, request, "PRIORITY_OVERRIDDEN",
                "Priority manually overridden (AI feedback recorded)",
                oldPriority,
                dto.getPriority().name());

        // ── AI accuracy feedback loop ────────────────────────────────────
        // When staff sets (or changes) the manual priority we treat that as
        // the confirmed "actual" priority and record whether the AI was right.
        // This populates actualPriority / isCorrect so the AI dashboard has
        // real accuracy data to display.
        aiPredictionRepository
                .findTopByRequestIdOrderByCreatedAtDesc(id)
                .ifPresentOrElse(prediction -> {
                    prediction.setActualPriority(dto.getPriority());
                    prediction.setIsCorrect(dto.getPriority() == prediction.getPredictedPriority());
                    aiPredictionRepository.save(prediction);
                    log.info("AI feedback recorded for request {}: predicted={} actual={} correct={}",
                            id,
                            prediction.getPredictedPriority(),
                            dto.getPriority(),
                            dto.getPriority() == prediction.getPredictedPriority());
                }, () -> log.debug("No AI prediction row found for request {} — skipping feedback", id));
    }

    // ── Admin soft-archive ────────────────────────────────────────────────────

    @Transactional
    public void archive(Long requestId, Long adminId) {
        Request request = findRequestOrThrow(requestId);
        if (request.getArchivedAt() != null) {
            throw new BadRequestException("Request is already archived.");
        }
        request.setArchivedAt(LocalDateTime.now());
        requestRepository.save(request);
        activityLogService.logRequest(
                userRepository.findById(adminId).orElse(null),
                request, "REQUEST_ARCHIVED", "Request archived by admin", null, null);
        log.info("Request {} archived by admin userId={}", request.getRequestCode(), adminId);
    }

    @Transactional
    public void unarchive(Long requestId, Long adminId) {
        Request request = findRequestOrThrow(requestId);
        if (request.getArchivedAt() == null) {
            throw new BadRequestException("Request is not archived.");
        }
        request.setArchivedAt(null);
        requestRepository.save(request);
        activityLogService.logRequest(
                userRepository.findById(adminId).orElse(null),
                request, "REQUEST_UNARCHIVED", "Request restored from archive by admin", null, null);
        log.info("Request {} unarchived by admin userId={}", request.getRequestCode(), adminId);
    }

    // ── Customer cancellation ─────────────────────────────────────────────────

    @Transactional
    public void cancel(Long requestId, Long customerId) {
        Request request = findRequestOrThrow(requestId);

        if (!request.getCustomer().getId().equals(customerId)) {
            throw new BadRequestException("You can only cancel your own requests");
        }
        if (request.getStatus() != RequestStatus.Pending) {
            throw new BadRequestException("Only Pending requests can be cancelled. This request is already " + request.getStatus().toDbValue() + ".");
        }

        request.setStatus(RequestStatus.Cancelled);
        requestRepository.save(request);
        log.info("Customer {} cancelled request {}", customerId, request.getRequestCode());

        User customer = request.getCustomer();
        activityLogService.logRequest(customer, request, "REQUEST_CANCELLED",
                "Request cancelled by customer", "Pending", "Cancelled");

        notificationService.notifyStaffAndAdmins(request, NotificationType.STATUS_UPDATE,
                "Request Cancelled: " + request.getRequestCode(),
                "Customer " + customer.getFullName() + " cancelled request " +
                request.getRequestCode() + " (" + request.getTitle() + ").");
    }

    private String generateRequestCode() {
        int year = Year.now().getValue();
        // Use a DB sequence for atomic, race-condition-free code generation.
        // Falls back to count-based numbering if the sequence isn't available yet.
        try {
            long seq = requestRepository.nextRequestCodeSeq();
            return String.format("REG-%d-%04d", year, seq);
        } catch (Exception e) {
            log.warn("request_code_seq not available, falling back to count-based code: {}", e.getMessage());
            long count = requestRepository.countByYear(year);
            return String.format("REG-%d-%04d", year, count + 1);
        }
    }

    private Request findRequestOrThrow(Long id) {
        return requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Request", "id", id));
    }

    // ── Customer satisfaction rating ──────────────────────────────────────────

    @Transactional
    public void rateResolution(Long requestId, Long customerId,
                               com.reg.arms.dto.request.RateResolutionRequest dto) {
        Request request = findRequestOrThrow(requestId);

        if (!request.getCustomer().getId().equals(customerId)) {
            throw new BadRequestException("You can only rate your own requests");
        }
        if (request.getStatus() != RequestStatus.Resolved && request.getStatus() != RequestStatus.Closed) {
            throw new BadRequestException("Request must be Resolved before it can be rated");
        }
        if (request.getAssignedTechnician() == null) {
            throw new BadRequestException("No technician was assigned to this request");
        }

        if (request.getSatisfactionRating() != null) {
            throw new BadRequestException("You have already rated this request");
        }

        double rating = dto.getRating();
        User technician = request.getAssignedTechnician();
        technicianService.updateRating(technician.getId(), rating);

        // Persist the rating on the request so it can be shown in the detail view
        request.setSatisfactionRating(dto.getRating());
        if (dto.getFeedback() != null && !dto.getFeedback().isBlank()) {
            request.setCustomerFeedback(dto.getFeedback().strip());
        }
        requestRepository.save(request);

        log.info("Customer {} rated request {} with {}/5", customerId, request.getRequestCode(), rating);

        notificationService.notifyUser(technician, request, NotificationType.SYSTEM,
                "New Rating Received",
                "You received a " + (int) rating + "/5 rating for resolving request " +
                request.getRequestCode() + ".");
    }

    // ── Feature 3: similar / duplicate requests ──────────────────────────────

    /**
     * Pre-submit duplicate check — scoped strictly to the authenticated user.
     * Returns the caller's own open requests in the same category (any status
     * except Resolved / Closed / Cancelled).  A non-empty result means the
     * customer already has an open request for this category and the form should
     * be blocked.
     *
     * <p>Pass {@code userId = principal.getId()} from the controller so this
     * never accidentally queries another user's requests.
     */
    @Transactional(readOnly = true)
    public List<SimilarRequestResponse> checkDuplicates(Long categoryId, Long userId) {
        return requestRepository.findOpenByCustomerAndCategory(userId, categoryId, -1L)
                .stream()
                .map(SimilarRequestResponse::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SimilarRequestResponse> findSimilar(Long id) {
        Request request = findRequestOrThrow(id);
        LocalDateTime since = LocalDateTime.now().minusDays(30);
        return requestRepository.findSimilarRequests(
                        request.getCategory().getId(),
                        request.getProvince(),
                        id,
                        since)
                .stream()
                .map(SimilarRequestResponse::from)
                .collect(Collectors.toList());
    }

    // ── Activity log ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ActivityLogResponse> getActivityLog(Long requestId, UserPrincipal principal) {
        Request request = findRequestOrThrow(requestId);
        // Customers may only see their own request logs
        if (principal.getRole() == UserRole.CUSTOMER &&
                !request.getCustomer().getId().equals(principal.getId())) {
            throw new BadRequestException("Access denied");
        }
        return activityLogRepository.findByRequestIdOrderByCreatedAtAsc(requestId)
                .stream().map(ActivityLogResponse::from).toList();
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    /**
     * Builds the full request detail response.  Comment visibility is enforced by role:
     * <ul>
     *   <li>CUSTOMER   — receives an empty comment list (thread is internal-only)</li>
     *   <li>TECHNICIAN — sees comments only if this request is assigned to them</li>
     *   <li>STAFF      — sees comments only for requests in their own district</li>
     *   <li>ADMIN      — sees all comments</li>
     * </ul>
     */
    private RequestDetailResponse toDetailResponse(Request request, UserPrincipal principal) {
        List<CommentResponse> comments;

        switch (principal.getRole()) {
            case CUSTOMER ->
                // Customers see only public (non-internal) comments on their own request
                comments = commentRepository.findByRequestIdOrderByCreatedAtAsc(request.getId())
                        .stream()
                        .filter(c -> !Boolean.TRUE.equals(c.getIsInternal()))
                        .map(CommentResponse::from)
                        .toList();

            case TECHNICIAN -> {
                boolean assignedToMe = request.getAssignedTechnician() != null
                        && request.getAssignedTechnician().getId().equals(principal.getId());
                comments = assignedToMe
                        ? commentRepository.findByRequestIdOrderByCreatedAtAsc(request.getId())
                                .stream().map(CommentResponse::from).toList()
                        : List.of();
            }

            case STAFF -> {
                String staffDistrict = principal.getDistrict();
                boolean inDistrict = staffDistrict == null || staffDistrict.isBlank()
                        || staffDistrict.equalsIgnoreCase(request.getDistrict());
                comments = inDistrict
                        ? commentRepository.findByRequestIdOrderByCreatedAtAsc(request.getId())
                                .stream().map(CommentResponse::from).toList()
                        : List.of();
            }

            default -> // ADMIN — unrestricted
                comments = commentRepository.findByRequestIdOrderByCreatedAtAsc(request.getId())
                        .stream().map(CommentResponse::from).toList();
        }

        List<AttachmentResponse> attachments = attachmentRepository.findByRequestId(request.getId())
                .stream().map(AttachmentResponse::from).toList();

        // Feature 2: estimated resolution time for this priority × category combination
        String priorityStr = request.getFinalPriority() != null
                ? request.getFinalPriority().name() : PriorityLevel.Medium.name();
        Double estimatedHours = requestRepository.avgResolutionHoursByPriorityAndCategory(
                priorityStr, request.getCategory().getId());

        return RequestDetailResponse.from(request, comments, attachments, estimatedHours);
    }

    /** Returns the human-readable SLA window for a given priority level. */
    private static String slaWindow(PriorityLevel priority) {
        if (priority == null) return "24 hours";
        return switch (priority) {
            case Critical -> "2 hours";
            case High     -> "8 hours";
            case Medium   -> "24 hours";
            case Low      -> "72 hours";
        };
    }
}
