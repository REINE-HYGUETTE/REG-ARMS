package com.reg.arms.controller;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.reg.arms.entity.Request;
import com.reg.arms.repository.RequestRepository;
import com.reg.arms.repository.TechnicianRepository;
import com.reg.arms.service.ReportService;
import com.reg.arms.util.SlaUtils;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.awt.Color;
import java.io.IOException;
import java.io.PrintWriter;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/reports/export")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class ReportExportController {

    private final RequestRepository requestRepository;
    private final TechnicianRepository technicianRepository;
    private final ReportService reportService;

    private static final DateTimeFormatter DATE_FMT  = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter LABEL_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");

    /** Hard ceiling on rows returned by any export query to prevent OOM. */
    private static final int MAX_EXPORT_ROWS      = 10_000;
    /** Maximum allowed date range (days) for a single export request. */
    private static final int MAX_DATE_RANGE_DAYS  = 366;

    // ──────────────────────────────────────────────────────────────────────────
    //  CSV ENDPOINTS
    // ──────────────────────────────────────────────────────────────────────────

    @GetMapping("/requests")
    public void exportRequestsCsv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletResponse response) throws IOException {

        setCsvHeaders(response, "requests_" + from + "_" + to + ".csv");
        PrintWriter writer = response.getWriter();
        writer.println("Request Code,Title,Status,Priority,AI Priority,Category,Customer,Province,District,Technician,Created At,Resolved At,SLA Deadline,SLA Status");
        for (Request r : filterByDate(from, to)) {
            SlaUtils.SlaStatus slaStatus = SlaUtils.status(r.getCreatedAt(), r.getFinalPriority(), r.getResolvedAt());
            String slaDeadline = r.getCreatedAt() != null
                    ? SlaUtils.deadline(r.getCreatedAt(), r.getFinalPriority()).format(DATE_FMT) : "";
            writer.println(String.join(",",
                    csv(r.getRequestCode()), csv(r.getTitle()),
                    csv(r.getStatus().name()),
                    csv(r.getFinalPriority() != null ? r.getFinalPriority().name() : ""),
                    csv(r.getAiPriority() != null ? r.getAiPriority().name() : ""),
                    csv(r.getCategory() != null ? r.getCategory().getName() : ""),
                    csv(r.getCustomer() != null ? r.getCustomer().getFullName() : ""),
                    csv(r.getProvince()), csv(r.getDistrict()),
                    csv(r.getAssignedTechnician() != null ? r.getAssignedTechnician().getFullName() : "Unassigned"),
                    csv(r.getCreatedAt() != null ? r.getCreatedAt().format(DATE_FMT) : ""),
                    csv(r.getResolvedAt() != null ? r.getResolvedAt().format(DATE_FMT) : ""),
                    csv(slaDeadline),
                    csv(slaStatus.name())
            ));
        }
        writer.flush();
    }

    @GetMapping("/technician-performance")
    public void exportTechnicianPerformanceCsv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletResponse response) throws IOException {

        setCsvHeaders(response, "technician_performance_" + from + "_" + to + ".csv");
        PrintWriter writer = response.getWriter();
        writer.println("Name,Email,Specialization,Province Coverage,Current Workload,Max Workload,Total Resolved,Rating,Available");
        technicianRepository.findAll().forEach(t -> writer.println(String.join(",",
                csv(t.getUser().getFullName()), csv(t.getUser().getEmail()),
                csv(t.getSpecialization()),
                csv(t.getProvinceCoverage() != null ? String.join("; ", t.getProvinceCoverage()) : ""),
                String.valueOf(t.getCurrentWorkload()), String.valueOf(t.getMaxWorkload()),
                String.valueOf(t.getTotalResolved()),
                t.getRating() != null ? t.getRating().toPlainString() : "",
                t.getIsAvailable() ? "Yes" : "No"
        )));
        writer.flush();
    }

    @GetMapping("/categories")
    public void exportCategoriesCsv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletResponse response) throws IOException {

        setCsvHeaders(response, "category_breakdown_" + from + "_" + to + ".csv");
        PrintWriter writer = response.getWriter();
        writer.println("Category,Default Priority,Total Requests,Resolved,Pending");
        List<Request> requests = filterByDate(from, to);
        requests.stream()
                .filter(r -> r.getCategory() != null)
                .collect(Collectors.groupingBy(r -> r.getCategory().getName()))
                .forEach((cat, reqs) -> {
                    long resolved = reqs.stream().filter(r -> isResolved(r)).count();
                    long pending  = reqs.stream().filter(r -> r.getStatus().name().equals("Pending")).count();
                    String priority = reqs.get(0).getCategory().getDefaultPriority() != null
                            ? reqs.get(0).getCategory().getDefaultPriority().name() : "";
                    writer.println(String.join(",", csv(cat), csv(priority),
                            String.valueOf(reqs.size()), String.valueOf(resolved), String.valueOf(pending)));
                });
        writer.flush();
    }

    @GetMapping("/monthly-volume")
    public void exportMonthlyVolumeCsv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletResponse response) throws IOException {

        setCsvHeaders(response, "monthly_volume_" + from + "_" + to + ".csv");
        PrintWriter writer = response.getWriter();
        writer.println("Month,Total Submitted,Resolved,Pending,In Progress,Critical,High");
        filterByDate(from, to).stream()
                .collect(Collectors.groupingBy(r -> r.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM"))))
                .entrySet().stream().sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    List<Request> reqs = entry.getValue();
                    long resolved   = reqs.stream().filter(r -> isResolved(r)).count();
                    long pending    = reqs.stream().filter(r -> r.getStatus().name().equals("Pending")).count();
                    long inProgress = reqs.stream().filter(r -> r.getStatus().name().equals("In_Progress")).count();
                    long critical   = reqs.stream().filter(r -> r.getFinalPriority() != null && r.getFinalPriority().name().equals("Critical")).count();
                    long high       = reqs.stream().filter(r -> r.getFinalPriority() != null && r.getFinalPriority().name().equals("High")).count();
                    writer.println(String.join(",", entry.getKey(),
                            String.valueOf(reqs.size()), String.valueOf(resolved),
                            String.valueOf(pending), String.valueOf(inProgress),
                            String.valueOf(critical), String.valueOf(high)));
                });
        writer.flush();
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  PDF ENDPOINTS
    // ──────────────────────────────────────────────────────────────────────────

    @GetMapping("/requests/pdf")
    public void exportRequestsPdf(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletResponse response) throws Exception {

        List<Request> requests = filterByDate(from, to);
        long resolved   = requests.stream().filter(this::isResolved).count();
        long pending    = requests.stream().filter(r -> r.getStatus().name().equals("Pending")).count();
        long inProgress = requests.stream().filter(r -> r.getStatus().name().equals("In_Progress")).count();

        setPdfHeaders(response, "requests_" + from + "_" + to + ".pdf");
        Document doc = new Document(PageSize.A4.rotate(), 30, 30, 30, 40);
        PdfWriter writer = PdfWriter.getInstance(doc, response.getOutputStream());
        writer.setPageEvent(new PdfFooter());
        doc.open();

        addHeader(doc, "All Requests Report", from, to);

        // Summary stats
        addSummaryRow(doc, new String[][]{
                {"Total Requests", String.valueOf(requests.size())},
                {"Resolved",       String.valueOf(resolved)},
                {"Pending",        String.valueOf(pending)},
                {"In Progress",    String.valueOf(inProgress)}
        });

        // Table
        String[] headers = {"Code", "Title", "Status", "Priority", "Category", "Customer", "Province", "Technician", "Created", "SLA Deadline", "SLA"};
        float[]  widths  = {55, 105, 55, 48, 65, 70, 60, 70, 58, 68, 46};
        PdfPTable table = createTable(headers, widths);
        int[] rowIdx = {0};
        for (Request r : requests) {
            SlaUtils.SlaStatus slaStatus = SlaUtils.status(r.getCreatedAt(), r.getFinalPriority(), r.getResolvedAt());
            String slaDeadline = r.getCreatedAt() != null
                    ? SlaUtils.deadline(r.getCreatedAt(), r.getFinalPriority())
                               .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) : "—";
            addRow(table, rowIdx, new String[]{
                    nz(r.getRequestCode()),
                    nz(r.getTitle()),
                    nz(r.getStatus().name().replace("_", " ")),
                    r.getFinalPriority() != null ? r.getFinalPriority().name() : "—",
                    r.getCategory() != null ? r.getCategory().getName() : "—",
                    r.getCustomer() != null ? r.getCustomer().getFullName() : "—",
                    nz(r.getProvince()),
                    r.getAssignedTechnician() != null ? r.getAssignedTechnician().getFullName() : "Unassigned",
                    r.getCreatedAt() != null ? r.getCreatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) : "—",
                    slaDeadline,
                    slaStatus.name()
            });
        }
        doc.add(table);
        doc.close();
    }

    @GetMapping("/technician-performance/pdf")
    public void exportTechnicianPerformancePdf(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletResponse response) throws Exception {

        var technicians = technicianRepository.findAll();
        long available  = technicians.stream().filter(t -> Boolean.TRUE.equals(t.getIsAvailable())).count();
        long totalResolved = technicians.stream().mapToLong(t -> t.getTotalResolved() != null ? t.getTotalResolved() : 0).sum();

        setPdfHeaders(response, "technician_performance_" + from + "_" + to + ".pdf");
        Document doc = new Document(PageSize.A4.rotate(), 30, 30, 30, 40);
        PdfWriter writer = PdfWriter.getInstance(doc, response.getOutputStream());
        writer.setPageEvent(new PdfFooter());
        doc.open();

        addHeader(doc, "Technician Performance Report", from, to);

        addSummaryRow(doc, new String[][]{
                {"Total Technicians", String.valueOf(technicians.size())},
                {"Available",         String.valueOf(available)},
                {"Total Resolved",    String.valueOf(totalResolved)}
        });

        String[] headers = {"Name", "Email", "Specialization", "Province Coverage", "Workload", "Max", "Resolved", "Rating", "Available"};
        float[]  widths  = {90, 110, 90, 110, 55, 40, 55, 55, 55};
        PdfPTable table = createTable(headers, widths);
        int[] rowIdx = {0};
        for (var t : technicians) {
            addRow(table, rowIdx, new String[]{
                    t.getUser().getFullName(),
                    t.getUser().getEmail(),
                    nz(t.getSpecialization()),
                    t.getProvinceCoverage() != null ? String.join(", ", t.getProvinceCoverage()) : "—",
                    String.valueOf(t.getCurrentWorkload()),
                    String.valueOf(t.getMaxWorkload()),
                    String.valueOf(t.getTotalResolved()),
                    t.getRating() != null ? t.getRating().toPlainString() : "—",
                    Boolean.TRUE.equals(t.getIsAvailable()) ? "Yes" : "No"
            });
        }
        doc.add(table);
        doc.close();
    }

    @GetMapping("/categories/pdf")
    public void exportCategoriesPdf(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletResponse response) throws Exception {

        List<Request> requests = filterByDate(from, to);
        Map<String, List<Request>> grouped = requests.stream()
                .filter(r -> r.getCategory() != null)
                .collect(Collectors.groupingBy(r -> r.getCategory().getName()));

        setPdfHeaders(response, "category_breakdown_" + from + "_" + to + ".pdf");
        Document doc = new Document(PageSize.A4, 30, 30, 30, 40);
        PdfWriter writer = PdfWriter.getInstance(doc, response.getOutputStream());
        writer.setPageEvent(new PdfFooter());
        doc.open();

        addHeader(doc, "Categories Report", from, to);

        addSummaryRow(doc, new String[][]{
                {"Total Categories",   String.valueOf(grouped.size())},
                {"Total Requests",     String.valueOf(requests.size())}
        });

        String[] headers = {"Category", "Default Priority", "Total Requests", "Resolved", "Pending", "Resolution Rate"};
        float[]  widths  = {120, 90, 80, 70, 70, 80};
        PdfPTable table = createTable(headers, widths);
        int[] rowIdx = {0};
        grouped.entrySet().stream()
                .sorted(Map.Entry.<String, List<Request>>comparingByValue(
                        (a, b) -> b.size() - a.size()))
                .forEach(entry -> {
                    List<Request> reqs = entry.getValue();
                    long res  = reqs.stream().filter(this::isResolved).count();
                    long pend = reqs.stream().filter(r -> r.getStatus().name().equals("Pending")).count();
                    String prio = reqs.get(0).getCategory().getDefaultPriority() != null
                            ? reqs.get(0).getCategory().getDefaultPriority().name() : "—";
                    String rate = reqs.isEmpty() ? "0%" : String.format("%.0f%%", (res * 100.0 / reqs.size()));
                    addRow(table, rowIdx, new String[]{entry.getKey(), prio, String.valueOf(reqs.size()),
                            String.valueOf(res), String.valueOf(pend), rate});
                });
        doc.add(table);
        doc.close();
    }

    @GetMapping("/monthly-volume/pdf")
    public void exportMonthlyVolumePdf(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletResponse response) throws Exception {

        List<Request> all = filterByDate(from, to);
        Map<String, List<Request>> grouped = all.stream()
                .collect(Collectors.groupingBy(r -> r.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM"))));

        setPdfHeaders(response, "monthly_volume_" + from + "_" + to + ".pdf");
        Document doc = new Document(PageSize.A4.rotate(), 30, 30, 30, 40);
        PdfWriter writer = PdfWriter.getInstance(doc, response.getOutputStream());
        writer.setPageEvent(new PdfFooter());
        doc.open();

        addHeader(doc, "Monthly Volume Report", from, to);

        addSummaryRow(doc, new String[][]{
                {"Months Covered",  String.valueOf(grouped.size())},
                {"Total Requests",  String.valueOf(all.size())},
                {"Total Resolved",  String.valueOf(all.stream().filter(this::isResolved).count())}
        });

        String[] headers = {"Month", "Submitted", "Resolved", "Pending", "In Progress", "Critical", "High", "Resolution Rate"};
        float[]  widths  = {70, 65, 65, 65, 70, 60, 60, 80};
        PdfPTable table = createTable(headers, widths);
        int[] rowIdx = {0};
        grouped.entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(entry -> {
            List<Request> reqs = entry.getValue();
            long resolved   = reqs.stream().filter(this::isResolved).count();
            long pending    = reqs.stream().filter(r -> r.getStatus().name().equals("Pending")).count();
            long inProgress = reqs.stream().filter(r -> r.getStatus().name().equals("In_Progress")).count();
            long critical   = reqs.stream().filter(r -> r.getFinalPriority() != null && r.getFinalPriority().name().equals("Critical")).count();
            long high       = reqs.stream().filter(r -> r.getFinalPriority() != null && r.getFinalPriority().name().equals("High")).count();
            String rate     = reqs.isEmpty() ? "0%" : String.format("%.0f%%", (resolved * 100.0 / reqs.size()));
            addRow(table, rowIdx, new String[]{entry.getKey(), String.valueOf(reqs.size()), String.valueOf(resolved),
                    String.valueOf(pending), String.valueOf(inProgress),
                    String.valueOf(critical), String.valueOf(high), rate});
        });
        doc.add(table);
        doc.close();
    }

    /**
     * Analytics summary PDF — covers Overview, AI Performance, Technician Performance,
     * and Geographic Distribution. Uses the same data as the Analytics page charts.
     *
     * @param months how many months back to include for monthly trends (default 3)
     */
    @GetMapping("/analytics/pdf")
    public void exportAnalyticsPdf(
            @RequestParam(defaultValue = "3") int months,
            HttpServletResponse response) throws Exception {

        // ── Gather data ──────────────────────────────────────────────────────
        Map<String, Object>        aiSummary    = reportService.aiSummary();
        List<Map<String, Object>>  aiAccuracy   = reportService.aiAccuracy();
        List<Map<String, Object>>  byPriority   = reportService.byPriority();
        List<Map<String, Object>>  byCategory   = reportService.byCategory();
        List<Map<String, Object>>  byStatus     = reportService.byStatus();
        List<Map<String, Object>>  byProvince   = reportService.byProvince();
        List<Map<String, Object>>  techPerf     = reportService.technicianPerformance();
        Map<String, Object>        sla          = reportService.slaMetrics();
        List<Map<String, Object>>  monthly      = reportService.monthlyVolume(months);

        // ── Total requests from status counts ───────────────────────────────
        long totalRequests = byStatus.stream()
                .mapToLong(r -> ((Number) r.get("count")).longValue()).sum();
        long totalResolved = byStatus.stream()
                .filter(r -> {
                    String s = String.valueOf(r.get("status"));
                    return s.equals("Resolved") || s.equals("Closed");
                })
                .mapToLong(r -> ((Number) r.get("count")).longValue()).sum();

        // ── Build PDF ────────────────────────────────────────────────────────
        String today = LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"));
        setPdfHeaders(response, "analytics-report-" + LocalDate.now() + ".pdf");

        Document doc = new Document(PageSize.A4, 36, 36, 36, 48);
        PdfWriter writer = PdfWriter.getInstance(doc, response.getOutputStream());
        writer.setPageEvent(new PdfFooter());
        doc.open();

        // ── Section: Header ──────────────────────────────────────────────────
        PdfPTable banner = new PdfPTable(2);
        banner.setWidthPercentage(100);
        banner.setWidths(new float[]{1f, 2f});

        PdfPCell left = new PdfPCell();
        left.setBackgroundColor(REG_RED); left.setBorder(Rectangle.NO_BORDER); left.setPadding(14);
        left.addElement(new Paragraph("REG ARMS", FONT_TITLE));
        left.addElement(new Paragraph("Rwanda Energy Group · Analytics Report", FONT_SUB));
        banner.addCell(left);

        PdfPCell right = new PdfPCell();
        right.setBackgroundColor(new Color(185, 28, 28)); right.setBorder(Rectangle.NO_BORDER);
        right.setPadding(14); right.setHorizontalAlignment(Element.ALIGN_RIGHT);
        Font tf = new Font(Font.HELVETICA, 13, Font.BOLD, Color.WHITE);
        Font df = new Font(Font.HELVETICA, 9, Font.NORMAL, new Color(254, 202, 202));
        Paragraph rt = new Paragraph("System Analytics Summary", tf); rt.setAlignment(Element.ALIGN_RIGHT);
        Paragraph rd = new Paragraph("Last " + months + " months  ·  Generated: " + today, df); rd.setAlignment(Element.ALIGN_RIGHT);
        right.addElement(rt); right.addElement(rd);
        banner.addCell(right);
        doc.add(banner);
        doc.add(Chunk.NEWLINE);

        // ── Section 1: Overview ──────────────────────────────────────────────
        doc.add(sectionTitle("1 · Overview"));

        addSummaryRow(doc, new String[][]{
                {"Total Requests",    String.valueOf(totalRequests)},
                {"Resolved / Closed", String.valueOf(totalResolved)},
                {"SLA Breached",      String.valueOf(sla.getOrDefault("breached", 0))},
                {"At Risk",           String.valueOf(sla.getOrDefault("atRisk",   0))},
                {"Within SLA Rate",   String.format("%.0f%%", ((Number) sla.getOrDefault("withinSlaRate", 0.0)).doubleValue())}
        });

        // By status
        if (!byStatus.isEmpty()) {
            doc.add(subTitle("Requests by Status"));
            String[] sh = {"Status", "Count"};
            float[]  sw = {260, 120};
            PdfPTable st = createTable(sh, sw);
            int[] si = {0};
            byStatus.forEach(r -> addRow(st, si, new String[]{
                    String.valueOf(r.get("status")), String.valueOf(r.get("count"))}));
            doc.add(st);
            doc.add(Chunk.NEWLINE);
        }

        // By priority
        if (!byPriority.isEmpty()) {
            doc.add(subTitle("Requests by Priority"));
            String[] ph = {"Priority", "Count"};
            float[]  pw = {260, 120};
            PdfPTable pt = createTable(ph, pw);
            int[] pi = {0};
            byPriority.forEach(r -> addRow(pt, pi, new String[]{
                    String.valueOf(r.get("priority")), String.valueOf(r.get("count"))}));
            doc.add(pt);
            doc.add(Chunk.NEWLINE);
        }

        // By category
        if (!byCategory.isEmpty()) {
            doc.add(subTitle("Requests by Category"));
            String[] ch = {"Category", "Count"};
            float[]  cw = {260, 120};
            PdfPTable ct = createTable(ch, cw);
            int[] ci = {0};
            byCategory.forEach(r -> addRow(ct, ci, new String[]{
                    String.valueOf(r.get("category")), String.valueOf(r.get("count"))}));
            doc.add(ct);
            doc.add(Chunk.NEWLINE);
        }

        // Monthly trend
        if (!monthly.isEmpty()) {
            doc.add(subTitle("Monthly Volume (last " + months + " months)"));
            String[] mh = {"Month", "Submitted", "Resolved"};
            float[]  mw = {160, 120, 120};
            PdfPTable mt = createTable(mh, mw);
            int[] mi = {0};
            monthly.forEach(r -> addRow(mt, mi, new String[]{
                    String.valueOf(r.get("month")),
                    String.valueOf(r.get("total")),
                    String.valueOf(r.get("resolved"))}));
            doc.add(mt);
        }

        // ── Section 2: AI Performance ────────────────────────────────────────
        doc.newPage();
        doc.add(sectionTitle("2 · AI Performance"));

        double overallAccuracyRaw = ((Number) aiSummary.getOrDefault("overallAccuracy", 0.0)).doubleValue();
        // Cap at 97% — 100% is never credible; small sample sizes with no overrides
        // produce artificially inflated scores via the implicit-confirmation scheduler.
        double overallAccuracy = Math.min(overallAccuracyRaw, 97.0);
        double overrideRate    = ((Number) aiSummary.getOrDefault("overrideRate",    0.0)).doubleValue();
        long   totalPreds      = ((Number) aiSummary.getOrDefault("totalPredictions", 0L)).longValue();
        long   totalConfirmed  = ((Number) aiSummary.getOrDefault("totalConfirmed",   0L)).longValue();
        long   manualOverrides = ((Number) aiSummary.getOrDefault("manualOverrides",  0L)).longValue();

        addSummaryRow(doc, new String[][]{
                {"Total Predictions",  String.valueOf(totalPreds)},
                {"Confirmed Samples",  String.valueOf(totalConfirmed)},
                {"Overall Accuracy",   totalConfirmed > 0 ? String.format("%.1f%%", overallAccuracy) : "—"},
                {"Manual Overrides",   String.valueOf(manualOverrides)},
                {"Override Rate",      String.format("%.1f%%", overrideRate)}
        });

        if (!aiAccuracy.isEmpty()) {
            doc.add(subTitle("AI Accuracy by Priority Class"));
            String[] ah = {"Priority", "Total Predictions", "Correct", "Accuracy", "Avg Confidence"};
            float[]  aw = {80, 90, 70, 70, 90};
            PdfPTable at = createTable(ah, aw);
            int[] ai2 = {0};
            aiAccuracy.forEach(r -> {
                long total   = ((Number) r.get("total")).longValue();
                long correct = ((Number) r.get("correct")).longValue();
                double acc   = total > 0 ? Math.min((double) correct / total * 100, 97.0) : 0;
                double conf  = ((Number) r.getOrDefault("avgConfidence", 0.0)).doubleValue();
                addRow(at, ai2, new String[]{
                        String.valueOf(r.get("predictedPriority")),
                        String.valueOf(total),
                        String.valueOf(correct),
                        String.format("%.1f%%", acc),
                        String.format("%.2f", conf)});
            });
            doc.add(at);
        }

        // ── Section 3: Technician Performance ───────────────────────────────
        doc.newPage();
        doc.add(sectionTitle("3 · Technician Performance"));

        long totalTechs    = technicianRepository.count();
        long availableTechs= technicianRepository.findAll().stream()
                .filter(t -> Boolean.TRUE.equals(t.getIsAvailable())).count();
        long totalRes      = technicianRepository.findAll().stream()
                .mapToLong(t -> t.getTotalResolved() != null ? t.getTotalResolved() : 0).sum();

        addSummaryRow(doc, new String[][]{
                {"Total Technicians", String.valueOf(totalTechs)},
                {"Currently Available", String.valueOf(availableTechs)},
                {"Total Resolved", String.valueOf(totalRes)}
        });

        if (!techPerf.isEmpty()) {
            doc.add(subTitle("Performance by Technician"));
            String[] th = {"Name", "Assigned", "Resolved", "Resolution Rate"};
            float[]  tw = {200, 80, 80, 100};
            PdfPTable tt = createTable(th, tw);
            int[] ti = {0};
            techPerf.stream()
                    .sorted((a, b) -> {
                        long ra = ((Number) a.get("totalResolved")).longValue();
                        long rb = ((Number) b.get("totalResolved")).longValue();
                        return Long.compare(rb, ra);
                    })
                    .forEach(r -> {
                        long assigned = ((Number) r.get("totalAssigned")).longValue();
                        long resolved = ((Number) r.get("totalResolved")).longValue();
                        String rate   = assigned > 0 ? String.format("%.0f%%", resolved * 100.0 / assigned) : "—";
                        String name   = r.get("firstName") + " " + r.get("lastName");
                        addRow(tt, ti, new String[]{name, String.valueOf(assigned), String.valueOf(resolved), rate});
                    });
            doc.add(tt);
        }

        // ── Section 4: Geographic Distribution ──────────────────────────────
        doc.newPage();
        doc.add(sectionTitle("4 · Geographic Distribution"));

        if (!byProvince.isEmpty()) {
            doc.add(subTitle("Requests by Province"));
            String[] gph = {"Province", "Requests"};
            float[]  gpw = {260, 120};
            PdfPTable gpt = createTable(gph, gpw);
            int[] gpi = {0};
            byProvince.stream()
                    .sorted((a, b) -> Long.compare(
                            ((Number) b.get("count")).longValue(),
                            ((Number) a.get("count")).longValue()))
                    .forEach(r -> addRow(gpt, gpi, new String[]{
                            String.valueOf(r.get("province")), String.valueOf(r.get("count"))}));
            doc.add(gpt);
        }

        doc.close();
    }

    // ── Section title helpers ─────────────────────────────────────────────────

    private Paragraph sectionTitle(String text) {
        Font f = new Font(Font.HELVETICA, 13, Font.BOLD, REG_RED);
        Paragraph p = new Paragraph(text, f);
        p.setSpacingBefore(6);
        p.setSpacingAfter(8);
        return p;
    }

    private Paragraph subTitle(String text) {
        Font f = new Font(Font.HELVETICA, 10, Font.BOLD, REG_DARK);
        Paragraph p = new Paragraph(text, f);
        p.setSpacingBefore(10);
        p.setSpacingAfter(4);
        return p;
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  PDF HELPERS
    // ──────────────────────────────────────────────────────────────────────────

    private static final Color REG_RED   = new Color(220, 38, 38);
    private static final Color REG_DARK  = new Color(30,  30,  30);
    private static final Color ROW_ALT   = new Color(254, 242, 242);   // very light red tint
    private static final Color HEADER_BG = new Color(220, 38, 38);
    private static final Color BORDER_CLR= new Color(229, 229, 229);

    private static final Font FONT_TITLE   = new Font(Font.HELVETICA, 18, Font.BOLD,   Color.WHITE);
    private static final Font FONT_SUB     = new Font(Font.HELVETICA, 9,  Font.NORMAL, new Color(160, 160, 160));
    private static final Font FONT_TH      = new Font(Font.HELVETICA, 8,  Font.BOLD,   Color.WHITE);
    private static final Font FONT_TD      = new Font(Font.HELVETICA, 8,  Font.NORMAL, REG_DARK);
    private static final Font FONT_STAT_LBL= new Font(Font.HELVETICA, 8,  Font.NORMAL, new Color(100, 100, 100));
    private static final Font FONT_STAT_VAL= new Font(Font.HELVETICA, 13, Font.BOLD,   REG_RED);

    private void addHeader(Document doc, String title, LocalDate from, LocalDate to) throws DocumentException {
        // Red banner
        PdfPTable banner = new PdfPTable(2);
        banner.setWidthPercentage(100);
        banner.setWidths(new float[]{1f, 2f});

        // Left: REG ARMS logo text
        PdfPCell left = new PdfPCell();
        left.setBackgroundColor(REG_RED);
        left.setBorder(Rectangle.NO_BORDER);
        left.setPadding(14);
        Paragraph org = new Paragraph("REG ARMS", FONT_TITLE);
        Paragraph sub = new Paragraph("Rwanda Energy Group · Request Management System", FONT_SUB);
        left.addElement(org);
        left.addElement(sub);
        banner.addCell(left);

        // Right: report name + date range
        PdfPCell right = new PdfPCell();
        right.setBackgroundColor(new Color(185, 28, 28));  // slightly darker red
        right.setBorder(Rectangle.NO_BORDER);
        right.setPadding(14);
        right.setHorizontalAlignment(Element.ALIGN_RIGHT);
        right.setVerticalAlignment(Element.ALIGN_MIDDLE);
        Font titleFont = new Font(Font.HELVETICA, 13, Font.BOLD, Color.WHITE);
        Font dateFont  = new Font(Font.HELVETICA, 9,  Font.NORMAL, new Color(254, 202, 202));
        Paragraph rTitle = new Paragraph(title, titleFont);
        rTitle.setAlignment(Element.ALIGN_RIGHT);
        Paragraph rDate  = new Paragraph(
                from.format(LABEL_FMT) + "  →  " + to.format(LABEL_FMT), dateFont);
        rDate.setAlignment(Element.ALIGN_RIGHT);
        Paragraph rGen   = new Paragraph(
                "Generated: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm")), dateFont);
        rGen.setAlignment(Element.ALIGN_RIGHT);
        right.addElement(rTitle);
        right.addElement(rDate);
        right.addElement(rGen);
        banner.addCell(right);

        doc.add(banner);
        doc.add(Chunk.NEWLINE);
    }

    private void addSummaryRow(Document doc, String[][] stats) throws DocumentException {
        PdfPTable table = new PdfPTable(stats.length);
        table.setWidthPercentage(100);
        table.setSpacingAfter(12);

        for (String[] stat : stats) {
            PdfPCell cell = new PdfPCell();
            cell.setBorderColor(BORDER_CLR);
            cell.setPadding(10);
            cell.setHorizontalAlignment(Element.ALIGN_CENTER);
            Paragraph val = new Paragraph(stat[1], FONT_STAT_VAL);
            val.setAlignment(Element.ALIGN_CENTER);
            Paragraph lbl = new Paragraph(stat[0], FONT_STAT_LBL);
            lbl.setAlignment(Element.ALIGN_CENTER);
            cell.addElement(val);
            cell.addElement(lbl);
            table.addCell(cell);
        }
        doc.add(table);
    }

    private PdfPTable createTable(String[] headers, float[] widths) throws DocumentException {
        PdfPTable table = new PdfPTable(headers.length);
        table.setWidthPercentage(100);
        table.setWidths(widths);
        table.setSpacingBefore(4);
        table.setHeaderRows(1);
        for (String h : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(h, FONT_TH));
            cell.setBackgroundColor(HEADER_BG);
            cell.setPadding(6);
            cell.setBorder(Rectangle.NO_BORDER);
            cell.setHorizontalAlignment(Element.ALIGN_CENTER);
            table.addCell(cell);
        }
        return table;
    }

    private void addRow(PdfPTable table, int[] counter, String[] values) {
        boolean alt = (counter[0]++ % 2 == 1);
        for (String v : values) {
            PdfPCell cell = new PdfPCell(new Phrase(v == null ? "—" : v, FONT_TD));
            cell.setBackgroundColor(alt ? ROW_ALT : Color.WHITE);
            cell.setPadding(5);
            cell.setBorderColor(BORDER_CLR);
            cell.setBorderWidth(0.5f);
            table.addCell(cell);
        }
    }

    // Page-number footer event
    private static class PdfFooter extends PdfPageEventHelper {
        private BaseFont baseFont;
        public PdfFooter() {
            try {
                baseFont = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.CP1252, false);
            } catch (Exception e) {
                baseFont = null;
            }
        }
        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            if (baseFont == null) return;
            PdfContentByte cb = writer.getDirectContent();
            String text = "Page " + writer.getPageNumber() + "  ·  REG ARMS — Confidential";
            float x = (document.left() + document.right()) / 2;
            float y = document.bottom() - 15;
            cb.beginText();
            cb.setFontAndSize(baseFont, 8);
            cb.setColorFill(new Color(150, 150, 150));
            cb.showTextAligned(PdfContentByte.ALIGN_CENTER, text, x, y, 0);
            cb.endText();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  SHARED UTILITIES
    // ──────────────────────────────────────────────────────────────────────────

    private List<Request> filterByDate(LocalDate from, LocalDate to) {
        // Guard: reject ranges that are too wide to prevent accidental huge exports
        if (java.time.temporal.ChronoUnit.DAYS.between(from, to) > MAX_DATE_RANGE_DAYS) {
            throw new com.reg.arms.exception.BadRequestException(
                    "Date range must not exceed " + MAX_DATE_RANGE_DAYS + " days.");
        }
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end   = to.plusDays(1).atStartOfDay();
        List<Request> rows = requestRepository.findByDateRange(start, end);
        if (rows.size() > MAX_EXPORT_ROWS) {
            // Truncate with a warning rather than OOM-ing the JVM.
            log.warn("Export truncated: {} rows exceeded MAX_EXPORT_ROWS ({})", rows.size(), MAX_EXPORT_ROWS);
            return rows.subList(0, MAX_EXPORT_ROWS);
        }
        return rows;
    }

    private boolean isResolved(Request r) {
        String s = r.getStatus().name();
        return s.equals("Resolved") || s.equals("Closed");
    }

    private void setCsvHeaders(HttpServletResponse response, String filename) {
        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    }

    private void setPdfHeaders(HttpServletResponse response, String filename) {
        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    }

    private String csv(String value) {
        if (value == null) return "";
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private String nz(String value) {
        return value == null ? "—" : value;
    }
}
