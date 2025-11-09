import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import axios from "axios";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔹 Initialize Nodemailer (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// ✅ SUBMIT FORM (Nodemailer to Gmail)
app.post("/submit-form", async (req, res) => {
  console.log("📩 Form data received:", req.body);

  const { name, email, phone, service, message } = req.body;

  // Email content
  const emailSubject = `📬 New Contact Form Submission from ${name}`;
  const emailText = `
Name: ${name}
Email: ${email}
Phone: ${phone}
Service: ${service}
Message: ${message}
  `;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
        🚀 New Contact Form Submission
      </h2>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>👤 Name:</strong> ${name}</p>
        <p><strong>📧 Email:</strong> ${email}</p>
        <p><strong>📱 Phone:</strong> ${phone}</p>
        <p><strong>🛠️ Service:</strong> ${service}</p>
        <p><strong>💬 Message:</strong></p>
        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff;">
          ${message}
        </div>
      </div>
      <p style="color: #666; font-size: 12px; text-align: center;">
        This email was sent from JP Group Services contact form
      </p>
    </div>
  `;

  try {
    const mailOptions = {
      from: {
        name: "JP Services Contact Form",
        address: process.env.GMAIL_USER,
      },
      to: process.env.GMAIL_USER, // Send to your Gmail
      replyTo: email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    };

    // Send email using Nodemailer
    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully!");
    console.log("✅ Message ID:", result.messageId);

    res.json({
      success: true,
      message: "Form submitted successfully",
      emailId: result.messageId,
    });
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email, but form data was received",
    });
  }
});

// ✅ KEEP ALIVE FUNCTION
const keepAlive = async () => {
  try {
    await axios.get(
      "https://keepalive404.netlify.app/.netlify/functions/keepalive"
    );
    console.log("✅ Keep-alive ping successful");
  } catch (err) {
    console.error("❌ Keep-alive failed:", err.message);
  }
};

// Call immediately and every 14 minutes
keepAlive();
setInterval(keepAlive, 14 * 60 * 1000);

// ✅ Simple keep-alive endpoint
app.get("/keep-alive", (req, res) => {
  console.log("🫀 Keep-alive endpoint hit");
  res.json({ status: "alive", timestamp: new Date().toISOString() });
});

// ✅ Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
    endpoints: {
      submitForm: "POST /submit-form",
    },
  });
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/`);
  console.log(`✅ Keep-alive endpoint: http://localhost:${PORT}/keep-alive`);
});
