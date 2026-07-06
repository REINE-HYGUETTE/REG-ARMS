package com.reg.arms.repository;

import com.reg.arms.entity.Request;
import com.reg.arms.entity.enums.PriorityLevel;
import com.reg.arms.entity.enums.RequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RequestRepository extends JpaRepository<Request, Long>, JpaSpecificationExecutor<Request> {

    Optional<Request> findByRequestCode(String requestCode);

    /** Active (non-archived) requests in a district — used for STAFF-scoped dashboard stats. */
    List<Request> findByDistrictIgnoreCaseAndArchivedAtIsNull(String district);

    Page<Request> findByCustomerId(Long customerId, Pageable pageable);

    Page<Request> findByAssignedTechnicianId(Long technicianId, Pageable pageable);

    List<Request> findByAssignedTechnicianIdAndStatusInOrderByCreatedAtDesc(Long technicianId, List<RequestStatus> statuses);

    @Query(value = "SELECT COUNT(*) FROM requests WHERE EXTRACT(YEAR FROM created_at) = :year",
           nativeQuery = true)
    long countByYear(@Param("year") int year);

    /** Atomically advance the request-code sequence and return the next value. */
    @Query(value = "SELECT nextval('request_code_seq')", nativeQuery = true)
    long nextRequestCodeSeq();

    @Query(value = "SELECT COUNT(*) FROM requests WHERE created_at >= :since",
           nativeQuery = true)
    long countSince(@Param("since") LocalDateTime since);

    @Query(value = "SELECT status, COUNT(*) FROM requests GROUP BY status",
           nativeQuery = true)
    List<Object[]> countByStatusGrouped();

    @Query("SELECT r.province, COUNT(r) FROM Request r GROUP BY r.province")
    List<Object[]> countByProvince();

    @Query(value = "SELECT sector, COUNT(*) AS cnt FROM requests " +
                   "WHERE sector IS NOT NULL AND sector <> '' " +
                   "GROUP BY sector ORDER BY cnt DESC LIMIT 20",
           nativeQuery = true)
    List<Object[]> countBySector();

    @Query(value = "SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*), " +
                   "SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) " +
                   "FROM requests WHERE created_at >= :since " +
                   "GROUP BY month ORDER BY month",
           nativeQuery = true)
    List<Object[]> monthlyVolume(@Param("since") LocalDateTime since);

    @Query(value = "SELECT COALESCE(manual_priority::text, ai_priority::text, 'Medium') AS priority, COUNT(*) " +
                   "FROM requests GROUP BY priority",
           nativeQuery = true)
    List<Object[]> countByFinalPriority();

    @Query("SELECT r.category.name, COUNT(r) FROM Request r GROUP BY r.category.name ORDER BY COUNT(r) DESC")
    List<Object[]> countByCategory();

    @Query(value = "SELECT r.assigned_tech_id, u.first_name, u.last_name, " +
                   "COUNT(*), SUM(CASE WHEN r.status = 'Resolved' THEN 1 ELSE 0 END) " +
                   "FROM requests r JOIN users u ON u.id = r.assigned_tech_id " +
                   "WHERE r.assigned_tech_id IS NOT NULL " +
                   "GROUP BY r.assigned_tech_id, u.first_name, u.last_name " +
                   "ORDER BY COUNT(*) DESC",
           nativeQuery = true)
    List<Object[]> technicianPerformance();

    @Query(value = "SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) " +
                   "FROM requests WHERE status IN ('Resolved','Closed') AND resolved_at IS NOT NULL",
           nativeQuery = true)
    Double avgResolutionHours();

    // ── Feature 2: estimated resolution time per priority × category ──────────

    @Query(value = "SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) " +
                   "FROM requests " +
                   "WHERE status IN ('Resolved','Closed') " +
                   "  AND resolved_at IS NOT NULL " +
                   "  AND COALESCE(manual_priority::text, ai_priority::text) = :priority " +
                   "  AND category_id = :categoryId",
           nativeQuery = true)
    Double avgResolutionHoursByPriorityAndCategory(@Param("priority") String priority,
                                                    @Param("categoryId") Long categoryId);

    // ── Feature 3: similar / duplicate requests ──────────────────────────────

    /**
     * Cross-user similar-request lookup used by Staff/Admin.
     * Returns open requests in the same category+province within the last 30 days,
     * excluding the reference request itself.
     */
    @Query("SELECT r FROM Request r " +
           "JOIN FETCH r.customer " +
           "JOIN FETCH r.category " +
           "LEFT JOIN FETCH r.assignedTechnician " +
           "WHERE r.category.id = :categoryId " +
           "  AND r.province = :province " +
           "  AND r.status NOT IN (com.reg.arms.entity.enums.RequestStatus.Resolved, " +
           "                        com.reg.arms.entity.enums.RequestStatus.Closed, " +
           "                        com.reg.arms.entity.enums.RequestStatus.Cancelled) " +
           "  AND r.id <> :excludeId " +
           "  AND r.createdAt >= :since " +
           "ORDER BY r.createdAt DESC")
    List<Request> findSimilarRequests(@Param("categoryId") Long categoryId,
                                       @Param("province")   String province,
                                       @Param("excludeId")  Long excludeId,
                                       @Param("since")      LocalDateTime since);

    /**
     * User-scoped duplicate check — only looks at the specific customer's own requests.
     * Returns open (Pending / In_Progress / On_Hold) requests for the given customer
     * in the same category, excluding the reference request id.
     * Pass {@code excludeId = -1L} for a pre-submit check where no request id exists yet.
     */
    @Query("SELECT r FROM Request r " +
           "JOIN FETCH r.customer " +
           "JOIN FETCH r.category " +
           "LEFT JOIN FETCH r.assignedTechnician " +
           "WHERE r.customer.id = :customerId " +
           "  AND r.category.id = :categoryId " +
           "  AND r.status NOT IN (com.reg.arms.entity.enums.RequestStatus.Resolved, " +
           "                        com.reg.arms.entity.enums.RequestStatus.Closed, " +
           "                        com.reg.arms.entity.enums.RequestStatus.Cancelled) " +
           "  AND r.id <> :excludeId " +
           "ORDER BY r.createdAt DESC")
    List<Request> findOpenByCustomerAndCategory(@Param("customerId") Long customerId,
                                                 @Param("categoryId") Long categoryId,
                                                 @Param("excludeId")  Long excludeId);

    // ── Date-range filtered list (used by export controller) ─────────────────

    @Query("SELECT r FROM Request r " +
           "JOIN FETCH r.customer " +
           "JOIN FETCH r.category " +
           "LEFT JOIN FETCH r.assignedTechnician " +
           "WHERE r.createdAt >= :start AND r.createdAt < :end " +
           "ORDER BY r.createdAt DESC")
    List<Request> findByDateRange(@Param("start") LocalDateTime start,
                                   @Param("end")   LocalDateTime end);

    /**
     * Staff-confirmed training candidates: requests where a manual priority override
     * has been set AND the description is non-null.  Pageable allows the AI retrain
     * service to cap the result set without loading all rows into memory first.
     */
    @Query("SELECT r FROM Request r " +
           "WHERE r.manualPriority IS NOT NULL " +
           "  AND r.description IS NOT NULL " +
           "  AND r.description <> '' " +
           "ORDER BY r.updatedAt DESC")
    org.springframework.data.domain.Page<Request> findStaffConfirmedForRetrain(
            org.springframework.data.domain.Pageable pageable);

    // ── Customer stats by status ──────────────────────────────────────────────

    @Query("SELECT r.status, COUNT(r) FROM Request r WHERE r.customer.id = :customerId GROUP BY r.status")
    List<Object[]> countByStatusForCustomer(@Param("customerId") Long customerId);

    // ── AI manual override count ──────────────────────────────────────────────

    @Query(value = "SELECT COUNT(*) FROM requests WHERE manual_priority IS NOT NULL", nativeQuery = true)
    long countManualOverrides();

    // ── SLA breach scheduler: open requests past their deadline, not yet notified ──

    @Query(value =
        "SELECT * FROM requests " +
        "WHERE status NOT IN ('Resolved','Closed','Cancelled') " +
        "  AND sla_breach_notified_at IS NULL " +
        "  AND CASE COALESCE(manual_priority::text, ai_priority::text, 'Medium') " +
        "        WHEN 'Critical' THEN created_at + INTERVAL '2 hours' " +
        "        WHEN 'High'     THEN created_at + INTERVAL '8 hours' " +
        "        WHEN 'Medium'   THEN created_at + INTERVAL '24 hours' " +
        "        ELSE                 created_at + INTERVAL '72 hours' END < NOW()",
        nativeQuery = true)
    List<Request> findBreachedAndUnnotified();

    /**
     * Faster-path variant: only Critical-priority requests whose 2-hour SLA
     * has passed and have not yet been notified.  Polled every 2 minutes so
     * Critical breaches are surfaced quickly, independent of the 10-minute
     * full-priority scan.
     */
    @Query(value =
        "SELECT * FROM requests " +
        "WHERE status NOT IN ('Resolved','Closed','Cancelled') " +
        "  AND sla_breach_notified_at IS NULL " +
        "  AND COALESCE(manual_priority::text, ai_priority::text, '') = 'Critical' " +
        "  AND created_at + INTERVAL '2 hours' < NOW()",
        nativeQuery = true)
    List<Request> findCriticalBreachedAndUnnotified();

    // ── SLA metrics (uses SLA hour windows per priority) ─────────────────────
    // SLA windows: Critical=2h, High=8h, Medium=24h, Low=72h
    // For open requests: count BREACHED (deadline already passed) and AT_RISK (≥70% elapsed)
    // For resolved requests: count how many were resolved within their SLA window

    @Query(value =
        "SELECT " +
        "  COUNT(*) FILTER (WHERE status NOT IN ('Resolved','Closed','Cancelled') " +
        "    AND CASE COALESCE(manual_priority::text, ai_priority::text, 'Medium') " +
        "          WHEN 'Critical' THEN created_at + INTERVAL '2 hours' " +
        "          WHEN 'High'     THEN created_at + INTERVAL '8 hours' " +
        "          WHEN 'Medium'   THEN created_at + INTERVAL '24 hours' " +
        "          ELSE                 created_at + INTERVAL '72 hours' END < NOW() " +
        "  ) AS breached, " +
        "  COUNT(*) FILTER (WHERE status NOT IN ('Resolved','Closed','Cancelled') " +
        "    AND CASE COALESCE(manual_priority::text, ai_priority::text, 'Medium') " +
        "          WHEN 'Critical' THEN created_at + INTERVAL '2 hours' " +
        "          WHEN 'High'     THEN created_at + INTERVAL '8 hours' " +
        "          WHEN 'Medium'   THEN created_at + INTERVAL '24 hours' " +
        "          ELSE                 created_at + INTERVAL '72 hours' END >= NOW() " +
        "    AND EXTRACT(EPOCH FROM (NOW() - created_at)) / " +
        "        CASE COALESCE(manual_priority::text, ai_priority::text, 'Medium') " +
        "          WHEN 'Critical' THEN 7200   WHEN 'High' THEN 28800 " +
        "          WHEN 'Medium'   THEN 86400  ELSE 259200 END >= 0.7 " +
        "  ) AS at_risk, " +
        "  COUNT(*) FILTER (WHERE status IN ('Resolved','Closed') AND resolved_at IS NOT NULL " +
        "    AND resolved_at <= CASE COALESCE(manual_priority::text, ai_priority::text, 'Medium') " +
        "          WHEN 'Critical' THEN created_at + INTERVAL '2 hours' " +
        "          WHEN 'High'     THEN created_at + INTERVAL '8 hours' " +
        "          WHEN 'Medium'   THEN created_at + INTERVAL '24 hours' " +
        "          ELSE                 created_at + INTERVAL '72 hours' END " +
        "  ) AS resolved_within_sla, " +
        "  COUNT(*) FILTER (WHERE status IN ('Resolved','Closed') AND resolved_at IS NOT NULL) AS total_resolved " +
        "FROM requests",
        nativeQuery = true)
    List<Object[]> slaMetrics();

    // ── Feature 4: hotspot detection ─────────────────────────────────────────

    @Query(value = "SELECT sector, district, province, " +
                   "       COUNT(*) AS total, " +
                   "       SUM(CASE WHEN COALESCE(manual_priority::text, ai_priority::text) = 'Critical' THEN 1 ELSE 0 END) AS crit, " +
                   "       SUM(CASE WHEN COALESCE(manual_priority::text, ai_priority::text) = 'High'     THEN 1 ELSE 0 END) AS hi, " +
                   "       MAX(created_at) AS latest " +
                   "FROM requests " +
                   "WHERE created_at >= :since " +
                   "  AND sector IS NOT NULL " +
                   "  AND COALESCE(manual_priority::text, ai_priority::text) IN ('Critical','High') " +
                   "GROUP BY sector, district, province " +
                   "HAVING COUNT(*) >= :minCount " +
                   "ORDER BY total DESC, latest DESC",
           nativeQuery = true)
    List<Object[]> findHotspots(@Param("since") LocalDateTime since,
                                 @Param("minCount") int minCount);

    /** District-scoped hotspots — used so STAFF only see clusters in their own district. */
    @Query(value = "SELECT sector, district, province, " +
                   "       COUNT(*) AS total, " +
                   "       SUM(CASE WHEN COALESCE(manual_priority::text, ai_priority::text) = 'Critical' THEN 1 ELSE 0 END) AS crit, " +
                   "       SUM(CASE WHEN COALESCE(manual_priority::text, ai_priority::text) = 'High'     THEN 1 ELSE 0 END) AS hi, " +
                   "       MAX(created_at) AS latest " +
                   "FROM requests " +
                   "WHERE created_at >= :since " +
                   "  AND sector IS NOT NULL " +
                   "  AND LOWER(district) = LOWER(:district) " +
                   "  AND COALESCE(manual_priority::text, ai_priority::text) IN ('Critical','High') " +
                   "GROUP BY sector, district, province " +
                   "HAVING COUNT(*) >= :minCount " +
                   "ORDER BY total DESC, latest DESC",
           nativeQuery = true)
    List<Object[]> findHotspotsByDistrict(@Param("since") LocalDateTime since,
                                          @Param("minCount") int minCount,
                                          @Param("district") String district);
}
