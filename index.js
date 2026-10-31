const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer Memory Storage setup
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const database = client.db("shacroy");
    const homeCollection = database.collection("home"); // Hero slider images collection
    const customerCollection = database.collection("customers"); // Customer collection

    console.log("Successfully connected to MongoDB!");

    // Customer Registration Route
    app.post("/api/auth/register", async (req, res) => {
      try {
        const customerData = req.body;

        // Check if user already exists
        const existingUser = await customerCollection.findOne({
          email: customerData.email,
        });
        if (existingUser) {
          return res
            .status(400)
            .send({ message: "এই ইমেল দিয়ে ইতিমধ্যে অ্যাকাউন্ট খোলা হয়েছে।" });
        }

        customerData.createdAt = new Date();
        const result = await customerCollection.insertOne(customerData);
        res.status(201).send({ message: "Registration successful", result });
      } catch (error) {
        console.error("Register error:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Customer Login Route (Basic mock check)
    app.post("/api/auth/login", async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await customerCollection.findOne({ email });

        if (!user || user.password !== password) {
          return res.status(401).send({ message: "ভুল ইমেল অথবা পাসওয়ার্ড!" });
        }

        res.status(200).send({
          message: "Login successful",
          token: "mock-jwt-token-shacroy",
          user: { name: user.name, email: user.email },
        });
      } catch (error) {
        console.error("Login error:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Customer Extra Info Save Route
    app.post("/api/customer/save-extra-info", async (req, res) => {
      try {
        const { email, phone, addresses, diffReceiverName, diffReceiverPhone } =
          req.body;

        // customerCollection-এ ইউজারের ইমেল দিয়ে খুঁেজ বাকি ইনফো আপডেট করা
        const result = await customerCollection.updateOne(
          { email: email },
          {
            $set: {
              phone,
              addresses,
              diffReceiverName,
              diffReceiverPhone,
              updatedAt: new Date(),
            },
          },
          { upsert: true },
        );

        res
          .status(200)
          .send({ message: "Extra info saved successfully", result });
      } catch (error) {
        console.error("Save extra info error:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Get Customer Profile & Extra Info Route
    app.get("/api/customer/profile", async (req, res) => {
      try {
        const { email } = req.query;
        const customer = await customerCollection.findOne({ email });
        if (!customer) {
          return res
            .status(404)
            .send({ message: "Customer profile not found" });
        }
        res.status(200).send(customer);
      } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Customer Profile & Avatar Update Route
    app.post(
      "/api/customer/update-profile",
      upload.single("profileImage"),
      async (req, res) => {
        try {
          const {
            email,
            name,
            phone,
            addresses,
            diffReceiverName,
            diffReceiverPhone,
            isDiffReceiver,
          } = req.body;

          let imageUrl = req.body.profileImage;

          // Jodi new image file upload hoy, tahole Cloudinary-te upload hobe
          if (req.file) {
            const uploadResult = await new Promise((resolve, reject) => {
              const stream = cloudinary.uploader.upload_stream(
                { folder: "shacroy/profiles" },
                (error, result) => {
                  if (error) reject(error);
                  else resolve(result);
                },
              );
              stream.end(req.file.buffer);
            });
            imageUrl = uploadResult.secure_url;
          }

          // MongoDB customerCollection update kora
          const result = await customerCollection.updateOne(
            { email: email },
            {
              $set: {
                name,
                phone,
                profileImage: imageUrl,
                addresses: addresses ? JSON.parse(addresses) : undefined,
                diffReceiverName,
                diffReceiverPhone,
                isDiffReceiver:
                  isDiffReceiver === "true" || isDiffReceiver === true,
                updatedAt: new Date(),
              },
            },
            { upsert: true },
          );

          res
            .status(200)
            .send({
              message: "Profile updated successfully",
              imageUrl,
              result,
            });
        } catch (error) {
          console.error("Update profile error:", error);
          res.status(500).send({ message: "Internal server error" });
        }
      },
    );

    // 1. Get all Hero Banner / Slider images
    app.get("/api/home-sliders", async (req, res) => {
      try {
        const sliders = await homeCollection.find({}).toArray();
        res.status(200).send(sliders);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch sliders", error });
      }
    });

    // 2. Upload new slider image (Admin Manage)
    app.post("/api/home-sliders", upload.single("image"), async (req, res) => {
      try {
        const { title } = req.body;
        if (!req.file) {
          return res.status(400).send({ message: "No image file provided" });
        }

        // Upload to Cloudinary using buffer stream
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "shacroy/hero-sliders" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            },
          );
          stream.end(req.file.buffer);
        });

        const newSlider = {
          title: title || "Shacroy Offer",
          imageUrl: uploadResult.secure_url,
          publicId: uploadResult.public_id, // Useful for deletion later
          createdAt: new Date(),
        };

        const result = await homeCollection.insertOne(newSlider);
        res
          .status(201)
          .send({ message: "Slider added successfully", result, newSlider });
      } catch (error) {
        console.error("Upload error:", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });

    // 3. Delete slider image and remove from Cloudinary
    app.delete("/api/home-sliders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const slider = await homeCollection.findOne(query);

        if (!slider) {
          return res.status(404).send({ message: "Slider not found" });
        }

        // Delete from Cloudinary if publicId exists
        if (slider.publicId) {
          await cloudinary.uploader.destroy(slider.publicId);
        }

        const result = await homeCollection.deleteOne(query);
        res
          .status(200)
          .send({ message: "Slider deleted successfully", result });
      } catch (error) {
        console.error("Delete error:", error);
        res.status(500).send({ message: "Failed to delete slider", error });
      }
    });
  } catch (error) {
    console.error("Database connection error:", error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Shacroy Server is running with Cloudinary!");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
