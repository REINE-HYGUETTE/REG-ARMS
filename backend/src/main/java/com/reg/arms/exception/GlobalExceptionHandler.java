package com.reg.arms.exception;

import com.reg.arms.dto.response.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ApiResponse> handleBadRequest(BadRequestException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ApiResponse> handleForbidden(ForbiddenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("Access denied: you do not have permission to perform this action."));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("Invalid email or password"));
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ApiResponse> handleDisabled(DisabledException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("Account is deactivated. Contact administrator."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "Invalid value",
                        (a, b) -> a
                ));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("success", false, "message", "Validation failed", "errors", errors));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse> handleDataIntegrity(DataIntegrityViolationException ex) {
        String cause = ex.getMostSpecificCause().getMessage();
        log.warn("DataIntegrityViolationException: {}", cause);

        // Give a specific message for known unique constraints
        if (cause != null) {
            if (cause.contains("request_code")) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(ApiResponse.error("A duplicate request code was generated. Please try submitting again."));
            }
            if (cause.contains("email") || cause.contains("uk_users_email")) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(ApiResponse.error("An account with this email address already exists."));
            }
            if (cause.contains("employee_id")) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(ApiResponse.error("A technician with this employee ID already exists. Please try again."));
            }
            if (cause.contains("not-null constraint")) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(ApiResponse.error("A required field was missing when saving. Please contact support — details were logged on the server."));
            }
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error("This operation conflicts with existing data. Try deactivating instead of deleting."));
    }

    /**
     * SSE (Server-Sent Events) connections time out periodically — this is normal.
     * Return no body so Spring doesn't try to write JSON to a text/event-stream response.
     */
    @ExceptionHandler(AsyncRequestTimeoutException.class)
    public ResponseEntity<Void> handleAsyncTimeout(AsyncRequestTimeoutException ex) {
        // Intentionally silent — SSE timeout is expected behaviour, not an error
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse> handleGeneral(Exception ex) {
        // Log full stack trace — this is the last-resort catch-all
        log.error("Unhandled exception [{}]: {}", ex.getClass().getSimpleName(), ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("An unexpected error occurred. Please try again or contact support."));
    }
}
