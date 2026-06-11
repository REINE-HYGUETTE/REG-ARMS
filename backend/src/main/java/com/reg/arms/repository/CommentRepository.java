package com.reg.arms.repository;

import com.reg.arms.entity.Comment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    List<Comment> findByRequestIdOrderByCreatedAtAsc(Long requestId);
}
