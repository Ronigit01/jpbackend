import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import twilio from "twilio";
import axios from "axios";
import nodemailer from "nodemailer";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔹 Initialize Twilio
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// 🔹 Initialize Nodemailer
const transporter = nodemailer.createTransporter({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Temporary store for OTPs
let otpStore = {};

// ✅ SEND OTP via SMS - FIXED VERSION
app.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;

    console.log("📱 OTP Request received for phone:", phone);

    if (!phone) {
      return res.status(400).json({ error: "Phone number required" });
    }

    // Validate phone number format
    const cleanedPhone = phone.replace(/\D/g, "");

    // For Indian numbers
    if (cleanedPhone.length !== 12 || !cleanedPhone.startsWith("91")) {
      console.log("❌ Invalid phone format:", cleanedPhone);
      return res.status(400).json({
        error:
          "Invalid phone number format. Must be 12 digits starting with 91",
      });
    }

    const formattedPhone = `+${cleanedPhone}`;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with expiration (10 minutes)
    otpStore[formattedPhone] = {
      otp: otp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    };

    console.log(
      `📱 Attempting to send OTP via SMS to: ${formattedPhone}, OTP: ${otp}`
    );
    console.log(`📱 Using Twilio from: ${process.env.TWILIO_PHONE_NUMBER}`);
    console.log(`📱 Sending to: ${formattedPhone}`);

    // ✅ FIXED: Send SMS (not WhatsApp)
    const message = await client.messages.create({
      body: `Your JP Group Services verification code is: ${otp}. This code will expire in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER, // Your SMS-enabled Twilio number
      to: formattedPhone, // Regular phone number (not WhatsApp)
    });

    console.log(`✅ SMS sent successfully!`);
    console.log(`✅ Message SID: ${message.sid}`);
    console.log(`✅ Message status: ${message.status}`);
    console.log(`✅ To: ${formattedPhone}`);

    res.json({
      success: true,
      message: "OTP sent via SMS successfully",
      messageId: message.sid,
    });
  } catch (error) {
    console.error("❌ Twilio SMS error details:");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error("Error more info:", error.moreInfo);
    console.error("Error status:", error.status);

    // Specific error handling for SMS
    if (error.code === 21211) {
      console.error("❌ Invalid phone number format");
      return res.status(400).json({ error: "Invalid phone number format" });
    } else if (error.code === 21408) {
      console.error("❌ Not authorized to send to this number");
      return res
        .status(400)
        .json({ error: "Not authorized to send SMS to this number" });
    } else if (error.code === 21610) {
      console.error("❌ Number cannot receive SMS");
      return res
        .status(400)
        .json({ error: "This number cannot receive SMS messages" });
    } else if (error.code === 21614) {
      console.error("❌ Number is not SMS capable");
      return res
        .status(400)
        .json({ error: "This number is not capable of receiving SMS" });
    } else if (error.code === 21612) {
      console.error("❌ Number is not mobile capable");
      return res.status(400).json({ error: "This number cannot receive SMS" });
    } else {
      console.error("❌ Unknown Twilio error");
      return res
        .status(500)
        .json({ error: "Failed to send OTP: " + error.message });
    }
  }
});

// ✅ VERIFY OTP
app.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;

  // Format phone number consistently
  let formattedPhone = phone;
  if (!phone.startsWith("+")) {
    formattedPhone = phone.startsWith("91") ? `+${phone}` : `+91${phone}`;
  }

  console.log("📩 Verify request:", { phone, formattedPhone, otp });
  console.log("🧠 Stored OTPs:", otpStore);

  const storedOtpData = otpStore[formattedPhone];

  // Check if OTP exists and is not expired
  if (storedOtpData) {
    if (Date.now() > storedOtpData.expiresAt) {
      delete otpStore[formattedPhone];
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired" });
    }

    if (storedOtpData.otp === otp) {
      delete otpStore[formattedPhone];
      return res.json({ success: true, message: "OTP verified successfully" });
    }
  }

  return res.status(400).json({ success: false, message: "Invalid OTP" });
});

// ✅ Clean expired OTPs periodically
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const phone in otpStore) {
    if (otpStore[phone].expiresAt < now) {
      delete otpStore[phone];
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned ${cleanedCount} expired OTPs`);
  }
}, 60 * 1000); // Run every minute

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
    console.log("✅ First keep-alive ping successful");

    // Ping your own server
    await axios.get(`http://localhost:${process.env.PORT || 5000}/keep-alive`);
    console.log("✅ Second keep-alive ping successful");
  } catch (err) {
    console.error("❌ Keep-alive failed:", err.message);
  }
};

// Call immediately on startup and then every 14 minutes
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
      sendOtp: "POST /send-otp",
      verifyOtp: "POST /verify-otp",
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
