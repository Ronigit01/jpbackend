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


const sendOTP = async (e) => {
  e.preventDefault();

  try {
    // 🧩 Automatically prepend +91 if not already present
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith("+91")) {
      formattedPhone = `+91${formattedPhone}`;
    }

    const response = await fetch("https://jpbackend-4.onrender.com/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: formattedPhone }),
    });

    const data = await response.json();

    if (response.ok) {
      alert("✅ OTP sent successfully!");
    } else {
      console.error("Error sending OTP:", data.error || data.message);
      alert("❌ Failed to send OTP. Please check number format.");
    }
  } catch (error) {
    console.error("Error sending OTP:", error);
    alert("Something went wrong. Try again later.");
  }
};


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
