package com.reg.arms.repository;

import com.reg.arms.entity.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {

    @Query("SELECT a FROM ActivityLog a LEFT JOIN FETCH a.user " +
           "WHERE a.request.id = :requestId ORDER BY a.createdAt ASC")
    List<ActivityLog> findByRequestIdOrderByCreatedAtAsc(@Param("requestId") Long requestId);
}
