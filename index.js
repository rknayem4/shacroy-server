const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

app.use(cors());
app.use(express.json());
const port = process.env.PORT;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("rokomary-distribution");
    const productsCollection = database.collection("products");
    const employeeCollection = database.collection("employees");
    const usersCollection = database.collection("user");
    const activitiesCollection = database.collection("activities");

    const createActivity = async ({
      type,
      title,
      description,
      userId = null,
    }) => {
      try {
        await activitiesCollection.insertOne({
          type,
          title,
          description,
          userId,
          createdAt: new Date(),
        });
      } catch (error) {
        console.error("CREATE ACTIVITY ERROR:", error);
      }
    };

// ----------------------


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
let initializationPromise;

function initialize() {
  if (!initializationPromise) {
    initializationPromise = run().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

if (process.env.NODE_ENV === "production") {
  module.exports = async (req, res) => {
    try {
      await initialize();

      return app(req, res);
    } catch (error) {
      console.error("Server initialization error:", error);

      return res.status(500).json({
        success: false,
        message: "Server initialization failed",
      });
    }
  };
} else {
  initialize()
    .then(() => {
      app.listen(port, () => {
        console.log(`Local server listening on port ${port}`);
      });
    })
    .catch((error) => {
      console.error("Server initialization error:", error);
    });

  module.exports = app;
}