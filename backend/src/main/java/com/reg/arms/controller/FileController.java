package com.reg.arms.controller;

import com.reg.arms.entity.RequestAttachment;
import com.reg.arms.entity.enums.UserRole;
import com.reg.arms.repository.RequestAttachmentRepository;
import com.reg.arms.security.UserPrincipal;
import com.reg.arms.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;
import java.util.Optional;

/**
 * Serves uploaded request attachment files with role-based access control.
 *
 * <h3>Access rules</h3>
 * <ul>
 *   <li><b>ADMIN</b>  — full access to all attachments.</li>
 *   <li><b>STAFF</b>  — full access to all attachments (they manage their district's requests).</li>
 *   <li><b>TECHNICIAN</b> — access only to attachments on requests assigned to them.</li>
 *   <li><b>CUSTOMER</b>   — access only to attachments on their own requests.</li>
 * </ul>
 *
 * <h3>Authentication</h3>
 * The JWT token must be present either as a standard {@code Authorization: Bearer <token>}
 * header <em>or</em> as a {@code ?token=<token>} query parameter.
 * The query-parameter form is required for browser-native elements ({@code <img src>},
 * {@code <a href download>}) that cannot set custom headers.
 *
 * <h3>Download vs inline</h3>
 * Add {@code ?download=true} to force {@code Content-Disposition: attachment} for images
 * (otherwise images are served inline so they render in the lightbox).
 */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileStorageService            fileStorageService;
    private final RequestAttachmentRepository   attachmentRepository;

    private static final Map<String, MediaType> MEDIA_TYPES = Map.of(
            "jpg",  MediaType.IMAGE_JPEG,
            "jpeg", MediaType.IMAGE_JPEG,
            "png",  MediaType.IMAGE_PNG,
            "gif",  MediaType.IMAGE_GIF,
            "webp", MediaType.parseMediaType("image/webp"),
            "pdf",  MediaType.APPLICATION_PDF
    );

    @GetMapping("/**")
    public ResponseEntity<Resource> serve(
            @RequestParam(name = "download", required = false, defaultValue = "false") boolean forceDownload,
            @AuthenticationPrincipal UserPrincipal principal,
            jakarta.servlet.http.HttpServletRequest request) {

        // ── 1. Require a valid authenticated session ───────────────────────────
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // ── 2. Extract and sanitise the relative file path ────────────────────
        String rawPath = URLDecoder.decode(
                request.getRequestURI().replaceFirst("/api/files/", ""),
                StandardCharsets.UTF_8);

        // Remove leading ?token= fragment if present from the path segment
        if (rawPath.contains("?")) {
            rawPath = rawPath.substring(0, rawPath.indexOf('?'));
        }

        if (rawPath.contains("..") || rawPath.contains("//") || rawPath.startsWith("/")) {
            return ResponseEntity.badRequest().build();
        }

        // ── 3. Access control — look up the attachment record ─────────────────
        Optional<RequestAttachment> attachmentOpt =
                attachmentRepository.findByFilePathFetched(rawPath);

        if (attachmentOpt.isEmpty()) {
            // File path is not registered as a known attachment — deny access.
            // This prevents serving arbitrary files that may have been placed in
            // the upload directory by other means.
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        RequestAttachment attachment = attachmentOpt.get();
        com.reg.arms.entity.Request req = attachment.getRequest();

        boolean allowed = switch (principal.getRole()) {
            case ADMIN, STAFF -> true;

            case TECHNICIAN -> {
                com.reg.arms.entity.User assigned = req.getAssignedTechnician();
                yield assigned != null && assigned.getId().equals(principal.getId());
            }

            case CUSTOMER ->
                req.getCustomer().getId().equals(principal.getId());
        };

        if (!allowed) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        // ── 4. Resolve and serve the file ─────────────────────────────────────
        try {
            Path resolved = fileStorageService.resolve(rawPath);
            Resource resource = new UrlResource(resolved.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            String filename = resolved.getFileName().toString();
            String ext = filename.contains(".")
                    ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase()
                    : "";

            MediaType mediaType = MEDIA_TYPES.getOrDefault(ext, MediaType.APPLICATION_OCTET_STREAM);
            boolean isImage     = "image".equals(mediaType.getType());

            // ?download=true  → always attachment (saves to disk)
            // image default   → inline (renders in browser / lightbox)
            // other files     → always attachment
            String disposition = (forceDownload || !isImage) ? "attachment" : "inline";

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            disposition + "; filename=\"" + filename + "\"")
                    .body(resource);

        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
