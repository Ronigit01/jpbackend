import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import twilio from "twilio";
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


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
// ✅ SUBMIT FORM (send email)

app.post("/submit-form", async (req, res) => {
  const msg = {
    to: process.env.EMAIL_USER,
    from: process.env.EMAIL_USER,
    replyTo: req.body.email,
    subject: `New Contact Form Submission from ${req.body.name}`,
    text: `Name: ${req.body.name} Email: ${req.body.email} Phone: ${req.body.phone} Service: ${req.body.service} Message: ${req.body.message}`,
    html: `<h3>Contact Form Details</h3>
           <p><strong>Name:</strong> ${req.body.name}</p>
           <p><strong>Email:</strong> ${req.body.email}</p>
           <p><strong>Phone:</strong> ${req.body.phone}</p>
           <p><strong>Service:</strong> ${req.body.service}</p>
           <p><strong>Message:</strong> ${req.body.message}</p>`,
  };

  try {
    await sgMail.send(msg);
    res.json({ success: true, message: "Form submitted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to send email" });
  }
});




const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
