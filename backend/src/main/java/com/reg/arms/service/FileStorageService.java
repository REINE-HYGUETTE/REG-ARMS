package com.reg.arms.service;

import com.reg.arms.exception.BadRequestException;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {

    @Value("${app.upload.dir}")
    private String uploadDir;

    @Value("${app.upload.allowed-extensions}")
    private String allowedExtensions;

    @Value("${app.upload.max-size-mb}")
    private int maxSizeMb;

    private Path rootPath;
    private Set<String> allowedExts;

    @PostConstruct
    public void init() {
        rootPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        allowedExts = Set.of(allowedExtensions.split(","));
        try {
            Files.createDirectories(rootPath);
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directory", e);
        }
    }

    public String store(MultipartFile file, String subdirectory) {
        if (file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }

        if (file.getSize() > (long) maxSizeMb * 1024 * 1024) {
            throw new BadRequestException("File exceeds maximum size of " + maxSizeMb + "MB");
        }

        String originalName = file.getOriginalFilename();
        String ext = "";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase();
        }

        if (!allowedExts.contains(ext)) {
            throw new BadRequestException("File type not allowed. Allowed: " + allowedExtensions);
        }

        String storedName = UUID.randomUUID() + "." + ext;
        Path targetDir = rootPath.resolve(subdirectory);

        try {
            Files.createDirectories(targetDir);
            Path targetPath = targetDir.resolve(storedName);
            file.transferTo(targetPath);
            return subdirectory + "/" + storedName;
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file", e);
        }
    }

    /**
     * Resolves a relative path against the upload root, rejecting any attempt
     * to escape the root via path-traversal sequences (e.g. "../").
     */
    public Path resolve(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            throw new BadRequestException("File path must not be empty");
        }
        Path resolved = rootPath.resolve(relativePath).normalize();
        // Security: ensure the resolved path stays inside the upload root
        if (!resolved.startsWith(rootPath)) {
            throw new BadRequestException("Access to path outside upload directory is not allowed");
        }
        return resolved;
    }
}
