import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import twilio from "twilio";
import nodemailer from "nodemailer";
import axios from "axios";

dotenv.config();
const app = express();

// ✅ Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);
app.use(bodyParser.json());

// 🔹 Initialize Twilio
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// 🔹 Initialize Gmail Transporter - FIXED: createTransport (not createTransporter)
const gmailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // jpgroupserviceshr@gmail.com
    pass: process.env.EMAIL_PASS, // ypybimng
  },
});

// Test Gmail connection
gmailTransporter.verify((error, success) => {
  if (error) {
    console.log("❌ Gmail connection error:", error);
  } else {
    console.log("✅ Gmail transporter ready");
  }
});

// Temporary store for OTPs
let otpStore = {};

// ✅ SEND OTP via WhatsApp
app.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone}`;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[formattedPhone] = otp;

    await client.messages.create({
      body: `Your WhatsApp OTP is ${otp}`,
      from: "whatsapp:+14155238886",
      to: `whatsapp:${formattedPhone}`,
    });

    console.log(`✅ WhatsApp OTP sent to ${formattedPhone}: ${otp}`);
    res.json({ success: true, message: "OTP sent via WhatsApp successfully" });
  } catch (error) {
    console.error("❌ WhatsApp Twilio error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Backend is live and working!");
});

// ✅ VERIFY OTP
app.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;
  const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone}`;

  console.log("📩 Verify request:", { phone, formattedPhone, otp });
  console.log("🧠 Stored OTPs:", otpStore);

  if (otpStore[formattedPhone] && otpStore[formattedPhone] === otp) {
    delete otpStore[formattedPhone];
    return res.json({ success: true, message: "OTP verified successfully" });
  } else {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }
});

// ✅ SUBMIT FORM (Gmail) - FIXED VERSION
app.post("/submit-form", async (req, res) => {
  console.log("📩 Form data received:", req.body);

  const { name, email, phone, service, message, company } = req.body;

  // Validate required fields
  if (!name || !email || !phone || !service) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
    });
  }

  try {
    const mailOptions = {
      from: {
        name: "JP Group Services Contact Form",
        address: process.env.EMAIL_USER, // jpgroupserviceshr@gmail.com
      },
      to: process.env.EMAIL_USER, // Send to yourself
      replyTo: email, // Customer's email for replies
      subject: `📬 New Contact Form Submission from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">📬 New Contact Form Submission</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb;">
            <p><strong>👤 Name:</strong> ${name}</p>
            <p><strong>📧 Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>📞 Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
            <p><strong>🏢 Company:</strong> ${company || "Not provided"}</p>
            <p><strong>🛠️ Service:</strong> ${service}</p>
            <p><strong>💬 Message:</strong> ${message || "Not provided"}</p>
          </div>
          <div style="margin-top: 20px; padding: 15px; background: #dcfce7; border-radius: 8px;">
            <p style="margin: 0; color: #166534;">
              <strong>📅 Submitted:</strong> ${new Date().toLocaleString(
                "en-IN",
                { timeZone: "Asia/Kolkata" }
              )}
            </p>
          </div>
          <div style="margin-top: 15px; padding: 10px; background: #fef3c7; border-radius: 5px;">
            <p style="margin: 0; color: #92400e; font-size: 12px;">
              <strong>⚠️ Important:</strong> Click "Reply" to respond directly to ${name} at ${email}
            </p>
          </div>
        </div>
      `,
      text: `
New Contact Form Submission:
Name: ${name}
Email: ${email}
Phone: ${phone}
Company: ${company || "Not provided"}
Service: ${service}
Message: ${message || "Not provided"}
Submitted: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}

Reply directly to: ${email}
      `,
    };

    console.log("📧 Attempting to send email via Gmail...");
    const info = await gmailTransporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully! Message ID:", info.messageId);
    console.log("✅ To:", process.env.EMAIL_USER);
    console.log("✅ From customer:", email);

    res.json({
      success: true,
      message: "Form submitted successfully",
    });
  } catch (error) {
    console.error("❌ Gmail error details:");
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);

    // Specific error handling for Gmail
    if (error.code === "EAUTH") {
      console.error(
        "❌ Gmail authentication failed. Check your email password."
      );
    }

    res.status(500).json({
      success: false,
      message: "Failed to send email",
      error: "Please try again or contact us directly",
    });
  }
});

// ✅ KEEP ALIVE FUNCTION
const keepAlive = async () => {
  try {
    await axios.get("https://jpbackend-9.onrender.com"); // Update with your current backend URL
    console.log("♻️ Keep-alive ping successful");
  } catch (err) {
    console.error("Keep-alive failed:", err.message);
  }
};

setInterval(keepAlive, 14 * 60 * 1000);

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
