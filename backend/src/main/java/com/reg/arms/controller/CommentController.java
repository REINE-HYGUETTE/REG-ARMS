package com.reg.arms.controller;

import com.reg.arms.dto.request.CreateCommentRequest;
import com.reg.arms.dto.request.EditCommentRequest;
import com.reg.arms.dto.response.ApiResponse;
import com.reg.arms.dto.response.CommentResponse;
import com.reg.arms.security.UserPrincipal;
import com.reg.arms.service.CommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/requests/{requestId}/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @GetMapping
    public ResponseEntity<List<CommentResponse>> list(
            @PathVariable Long requestId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(commentService.getComments(requestId, principal));
    }

    @PostMapping
    public ResponseEntity<CommentResponse> create(
            @PathVariable Long requestId,
            @Valid @RequestBody CreateCommentRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(commentService.addComment(requestId, principal, request));
    }

    @PatchMapping("/{commentId}")
    public ResponseEntity<CommentResponse> edit(
            @PathVariable Long requestId,
            @PathVariable Long commentId,
            @Valid @RequestBody EditCommentRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(
                commentService.editComment(requestId, commentId, request.getBody(), principal));
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<ApiResponse> delete(
            @PathVariable Long requestId,
            @PathVariable Long commentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        commentService.deleteComment(requestId, commentId, principal);
        return ResponseEntity.ok(ApiResponse.success("Comment deleted."));
    }
}
