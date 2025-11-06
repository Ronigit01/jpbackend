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

let otpStore = {}; // Temporary store for OTP verification

app.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone)
      return res.status(400).json({ error: "Phone number is required" });

    const otp = Math.floor(100000 + Math.random() * 900000);
    console.log(`✅ Mock OTP sent to ${phone}: ${otp}`);
    res.json({ success: true, otp, message: "OTP mock sent successfully" });
  } catch (error) {
    console.error("❌ Error sending OTP:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 2. Verify OTP
app.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;
  if (otpStore[phone] === otp) {
    delete otpStore[phone];
    res.json({ success: true, message: "OTP verified successfully" });
  } else {
    res.status(400).json({ success: false, message: "Invalid OTP" });
  }
});

// ✅ 3. Submit form (send email)
app.post("/submit-form", async (req, res) => {
  const { name, email, phone, service, message } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: email,
      to: process.env.EMAIL_USER,
      subject: "New Contact Form Submission",
      html: `
        <h3>Contact Form Details</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Message:</strong> ${message}</p>
      `,
    });

    res.json({ success: true, message: "Form submitted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error sending email", error });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
