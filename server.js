import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import twilio from "twilio";
import sgMail from "@sendgrid/mail";
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

// 🔹 Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

// ✅ SUBMIT FORM (SendGrid Email) - FIXED VERSION
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
    const msg = {
      to: process.env.EMAIL_USER, // Your receiving email
      from: {
        email: process.env.SENDGRID_VERIFIED_SENDER, // MUST be verified in SendGrid
        name: "JP Group Services Contact Form",
      },
      replyTo: email, // Customer's email for replies
      subject: `📬 New Contact Form Submission from ${name}`,
      text: `
Name: ${name}
Email: ${email}
Phone: ${phone}
Company: ${company || "Not provided"}
Service: ${service}
Message: ${message || "Not provided"}
Submitted: ${new Date().toLocaleString()}
      `,
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
        </div>
      `,
    };

    console.log("📧 Attempting to send email via SendGrid...");
    const [response] = await sgMail.send(msg);

    console.log("✅ SendGrid response status:", response.statusCode);
    console.log("✅ Email sent successfully to:", process.env.EMAIL_USER);

    res.json({
      success: true,
      message: "Form submitted successfully",
    });
  } catch (error) {
    console.error("❌ SendGrid error details:");
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Error response:", error.response?.body);

    // More specific error handling
    if (error.response) {
      const { body } = error.response;
      console.error("SendGrid API Error Body:", body);
    }

    res.status(500).json({
      success: false,
      message: "Failed to send email",
      error: error.message,
    });
  }
});

// ✅ KEEP ALIVE FUNCTION
const keepAlive = async () => {
  try {
    await axios.get("https://jpbackend-8.onrender.com");
    console.log("♻️ Keep-alive ping successful");
  } catch (err) {
    console.error("Keep-alive failed:", err.message);
  }
};

setInterval(keepAlive, 14 * 60 * 1000);

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
