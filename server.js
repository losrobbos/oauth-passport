require("dotenv").config() // load .env into process.env object
const express = require('express');
const app = express();
const passport = require("passport")
const jwt = require("jsonwebtoken")
const logger = require("morgan")
let GoogleStrategy = require("passport-google-oauth20").Strategy
// let GitHubStrategy = require("passport-github").Strategy

let user = {}

app.use(logger("dev"))

// create config object
const env = {
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL
}

console.log("Our config values: ", env)

// Setting up password strategy

// create an instance of GitHubStrategy
let googleStrategy = new GoogleStrategy(
  {
    clientID: env.clientId,
    clientSecret: env.clientSecret,
    callbackURL: env.callbackURL
  },
  // LOGIN CALLBACK
  // this will get called AFTER successful EXCHANGE of the CODE with an ACCESS TOKEN
  (accessToken, refreshToken, profile, callback) => {
    // profile => contains github profile information
    console.log("[LOGIN / STRATEGY CALLBACK]")
    console.log({ profile })
    callback(null, profile) // tell GitHub we successfully received the user info
    // by this confirmation, it will forward us finally to the CALLBACK url

  // If we use database => store user in DB and confirm afterwards...
  // User.findOrCreate({ githubId: profile.id }, function (err, user) {
  //   return cb(err, user);
  // });
  }
)

// register login provider at passport
passport.use(googleStrategy);


// route which will redirect us for authenticing (loggin us in)
app.get(
  "/auth/google",
  passport.authenticate("google", {
    session: false,
    scope: ["profile"],
    // scope: process.env.SCOPES?.split(",") // request scopes / privileges you want to have access to
  })
)

// CALLBACK route which will wait for the login response...
  // handles both: successful logins or login cancelation
app.get('/auth/google/cb', 
  (req, res, next) => {
    console.log("[CALLBACK / REDIRECT FROM LOGIN PROVIDER]")
    next()
  },
  passport.authenticate('google', { 
    session: false,
    // if user declined => do not create any JWT or anything else => just redirect
    failureRedirect: '/' // or /login
    //failureRedirect: 'http://localhost:3000/login' //absolute URL to frontend works too!!
  }),

  // this callback handles SUCCESSFUL login
  // here we can create our JWT token and redirect MANUALLY
  (req, res) => {
    console.log("[FINAL CALLBACK]")
    // Successful authentication, redirect home.
    console.log("- Login was succesful")
    // res.json("You are logged in!")

    const tokenData = {
      _id: req.user.id,
      username: req.user.displayName,
      avatarUrl: req.user._json.picture,
    }
    const token = jwt.sign(tokenData, process.env.JWT_SECRET)

    // REDIRECT TO FRONTEND AT THE END TO DISPLAY .e.g. PROFILE INFORMATION
    res.redirect(`/profile?token=${token}`)
  }
);

// check if user provided a valid JWT either in header or URL param "token"
const authLocal = (req, res, next) => {

  const token = req.headers.token || req.query.token

  // verify token
  try {
    const decodedUser = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decodedUser
    next()
  }
  catch(err) {
    res.status(401).json({
      error: "Not authenticated, buddy"
    })
  }
}

// protected route 
// => only accessible if we provide a valad JWT in either header "token" or URL param "token"
app.get("/profile", authLocal, (req, res) => {
  console.log("[PROFILE]")
  console.log("- User: ", req.user)
  const { username, avatarUrl } = req.user

  res.send(`
    <h1>User Profile</h1>
    <img width="150" height="150" src="${avatarUrl}" />
    <div>Username: ${username}</div>
    <div><a href="/">Back to Home</a></div>    
  `)
})

app.get('/', (req, res) => {
  console.log("[HOMEPAGE]")
  console.log("- User: ", req.user)

  res.send(`
    <h1>Login Options</h1>
    <a href="/auth/google">Google Login</a>
    <a href="/profile">User Profile</a>
  `)
});

let PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server listening on: http://localhost:${PORT}`)
});

