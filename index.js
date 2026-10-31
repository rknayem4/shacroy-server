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

    console.log("Successfully connected to MongoDB!");

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
            }
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
        res.status(201).send({ message: "Slider added successfully", result, newSlider });
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
        res.status(200).send({ message: "Slider deleted successfully", result });
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