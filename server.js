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

// ✅ SEND OTP via WhatsApp or SMS
app.post("/send-otp", async (req, res) => {
  try {
    const { phone, method } = req.body; // method = "whatsapp" or "sms"
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[formattedPhone] = otp;

    let fromNumber, toNumber;
    if (method === "whatsapp") {
      fromNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
      toNumber = `whatsapp:${formattedPhone}`;
    } else {
      fromNumber = process.env.TWILIO_SMS_NUMBER;
      toNumber = formattedPhone;
    }

    await client.messages.create({
      body: `Your OTP is: ${otp}`,
      from: fromNumber,
      to: toNumber,
    });

    console.log(`✅ OTP sent to ${formattedPhone} via ${method}: ${otp}`);
    res.json({ success: true, message: `OTP sent via ${method} successfully` });
  } catch (error) {
    console.error("❌ Twilio error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ VERIFY OTP
app.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;
  const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;

  console.log("📩 Verify request:", { phone, formattedPhone, otp });
  console.log("🧠 Stored OTPs:", otpStore);

  if (otpStore[formattedPhone] && otpStore[formattedPhone] === otp) {
    delete otpStore[formattedPhone];
    return res.json({ success: true, message: "OTP verified successfully" });
  } else {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }
});

// ✅ SUBMIT FORM (SendGrid Email)
app.post("/submit-form", async (req, res) => {
  console.log("📩 Form data received:", req.body);

  const msg = {
    to: process.env.EMAIL_USER,
    from: {
      email: process.env.EMAIL_USER,
      name: "JP Services Contact Form",
    },
    replyTo: req.body.email,
    subject: `📬 New Contact Form Submission from ${req.body.name}`,
    text: `
Name: ${req.body.name}
Email: ${req.body.email}
Phone: ${req.body.phone}
Service: ${req.body.service}
Message: ${req.body.message}
    `,
    html: `
      <h3>Contact Form Details</h3>
      <p><strong>Name:</strong> ${req.body.name}</p>
      <p><strong>Email:</strong> ${req.body.email}</p>
      <p><strong>Phone:</strong> ${req.body.phone}</p>
      <p><strong>Service:</strong> ${req.body.service}</p>
      <p><strong>Message:</strong> ${req.body.message}</p>
    `,
  };

  try {
    const [response] = await sgMail.send(msg);
    console.log("✅ SendGrid response status:", response.statusCode);
    res.json({ success: true, message: "Form submitted successfully" });
  } catch (error) {
    console.error("❌ SendGrid error:", error.response?.body || error.message);
    res.status(500).json({ success: false, message: "Failed to send email" });
  }
});

// ✅ KEEP ALIVE FUNCTION
const keepAlive = async () => {
  try {
    await axios.get(
      "https://keepalive404.netlify.app/.netlify/functions/keepalive"
    );
    await axios.get("https://jpbackend-8.onrender.com");
    console.log("♻️ Keep-alive ping successful");
  } catch (err) {
    console.error("Keep-alive failed:", err.message);
  }
};

// Runs every 14 minutes
setInterval(keepAlive, 14 * 60 * 1000);

// ✅ Basic route
app.get("/", (req, res) => {
  res.send("✅ Backend is live and working!");
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
