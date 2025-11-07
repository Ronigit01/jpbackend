import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import twilio from "twilio";
import nodemailer from "nodemailer";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

let otpStore = {}; // temporary in-memory store

// ✅ SEND OTP
app.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    // Always add +91 automatically
    const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone}`;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP for later verification
    otpStore[formattedPhone] = otp;

    // Send OTP using Twilio
    const message = await client.messages.create({
      body: `Your OTP is ${otp}`,
      from: process.env.TWILIO_PHONE,
      to: formattedPhone,
    });

    console.log(`✅ OTP sent to ${formattedPhone}: ${otp}`);
    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("❌ Twilio error:", error.message);
    res.status(500).json({ error: error.message });
  }
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

// ✅ SUBMIT FORM (send email)
app.post("/submit-form", async (req, res) => {
  console.log("📩 Form data received:", req.body);

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Send email asynchronously but don't block frontend
    await transporter.sendMail({
  from: process.env.EMAIL_USER,     // Use your Gmail account
  to: process.env.EMAIL_USER,       // Send to yourself
  replyTo: req.body.email,          // User's email goes here
  subject: "New Contact Form Submission",
  html: `
    <h3>Contact Form Details</h3>
    <p><strong>Name:</strong> ${req.body.name}</p>
    <p><strong>Email:</strong> ${req.body.email}</p>
    <p><strong>Phone:</strong> ${req.body.phone}</p>
    <p><strong>Service:</strong> ${req.body.service}</p>
    <p><strong>Message:</strong> ${req.body.message}</p>
  `,
}).then(() => console.log("✅ Email sent successfully"))
      .catch((err) => console.error("❌ Email send error:", err));

    // Respond immediately to frontend
    res.json({ success: true, message: "Form submitted successfully" });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    res.status(500).json({ success: false, message: "Unexpected error" });
  }
});




const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
