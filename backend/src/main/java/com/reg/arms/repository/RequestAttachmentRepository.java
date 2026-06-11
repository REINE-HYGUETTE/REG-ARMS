package com.reg.arms.repository;

import com.reg.arms.entity.RequestAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RequestAttachmentRepository extends JpaRepository<RequestAttachment, Long> {

    List<RequestAttachment> findByRequestId(Long requestId);

    /**
     * Finds an attachment by its stored file path and eagerly fetches the parent
     * request's customer and assigned technician in a single query.
     * Used by FileController to enforce role-based access control.
     */
    @Query("""
           SELECT a FROM RequestAttachment a
           JOIN FETCH a.request r
           JOIN FETCH r.customer
           LEFT JOIN FETCH r.assignedTechnician
           WHERE a.filePath = :filePath
           """)
    Optional<RequestAttachment> findByFilePathFetched(@Param("filePath") String filePath);
}
