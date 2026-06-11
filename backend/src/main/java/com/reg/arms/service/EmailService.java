package com.reg.arms.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${spring.mail.from-name}")
    private String fromName;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Async
    public void sendWelcomeEmail(String to, String name) {
        String subject = "Welcome to REG ARMS, " + name + "!";
        String body = buildEmailTemplate(name,
                "Your account has been created successfully. You can now log in to the REG ARMS portal to submit and track energy service requests.",
                "Login to Your Account",
                frontendUrl + "/login");
        send(to, subject, body);
    }

    @Async
    public void sendWelcomeEmailWithCredentials(String to, String name, String password) {
        String subject = "Welcome to REG ARMS — Your Login Credentials";
        String message = String.format(
                "Your account has been created by an administrator. Use the credentials below to log in:<br><br>" +
                "<div style='background:#eaf4fb;border-left:4px solid #1a5276;padding:12px 18px;margin:10px 0;border-radius:4px'>" +
                "<p style='margin:4px 0'><strong>Email:</strong> %s</p>" +
                "<p style='margin:4px 0'><strong>Password:</strong> %s</p>" +
                "</div><br>" +
                "For security, please change your password immediately after your first login.",
                to, password);
        String body = buildEmailTemplate(name, message, "Login to ARMS", frontendUrl + "/login");
        send(to, subject, body);
    }

    /** Sent to the customer right after self-registration */
    @Async
    public void sendRegistrationPendingEmail(String to, String name) {
        String subject = "REG ARMS — Account Registration Received";
        String body = buildEmailTemplate(name,
                "Thank you for registering with REG ARMS. Your account has been created and is currently <strong>pending admin approval</strong>.<br><br>" +
                "You will receive another email as soon as your account is activated. This usually takes 1–2 business days.",
                "Learn About REG ARMS",
                frontendUrl + "/login");
        send(to, subject, body);
    }

    /** Sent to all active admins when a new customer self-registers */
    @Async
    public void sendNewRegistrationNotificationToAdmin(String adminEmail, String adminName, String customerName, String customerEmail) {
        String subject = "REG ARMS — New Customer Registration Pending Approval";
        String message = String.format(
                "A new customer has registered and is awaiting your approval:<br><br>" +
                "<div style='background:#fef9eb;border-left:4px solid #d4ac0d;padding:12px 18px;margin:10px 0;border-radius:4px'>" +
                "<p style='margin:4px 0'><strong>Name:</strong> %s</p>" +
                "<p style='margin:4px 0'><strong>Email:</strong> %s</p>" +
                "</div><br>" +
                "Please log in to the admin panel to review and approve or reject this account.",
                customerName, customerEmail);
        String body = buildEmailTemplate(adminName, message, "Go to Admin Panel", frontendUrl + "/login");
        send(adminEmail, subject, body);
    }

    /** Sent to the customer when an admin approves their account */
    @Async
    public void sendAccountApprovedEmail(String to, String name) {
        String subject = "REG ARMS — Your Account Has Been Approved!";
        String body = buildEmailTemplate(name,
                "Great news! Your REG ARMS account has been reviewed and <strong>approved by our team</strong>.<br><br>" +
                "You can now log in to the portal to submit energy service requests and track them in real time.",
                "Login to Your Account",
                frontendUrl + "/login");
        send(to, subject, body);
    }

    /** Sent to the customer when an admin rejects/deletes their registration */
    @Async
    public void sendAccountRejectedEmail(String to, String name) {
        String subject = "REG ARMS — Account Registration Update";
        String body = buildEmailTemplate(name,
                "After reviewing your registration request, we were unable to approve your REG ARMS account at this time.<br><br>" +
                "If you believe this is a mistake or have any questions, please contact us at <a href='mailto:support@reg.rw'>support@reg.rw</a>.",
                "Contact Support",
                "mailto:support@reg.rw");
        send(to, subject, body);
    }

    @Async
    public void sendPasswordResetEmail(String to, String name, String resetUrl) {
        String subject = "REG ARMS — Password Reset Request";
        String body = buildEmailTemplate(name,
                "We received a request to reset your password. Click the button below to set a new password. This link is valid for 1 hour.",
                "Reset Password",
                resetUrl);
        send(to, subject, body);
    }

    /**
     * Gap 1 — Sent to the customer immediately after their request is submitted.
     * Confirms receipt and sets expectations with the request code and SLA window.
     */
    @Async
    public void sendRequestAcknowledgementEmail(String to, String name, String requestCode,
                                                String category, String priority,
                                                String expectedWindow, String requestUrl) {
        String subject = "REG ARMS — Request Received: " + requestCode;
        String message = String.format(
                "We have received your service request and it is now in our system. Here are the details:<br><br>" +
                "<div style='background:#eaf4fb;border-left:4px solid #1a5276;padding:12px 18px;margin:10px 0;border-radius:4px'>" +
                "<p style='margin:4px 0'><strong>Request Code:</strong> %s</p>" +
                "<p style='margin:4px 0'><strong>Category:</strong> %s</p>" +
                "<p style='margin:4px 0'><strong>Priority:</strong> %s</p>" +
                "<p style='margin:4px 0'><strong>Expected Resolution:</strong> Within %s</p>" +
                "</div><br>" +
                "Our team has been notified and will begin working on your request. " +
                "You can track the status of your request at any time using the button below. " +
                "We will also send you an email whenever there is an update.",
                requestCode, category, priority, expectedWindow);
        String body = buildEmailTemplate(name, message, "Track My Request", requestUrl);
        send(to, subject, body);
    }

    /**
     * Gap 2 — Sent to the customer when a staff member or technician posts
     * a visible (non-internal) comment on their request asking for more information
     * or providing an update.
     */
    @Async
    public void sendCommentNotificationEmail(String to, String customerName, String requestCode,
                                             String commenterName, String commentBody,
                                             String requestUrl) {
        String subject = "REG ARMS — New Update on Your Request " + requestCode;
        String message = String.format(
                "<strong>%s</strong> has posted a message on your request <strong>%s</strong>:<br><br>" +
                "<div style='background:#f4f6f7;border-left:4px solid #5d6d7e;padding:12px 18px;margin:10px 0;border-radius:4px;font-style:italic'>" +
                "\"%s\"" +
                "</div><br>" +
                "Please log in to view the full conversation and reply if any additional information is needed.",
                commenterName, requestCode, commentBody);
        String body = buildEmailTemplate(customerName, message, "View My Request", requestUrl);
        send(to, subject, body);
    }

    private void send(String to, String subject, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail, fromName);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(message);
        } catch (MessagingException | java.io.UnsupportedEncodingException e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    private String buildEmailTemplate(String name, String message, String buttonText, String buttonUrl) {
        return """
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                  <div style="background:#1a5276;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0">
                    <h1 style="margin:0">REG ARMS</h1>
                    <p style="margin:5px 0 0;opacity:0.9">AI-Based Request Management System</p>
                  </div>
                  <div style="background:#f8f9fa;padding:30px;border:1px solid #dee2e6">
                    <p>Hello <strong>%s</strong>,</p>
                    <p>%s</p>
                    <div style="text-align:center;margin:25px 0">
                      <a href="%s" style="background:#1a5276;color:white;padding:12px 30px;text-decoration:none;border-radius:5px;display:inline-block">%s</a>
                    </div>
                    <p style="color:#6c757d;font-size:12px">If you did not request this action, please ignore this email.</p>
                  </div>
                  <div style="text-align:center;padding:15px;color:#6c757d;font-size:12px">
                    &copy; Rwanda Energy Group — ARMS
                  </div>
                </div>
                """.formatted(name, message, buttonUrl, buttonText);
    }
}
