require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xlwti.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("BistroBossRestaurantDB").collection("users")
    const menuCollection = client.db("BistroBossRestaurantDB").collection("menu")
    const reviewCollection = client.db("BistroBossRestaurantDB").collection("reviews")
    const cartCollection = client.db("BistroBossRestaurantDB").collection("carts")

    // middleware
    const verifyToken = (req, res, next) => {
      if(!req.headers.authorization){
        return res.status(401).send({message : 'Unauthorized Access'})
      }
      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (error, decoded) => {
        if(error){
          return res.status(401).send({message : 'Unauthorized Access'})
        }
        // console.log(decoded);
        req.decoded = decoded
        next()
      })
      // 
    }

    // Admin verify 
    const adminVerify = async ( req, res, next ) => {
      const email = req.decoded.email
      const query = { email : email }
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === "Admin"
      if(!isAdmin){
        return res.status(403).send({message : 'Access Forbidden'})
      }
      next()
    }

    // jwt related token
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign( user, process.env.SECRET_ACCESS_TOKEN, {expiresIn: '1h'})
      res.send({token})
    })


    // user related apis
    app.get('/users', verifyToken, adminVerify, async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      if(email !== req.decoded.email){
        return res.status(403).send({message : 'Access Forbidden'})
      }
      const query = { email : email}
      const user = await userCollection.findOne(query)
      let admin = false
      if(user){
        admin = user?.role === "Admin"
      }
      res.send({ admin })
    })


    app.post('/users', async (req, res) => {
      const user = req.body

      // check user exist or not
      const query = {email : user.email}
      const existingUser = await userCollection.findOne(query)
      if(existingUser){
        return res.send({message : 'user already exist', insertedId: null })
      }
      
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    app.patch('/users/:id', verifyToken, adminVerify, async (req, res) => {
      const id = req.params
      const filter = { _id : new ObjectId(id)}
      const updatedData = {
        $set: {
          role : "Admin",
        },
      }
      const result = await userCollection.updateOne(filter, updatedData)
      res.send(result)
    })


    app.delete('/users/:id', verifyToken, adminVerify, async (req, res) => {
      const id = req.params
      const query = { _id : new ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })



    // menu apis
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray()
      res.send(result)
    })

    app.post('/menu', verifyToken, adminVerify, async (req, res) => {
      const newMenu = req.body
      const result = await menuCollection.insertOne(newMenu)
      res.send(result)
    })

    app.get('/menu/:id', async (req, res) => {
      const id = req.params
      const query = { _id : new ObjectId(id) }
      const result = await menuCollection.findOne(query)
      res.send(result)
    })

    app.patch('/menu/:id', async (req, res) => {
      const id = req.params
      const item = req.body
      const query = { _id : new ObjectId(id) }
      const updatedDoc = {
        $set:{
          name : item.name,
          price: item.price,
          category: item.category,
          recipe: item.recipe,
          image: item.image
        }
      }
      const result = await menuCollection.updateOne(query, updatedDoc)
      res.send(result)
    })

    app.delete('/menu/:id', verifyToken, adminVerify, async (req, res) => {
      const id = req.params
      const query = { _id : new ObjectId(id) }
      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })



    // cart apis
    app.get('/carts', verifyToken, async (req, res) => {
      const {email} = req.query
      const query = {userEmail : email}
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/carts', verifyToken,  async (req, res) =>{
      const newCart = req.body
      const result = await cartCollection.insertOne(newCart)
      res.send(result)
    })

    app.delete('/carts/:id', verifyToken, async (req, res) => {
      const id = req.params
      const query = {_id : new ObjectId(id)}
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })


    // review apis
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray()
      res.send(result)
    })



    // Payment Intent
    app.post('/create-payment-intent', async ( req, res ) => {
      const {price} = req.body
      const amount = parseInt( price*100)

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      })

      res.send({clientSecret: paymentIntent.client_secret})
    })





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Boss is sitting')
})
  
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})